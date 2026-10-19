import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Skeleton,
  DocumentListSkeleton,
  DocumentPreviewSkeleton,
} from "./Skeleton";

describe("Skeleton Component Suite", () => {
  it("renders base Skeleton with custom dimensions and styling", () => {
    const { container } = render(
      <Skeleton width="120px" height="24px" borderRadius="8px" className="custom-test" />
    );

    const skeletonEl = container.firstChild as HTMLElement;
    expect(skeletonEl).toHaveClass("skeleton-pulse", "custom-test");
    expect(skeletonEl).toHaveStyle({
      width: "120px",
      height: "24px",
      borderRadius: "8px",
    });
    expect(skeletonEl).toHaveAttribute("aria-hidden", "true");
  });

  it("renders DocumentListSkeleton with accessible label and correct count", () => {
    const { container } = render(<DocumentListSkeleton count={4} />);

    const listSkeleton = screen.getByLabelText("Loading documents");
    expect(listSkeleton).toBeInTheDocument();
    expect(listSkeleton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading documents…")).toBeInTheDocument();

    const items = container.querySelectorAll(".doc-item-skeleton");
    expect(items.length).toBe(4);
  });

  it("renders DocumentPreviewSkeleton with header, tabs, and content blocks", () => {
    const { container } = render(<DocumentPreviewSkeleton />);

    const previewSkeleton = screen.getByLabelText("Loading document preview");
    expect(previewSkeleton).toBeInTheDocument();
    expect(previewSkeleton).toHaveAttribute("aria-busy", "true");

    expect(container.querySelector(".preview-skeleton-header")).toBeInTheDocument();
    expect(container.querySelector(".preview-skeleton-tabs")).toBeInTheDocument();
    expect(container.querySelector(".preview-skeleton-prose")).toBeInTheDocument();
  });
});
