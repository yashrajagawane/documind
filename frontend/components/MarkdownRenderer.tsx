"use client";

import { useMemo, useEffect, useRef } from "react";
import { marked } from "marked";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlightSection?: string | null;
  onSectionClick?: (section: string) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function MarkdownRenderer({
  content,
  className = "",
  highlightSection = null,
  onSectionClick,
}: Readonly<MarkdownRendererProps>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    if (!content) return "";

    const renderer = new marked.Renderer();

    // Enhance headings with predictable IDs and classes for citation anchoring
    renderer.heading = ({ text, depth }) => {
      const slug = slugify(text);
      return `<h${depth} id="sec-${slug}" class="markdown-heading" data-section="${text}">${text}</h${depth}>`;
    };

    // Enhance code blocks with copy-friendly markup
    renderer.code = ({ text, lang }) => {
      const languageClass = lang ? ` language-${lang}` : "";
      return `<div class="code-block-wrapper"><pre class="code-block${languageClass}"><code>${text}</code></pre></div>`;
    };

    // Enhance tables with our app's table styling
    const defaultTable = renderer.table.bind(renderer);
    renderer.table = (token) => {
      const tableHtml = defaultTable(token);
      return `<div class="table-wrapper">${tableHtml.replace("<table>", '<table class="table-viewer">')}</div>`;
    };

    // Parse synchronously with GitHub Flavored Markdown
    return marked.parse(content, {
      renderer,
      gfm: true,
      breaks: true,
      async: false,
    }) as string;
  }, [content]);

  // When highlightSection changes, scroll into view and highlight the matching heading
  useEffect(() => {
    if (!highlightSection || !containerRef.current) return;

    const targetSlug = slugify(highlightSection);
    const targetElement =
      containerRef.current.querySelector(`#sec-${targetSlug}`) ||
      containerRef.current.querySelector(`[data-section="${highlightSection}"]`);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      targetElement.classList.add("section-highlight");

      const timer = setTimeout(() => {
        targetElement.classList.remove("section-highlight");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [highlightSection]);

  // Handle heading click for interactive section inspection
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onSectionClick) return;
    const target = (event.target as HTMLElement).closest(".markdown-heading");
    if (target) {
      const sectionName = target.getAttribute("data-section");
      if (sectionName) {
        onSectionClick(sectionName);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`markdown-body ${className}`}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
