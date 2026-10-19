"use client";

import { useMemo, useEffect, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import { highlightCode } from "@/lib/highlight";

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

function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
      const safeSection = escapeAttribute(text);
      return `<h${depth} id="sec-${slug}" class="markdown-heading" data-section="${safeSection}">${text}</h${depth}>`;
    };

    // Enhance code blocks with syntax highlighting and copy button markup
    renderer.code = ({ text, lang }) => {
      const languageClass = lang ? ` language-${lang}` : "";
      const displayLang = (lang || "code").toUpperCase();
      const highlighted = highlightCode(text, lang);
      return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang-label">${escapeAttribute(displayLang)}</span><button type="button" class="code-copy-btn" aria-label="Copy code block">Copy</button></div><pre class="code-block${languageClass}"><code>${highlighted}</code></pre></div>`;
    };

    // Enhance tables with our app's table styling
    const defaultTable = renderer.table.bind(renderer);
    renderer.table = (token) => {
      const tableHtml = defaultTable(token);
      return `<div class="table-wrapper">${tableHtml.replaceAll("<table>", '<table class="table-viewer">')}</div>`;
    };

    // Parse synchronously with GitHub Flavored Markdown
    const rawHtml = marked.parse(content, {
      renderer,
      gfm: true,
      breaks: true,
      async: false,
    }) as string;

    // Sanitize untrusted HTML to neutralize XSS attacks while preserving safe markup
    return DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["data-section", "target", "class", "type", "aria-label"],
      ADD_TAGS: ["button", "span"],
    });
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

  // Handle heading click and code block copy actions
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // Handle code block copy button
    const copyBtn = target.closest(".code-copy-btn") as HTMLButtonElement | null;
    if (copyBtn) {
      const codeWrapper = copyBtn.closest(".code-block-wrapper");
      const codeEl = codeWrapper?.querySelector("code");
      if (codeEl?.textContent) {
        void navigator.clipboard.writeText(codeEl.textContent);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "✓ Copied";
        setTimeout(() => {
          copyBtn.textContent = originalText ?? "Copy";
        }, 2000);
      }
      return;
    }

    if (!onSectionClick) return;
    const headingTarget = target.closest(".markdown-heading");
    if (headingTarget) {
      const sectionName = headingTarget.getAttribute("data-section");
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
