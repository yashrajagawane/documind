import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import HomePage from "./page";
import * as authContext from "@/lib/auth-context";
import * as api from "@/lib/api";
import { mockRouter, setTestSearchParams } from "../tests/setup";

// Mock useAuth hook
vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(),
}));

// Mock apiFetch
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

function renderWithClient(ui: React.ReactElement, client?: QueryClient) {
  const testClient =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  return {
    ...render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>),
    queryClient: testClient,
  };
}

describe("HomePage Authentication Form & Onboarding", () => {
  const mockSignIn = vi.fn();
  const mockRegister = vi.fn();
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.useAuth).mockReturnValue({
      accessToken: null,
      user: null,
      isLoading: false,
      signIn: mockSignIn,
      register: mockRegister,
      signOut: mockSignOut,
    });
  });

  it("renders login form by default with password length requirement hint", () => {
    renderWithClient(<HomePage />);

    expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByText("12 characters minimum required")).toBeInTheDocument();
  });

  it("toggles password visibility between password and text type", () => {
    renderWithClient(<HomePage />);

    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggleBtn);

    expect(passwordInput.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(passwordInput.type).toBe("password");
  });

  it("updates password length requirement dynamically as user types", () => {
    renderWithClient(<HomePage />);

    const passwordInput = screen.getByLabelText(/^password/i);

    // Type 6 characters -> announces remaining needed
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    expect(screen.getByText("6 more characters required (12 minimum)")).toBeInTheDocument();

    // Type 11 characters -> 1 more character required
    fireEvent.change(passwordInput, { target: { value: "secret12345" } });
    expect(screen.getByText("1 more character required (12 minimum)")).toBeInTheDocument();

    // Type 12+ characters -> shows valid state with checkmark
    fireEvent.change(passwordInput, { target: { value: "supersecret123" } });
    expect(screen.getByText(/12\+ characters entered/i)).toBeInTheDocument();
  });

  it("maps 409 conflict error to user-friendly message with switch-to-login option", async () => {
    mockRegister.mockRejectedValue(new Error("Email is already registered. [409]"));

    renderWithClient(<HomePage />);

    // Switch to register mode
    fireEvent.click(screen.getByRole("button", { name: /Need an account\? Register/i }));
    expect(screen.getByRole("heading", { name: /Create your workspace/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "existing@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "validpassword12" } });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(
        screen.getByText("This email is already registered. Did you mean to sign in?")
      ).toBeInTheDocument();
    });

    // Clicking 'Switch to Sign In' switches mode to login
    const switchBtn = screen.getByRole("button", { name: "Switch to Sign In" });
    fireEvent.click(switchBtn);

    expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
  });

  it("maps 422 validation error to friendly guidance message", async () => {
    mockSignIn.mockRejectedValue(new Error("VALIDATION_ERROR: The request could not be validated. [422]"));

    renderWithClient(<HomePage />);

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "bad@format" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "short" } });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(
        screen.getByText("Please ensure your email is valid and your password is at least 12 characters.")
      ).toBeInTheDocument();
    });
  });

  it("renders workspace and fetches documents using React Query when user is authenticated", async () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      accessToken: "mock-token-xyz",
      user: { id: "u-1", email: "user@example.com" },
      isLoading: false,
      signIn: mockSignIn,
      register: mockRegister,
      signOut: mockSignOut,
    });

    vi.mocked(api.apiFetch).mockResolvedValue([
      {
        id: "doc-1",
        original_name: "test-doc.pdf",
        checksum_sha256: "hash123",
        status: "ready",
        processing_stage: null,
        processing_progress: 100,
        created_at: new Date().toISOString(),
      },
    ]);

    renderWithClient(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("test-doc.pdf")).toBeInTheDocument();
    });
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("purges query cache and invokes signOut when Sign out is clicked", async () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      accessToken: "mock-token-xyz",
      user: { id: "u-1", email: "user@example.com" },
      isLoading: false,
      signIn: mockSignIn,
      register: mockRegister,
      signOut: mockSignOut,
    });

    vi.mocked(api.apiFetch).mockResolvedValue([]);

    const { queryClient } = renderWithClient(<HomePage />);
    const clearSpy = vi.spyOn(queryClient, "clear");

    const signOutBtn = screen.getByRole("button", { name: /Sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("URL deep linking: loads and previews document directly when ?doc=<id> is in URL", async () => {
    setTestSearchParams("doc=doc-1");

    vi.mocked(authContext.useAuth).mockReturnValue({
      accessToken: "mock-token-xyz",
      user: { id: "u-1", email: "user@example.com" },
      isLoading: false,
      signIn: mockSignIn,
      register: mockRegister,
      signOut: mockSignOut,
    });

    vi.mocked(api.apiFetch).mockImplementation((path) => {
      if (path === "/documents") {
        return Promise.resolve([
          {
            id: "doc-1",
            original_name: "deep-doc.pdf",
            checksum_sha256: "hash123",
            status: "ready",
            processing_stage: null,
            processing_progress: 100,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      if (path === "/documents/doc-1/preview") {
        return Promise.resolve({
          id: "doc-1",
          original_name: "deep-doc.pdf",
          checksum_sha256: "hash123",
          status: "ready",
          processing_stage: null,
          processing_progress: 100,
          created_at: new Date().toISOString(),
          markdown: "# Deep Linked Document Content",
          tables: [],
          metadata: { word_count: 5, character_count: 30 },
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    renderWithClient(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("Deep Linked Document Content")).toBeInTheDocument();
    });
    expect(screen.getByRole("listitem", { current: true })).toHaveTextContent("deep-doc.pdf");
  });

  it("URL synchronization: clicking a ready document calls router.push with ?doc=<id>", async () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      accessToken: "mock-token-xyz",
      user: { id: "u-1", email: "user@example.com" },
      isLoading: false,
      signIn: mockSignIn,
      register: mockRegister,
      signOut: mockSignOut,
    });

    vi.mocked(api.apiFetch).mockImplementation((path) => {
      if (path === "/documents") {
        return Promise.resolve([
          {
            id: "doc-2",
            original_name: "second-doc.pdf",
            checksum_sha256: "hash456",
            status: "ready",
            processing_stage: null,
            processing_progress: 100,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      if (path === "/documents/doc-2/preview") {
        return Promise.resolve({
          id: "doc-2",
          original_name: "second-doc.pdf",
          checksum_sha256: "hash456",
          status: "ready",
          processing_stage: null,
          processing_progress: 100,
          created_at: new Date().toISOString(),
          markdown: "# Preview for Second Doc",
          tables: [],
          metadata: { word_count: 4, character_count: 24 },
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    renderWithClient(<HomePage />);

    const docBtn = await screen.findByRole("button", { name: "second-doc.pdf" });
    fireEvent.click(docBtn);

    expect(mockRouter.push).toHaveBeenCalledWith("/?doc=doc-2");
    await waitFor(() => {
      expect(screen.getByText("Preview for Second Doc")).toBeInTheDocument();
    });
  });

  it("Invalid document deep link fallback: replaces URL with / and displays clear alert", async () => {
    setTestSearchParams("doc=non-existent-doc");

    vi.mocked(authContext.useAuth).mockReturnValue({
      accessToken: "mock-token-xyz",
      user: { id: "u-1", email: "user@example.com" },
      isLoading: false,
      signIn: mockSignIn,
      register: mockRegister,
      signOut: mockSignOut,
    });

    vi.mocked(api.apiFetch).mockImplementation((path) => {
      if (path === "/documents") {
        return Promise.resolve([
          {
            id: "doc-1",
            original_name: "existing-doc.pdf",
            checksum_sha256: "hash123",
            status: "ready",
            processing_stage: null,
            processing_progress: 100,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return Promise.reject(new Error("Unknown route"));
    });

    renderWithClient(<HomePage />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
      expect(screen.getByText("The requested document could not be found.")).toBeInTheDocument();
    });
    expect(screen.getByText("Select a document to preview")).toBeInTheDocument();
  });

  it("Document deletion clears URL search params and resets selection", async () => {
    setTestSearchParams("doc=doc-1");

    vi.mocked(authContext.useAuth).mockReturnValue({
      accessToken: "mock-token-xyz",
      user: { id: "u-1", email: "user@example.com" },
      isLoading: false,
      signIn: mockSignIn,
      register: mockRegister,
      signOut: mockSignOut,
    });

    vi.mocked(api.apiFetch).mockImplementation((path, options) => {
      if (path === "/documents" && (!options || options.method === undefined)) {
        return Promise.resolve([
          {
            id: "doc-1",
            original_name: "to-delete.pdf",
            checksum_sha256: "hash123",
            status: "ready",
            processing_stage: null,
            processing_progress: 100,
            created_at: new Date().toISOString(),
          },
        ]);
      }
      if (path === "/documents/doc-1/preview") {
        return Promise.resolve({
          id: "doc-1",
          original_name: "to-delete.pdf",
          checksum_sha256: "hash123",
          status: "ready",
          processing_stage: null,
          processing_progress: 100,
          created_at: new Date().toISOString(),
          markdown: "# To Delete Content",
          tables: [],
          metadata: { word_count: 3, character_count: 18 },
        });
      }
      if (path === "/documents/doc-1" && options?.method === "DELETE") {
        return Promise.resolve();
      }
      return Promise.reject(new Error("Unknown route"));
    });

    renderWithClient(<HomePage />);

    await screen.findByText("To Delete Content");

    const deleteBtn = screen.getByRole("button", { name: "Delete to-delete.pdf" });
    fireEvent.click(deleteBtn);

    const confirmBtn = await screen.findByRole("button", { name: "Delete document" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/");
    });
  });
});


