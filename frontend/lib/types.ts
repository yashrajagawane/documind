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
