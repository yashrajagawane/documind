"use client";

import { useState } from "react";
import type { FormEvent } from "react";

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export function UploadZone({ onUpload, disabled = false }: Readonly<UploadZoneProps>) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    // Check size limit: 25MB = 26,214,400 bytes
    if (file.size > 26214400) {
      setLocalError("The selected file exceeds the 25MB upload limit.");
      return;
    }

    setLocalError(null);
    setUploading(true);
    try {
      await onUpload(file);
      setFile(null);
      event.currentTarget.reset();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label htmlFor="document-file">Upload a document</label>
      <input
        id="document-file"
        type="file"
        accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.md"
        required
        disabled={disabled || uploading}
        onChange={(event) => {
          setLocalError(null);
          setFile(event.target.files?.[0] ?? null);
        }}
      />
      {localError && (
        <p className="form-error" role="alert">
          {localError}
        </p>
      )}
      <button className="button" type="submit" disabled={!file || uploading || disabled}>
        {uploading ? "Uploading securely…" : "Upload privately"}
      </button>
    </form>
  );
}
