import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { UploadZone } from "./UploadZone";

test("renders dropzone with accessible prompt", () => {
  render(<UploadZone onUpload={vi.fn()} />);

  expect(screen.getByRole("button", { name: /upload files/i })).toBeInTheDocument();
  expect(screen.getByText(/drag & drop files here/i)).toBeInTheDocument();
});

test("handles valid file upload and displays activity status", async () => {
  const onUpload = vi.fn().mockResolvedValue(undefined);
  const { container } = render(<UploadZone onUpload={onUpload} />);

  const file = new File(["sample content"], "document.pdf", { type: "application/pdf" });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(onUpload).toHaveBeenCalledWith(file, expect.any(Function));
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(screen.getByText("✓ Uploaded")).toBeInTheDocument();
  });
});

test("rejects unsupported file formats with error", async () => {
  const onUpload = vi.fn();
  const { container } = render(<UploadZone onUpload={onUpload} />);

  const badFile = new File(["binary"], "app.exe", { type: "application/octet-stream" });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [badFile] } });

  await waitFor(() => {
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
  });
});

test("displays error status when onUpload rejects with an authentication or network error", async () => {
  const onUpload = vi.fn().mockRejectedValue(new Error("Authentication required. Please sign in to upload documents."));
  const { container } = render(<UploadZone onUpload={onUpload} />);

  const file = new File(["sample content"], "secure-doc.pdf", { type: "application/pdf" });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(onUpload).toHaveBeenCalledWith(file, expect.any(Function));
    expect(screen.getByText("secure-doc.pdf")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Authentication required. Please sign in to upload documents.")).toBeInTheDocument();
  });
});

test("tracks and renders real-time upload progress with percentage and progressbar", async () => {
  let progressCb: ((progress: { loaded: number; total: number; percent: number }) => void) | undefined;
  let finishUpload: (() => void) | undefined;

  const onUpload = vi.fn().mockImplementation((_file, onProgress) => {
    progressCb = onProgress;
    return new Promise<void>((resolve) => {
      finishUpload = resolve;
    });
  });

  const { container } = render(<UploadZone onUpload={onUpload} />);
  const file = new File(["sample content to upload"], "report.pdf", { type: "application/pdf" });
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(onUpload).toHaveBeenCalledWith(file, expect.any(Function));
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });

  // Check initial progress state
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

  // Send progress event at 65%
  act(() => {
    progressCb?.({ loaded: 1625, total: 2500, percent: 65 });
  });

  await waitFor(() => {
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "65");
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText(/1\.6 KB \/ 2\.4 KB/i)).toBeInTheDocument();
  });

  // Finish upload
  act(() => {
    finishUpload?.();
  });

  await waitFor(() => {
    expect(screen.getByText("✓ Uploaded")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

test("disables file selection when disabled prop is true", () => {
  const onUpload = vi.fn();
  const { container } = render(<UploadZone onUpload={onUpload} disabled />);

  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeDisabled();
});

test("associates file input with label and provides explicit id without aria-hidden", () => {
  const { container } = render(<UploadZone onUpload={vi.fn()} />);

  const input = container.querySelector("#file-upload-input") as HTMLInputElement;
  expect(input).toBeInTheDocument();
  expect(input).not.toHaveAttribute("aria-hidden");

  const label = container.querySelector('label[for="file-upload-input"]');
  expect(label).toBeInTheDocument();
});

