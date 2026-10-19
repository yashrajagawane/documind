"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_CHAT_WIDTH = 380;
export const MIN_CHAT_WIDTH = 320;
export const MAX_CHAT_WIDTH = 600;
export const MIN_PREVIEW_WIDTH = 400;
export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_COMPACT_WIDTH = 220;

export interface WorkspaceSplitterProps {
  chatWidth: number;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  onResize: (newWidth: number) => void;
  onReset?: () => void;
}

export function WorkspaceSplitter({
  chatWidth,
  minWidth = MIN_CHAT_WIDTH,
  maxWidth = MAX_CHAT_WIDTH,
  defaultWidth = DEFAULT_CHAT_WIDTH,
  onResize,
  onReset,
}: Readonly<WorkspaceSplitterProps>) {
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const clamp = useCallback(
    (targetWidth: number) => {
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
      const effectiveSidebar = windowWidth <= 1100 ? SIDEBAR_COMPACT_WIDTH : SIDEBAR_WIDTH;
      // Reserve space for sidebar (280/220px), preview (400px), and 1px splitter
      const maxAllowed = Math.max(
        minWidth,
        Math.min(maxWidth, windowWidth - effectiveSidebar - MIN_PREVIEW_WIDTH - 1)
      );
      return Math.max(minWidth, Math.min(maxAllowed, Math.round(targetWidth)));
    },
    [minWidth, maxWidth]
  );

  const handleStart = (
    e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;
    if (typeof document !== "undefined") {
      document.body.classList.add("is-resizing");
    }
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | PointerEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = clamp(window.innerWidth - e.clientX);
      onResize(newWidth);
    };

    const handleEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      if (typeof document !== "undefined") {
        document.body.classList.remove("is-resizing");
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      if (typeof document !== "undefined") {
        document.body.classList.remove("is-resizing");
      }
    };
  }, [clamp, onResize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 20;
    if (e.key === "ArrowLeft") {
      // Splitter moves left -> Chat pane expands
      e.preventDefault();
      onResize(clamp(chatWidth + step));
    } else if (e.key === "ArrowRight") {
      // Splitter moves right -> Chat pane shrinks
      e.preventDefault();
      onResize(clamp(chatWidth - step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onResize(minWidth);
    } else if (e.key === "End") {
      e.preventDefault();
      onResize(clamp(maxWidth));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (onReset) {
        onReset();
      } else {
        onResize(defaultWidth);
      }
    }
  };

  const handleDoubleClick = () => {
    if (onReset) {
      onReset();
    } else {
      onResize(defaultWidth);
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize chat panel"
      aria-valuenow={chatWidth}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      className={`workspace-splitter ${isDragging ? "dragging" : ""}`}
      onPointerDown={handleStart}
      onMouseDown={handleStart}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize panel, arrow keys to nudge, double-click to reset"
    />
  );
}
