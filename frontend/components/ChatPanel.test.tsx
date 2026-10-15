import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ChatPanel } from "./ChatPanel";
import type { ChatMessage } from "@/lib/types";

const noop = vi.fn();

const makeMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "msg-1",
  role: "assistant",
  content: "Here is the answer.",
  createdAt: new Date().toISOString(),
  citations: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test("renders the question textarea and submit button", () => {
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Annual Report 2025"
      messages={[]}
      asking={false}
      onAsk={noop}
    />
  );
  // documentName is rendered in the workspace pane header, not inside ChatPanel
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /ask question/i })).toBeInTheDocument();
});

test("renders a textarea and submit button", () => {
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={false}
      onAsk={noop}
    />
  );
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /ask question/i })).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Submitting a question
// ---------------------------------------------------------------------------

test("calls onAsk with trimmed question on form submit", async () => {
  const onAsk = vi.fn().mockResolvedValue(undefined);
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={false}
      onAsk={onAsk}
    />
  );

  const textarea = screen.getByRole("textbox");
  fireEvent.change(textarea, { target: { value: "  What is revenue?  " } });
  fireEvent.submit(textarea.closest("form")!);

  await waitFor(() => {
    expect(onAsk).toHaveBeenCalledWith("What is revenue?");
  });
});

test("submit button is disabled while asking is true", () => {
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={true}
      onAsk={noop}
    />
  );
  // Button text changed to "Generating…" in Phase 3
  expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();
});

test("submit button is disabled when textarea is empty", () => {
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={false}
      onAsk={noop}
    />
  );
  expect(screen.getByRole("button", { name: /ask question/i })).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Message history
// ---------------------------------------------------------------------------

test("renders user and assistant messages from history", () => {
  const messages: ChatMessage[] = [
    makeMsg({ id: "1", role: "user", content: "What is the revenue?" }),
    makeMsg({ id: "2", role: "assistant", content: "The revenue was $10M." }),
  ];
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={messages}
      asking={false}
      onAsk={noop}
    />
  );
  expect(screen.getByText("What is the revenue?")).toBeInTheDocument();
  expect(screen.getByText("The revenue was $10M.")).toBeInTheDocument();
});

test("Clear History button is NOT rendered inside ChatPanel (moved to workspace header)", () => {
  // In Phase 3, the Clear/History button lives in the workspace pane header (page.tsx).
  // ChatPanel no longer renders it internally.
  const messages = [makeMsg()];
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={messages}
      asking={false}
      onAsk={noop}
      onClearHistory={vi.fn()}
    />
  );
  expect(screen.queryByRole("button", { name: /clear history/i })).not.toBeInTheDocument();
});

test("does not show Clear History button when messages array is empty", () => {
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={false}
      onAsk={noop}
      onClearHistory={vi.fn()}
    />
  );
  expect(screen.queryByRole("button", { name: /clear history/i })).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

test("renders citation chips for assistant messages with citations", () => {
  const messages: ChatMessage[] = [
    makeMsg({
      citations: [
        { chunk_id: "chunk-1", section: "Introduction", score: 0.92, page: 1 },
        { chunk_id: "chunk-2", section: "Results", score: 0.85, page: 2 },
      ],
    }),
  ];
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={messages}
      asking={false}
      onAsk={noop}
    />
  );
  expect(screen.getByText(/Introduction/)).toBeInTheDocument();
  expect(screen.getByText(/Results/)).toBeInTheDocument();
});

test("calls onSelectCitation when a citation chip is clicked", () => {
  const onSelectCitation = vi.fn();
  const citation = { chunk_id: "chunk-1", section: "Executive Summary", score: 0.88, page: 3 };
  const messages: ChatMessage[] = [makeMsg({ citations: [citation] })];

  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={messages}
      asking={false}
      onAsk={noop}
      onSelectCitation={onSelectCitation}
    />
  );

  const chip = screen.getByTitle(/Executive Summary/i);
  fireEvent.click(chip);
  expect(onSelectCitation).toHaveBeenCalledWith(citation);
});

// ---------------------------------------------------------------------------
// Phase 4: Starter prompt chips
// ---------------------------------------------------------------------------

test("renders starter prompt chips when messages array is empty", () => {
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={false}
      onAsk={noop}
    />
  );
  const chips = screen.getAllByRole("button", { name: /summarise|main topic|numbers/i });
  expect(chips.length).toBeGreaterThanOrEqual(1);
});

test("clicking a starter chip calls onAsk with that prompt", async () => {
  const onAsk = vi.fn().mockResolvedValue(undefined);
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={false}
      onAsk={onAsk}
    />
  );
  const chip = screen.getByRole("button", { name: /summarise the key findings/i });
  fireEvent.click(chip);
  await waitFor(() => {
    expect(onAsk).toHaveBeenCalledWith("Summarise the key findings.");
  });
});

test("starter chips are NOT shown when messages exist", () => {
  const messages: ChatMessage[] = [
    makeMsg({ id: "1", role: "user", content: "Hello" }),
  ];
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={messages}
      asking={false}
      onAsk={noop}
    />
  );
  expect(screen.queryByText(/summarise the key findings/i)).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Phase 4: Stop / Abort button
// ---------------------------------------------------------------------------

test("Stop button is visible while asking=true and calls onAbort", () => {
  const onAbort = vi.fn();
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={true}
      onAsk={noop}
      onAbort={onAbort}
    />
  );
  const stopBtn = screen.getByRole("button", { name: /stop generation/i });
  expect(stopBtn).toBeInTheDocument();
  fireEvent.click(stopBtn);
  expect(onAbort).toHaveBeenCalledOnce();
});

test("Stop button is NOT visible when asking=false", () => {
  render(
    <ChatPanel
      documentId="doc-1"
      documentName="Report"
      messages={[]}
      asking={false}
      onAsk={noop}
      onAbort={vi.fn()}
    />
  );
  expect(screen.queryByRole("button", { name: /stop generation/i })).not.toBeInTheDocument();
});
