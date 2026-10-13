import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    expect(onUpload).toHaveBeenCalledWith(file);
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
