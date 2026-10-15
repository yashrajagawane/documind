import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import HomePage from "./page";
import * as authContext from "@/lib/auth-context";

// Mock useAuth hook
vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(),
}));

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
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByText("12 characters minimum required")).toBeInTheDocument();
  });

  it("toggles password visibility between password and text type", () => {
    render(<HomePage />);

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
    render(<HomePage />);

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

    render(<HomePage />);

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

    render(<HomePage />);

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "bad@format" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "short" } });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(
        screen.getByText("Please ensure your email is valid and your password is at least 12 characters.")
      ).toBeInTheDocument();
    });
  });
});
