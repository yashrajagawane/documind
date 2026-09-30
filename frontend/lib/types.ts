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
