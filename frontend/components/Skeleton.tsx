import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "0.375rem",
  className = "",
  style,
}: Readonly<SkeletonProps>) {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function DocumentListSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <div className="doc-list-skeleton" aria-busy="true" aria-label="Loading documents">
      <span className="sr-only">Loading documents…</span>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="doc-item-skeleton">
          <Skeleton width={`${70 + (index % 3) * 10}%`} height="0.85rem" />
          <div className="doc-item-skeleton-meta">
            <Skeleton width="4.5rem" height="1.1rem" borderRadius="9999px" />
            <Skeleton width="1.5rem" height="0.75rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocumentPreviewSkeleton() {
  return (
    <div className="preview-skeleton" aria-busy="true" aria-label="Loading document preview">
      <div className="preview-skeleton-header">
        <Skeleton width="45%" height="1.25rem" />
        <Skeleton width="18%" height="0.85rem" />
      </div>
      <div className="preview-skeleton-body">
        <div className="preview-skeleton-tabs">
          <Skeleton width="5.5rem" height="1.8rem" borderRadius="0.375rem" />
          <Skeleton width="4.8rem" height="1.8rem" borderRadius="0.375rem" />
        </div>
        <div className="preview-skeleton-prose">
          <Skeleton width="35%" height="1.5rem" style={{ marginBottom: "0.8rem" }} />
          <Skeleton width="100%" height="0.9rem" />
          <Skeleton width="96%" height="0.9rem" />
          <Skeleton width="92%" height="0.9rem" />
          <Skeleton width="75%" height="0.9rem" style={{ marginBottom: "1.2rem" }} />

          <Skeleton width="45%" height="1.25rem" style={{ marginBottom: "0.6rem" }} />
          <Skeleton width="98%" height="0.9rem" />
          <Skeleton width="94%" height="0.9rem" />
          <Skeleton width="88%" height="0.9rem" />
          <Skeleton width="60%" height="0.9rem" />
        </div>
      </div>
    </div>
  );
}
