export type ProcessingStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "failed"
  | "deleting";

export type PublicUser = {
  id: string;
  email: string;
};

export type AuthResponse = {
  user: PublicUser;
  access_token: string;
  token_type: "bearer";
};

export type DocumentSummary = {
  id: string;
  original_name: string;
  checksum_sha256: string;
  status: string;
  processing_stage: string | null;
  processing_progress: number;
  created_at: string;
};

export type DocumentPreview = DocumentSummary & {
  markdown: string;
  metadata: Record<string, number>;
  tables: Record<string, unknown>[];
};
