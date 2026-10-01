import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    chunk_id: str
    text: str
    section: str | None
    index: int


def chunk_markdown(markdown: str, max_chars: int = 1200, overlap: int = 150) -> list[Chunk]:
    """Split markdown predictably while keeping headings and table rows together."""
    if max_chars <= 0 or overlap < 0 or overlap >= max_chars:
        raise ValueError("Chunk limits are invalid.")
    sections: list[tuple[str | None, str]] = []
    current_heading: str | None = None
    current_lines: list[str] = []
    for line in markdown.splitlines():
        heading = re.match(r"^#{1,6}\s+(.+)$", line)
        if heading and current_lines:
            sections.append((current_heading, "\n".join(current_lines).strip()))
            current_lines = []
        if heading:
            current_heading = heading.group(1).strip()
        current_lines.append(line)
    if current_lines:
        sections.append((current_heading, "\n".join(current_lines).strip()))

    chunks: list[Chunk] = []
    for section, text in sections:
        if not text:
            continue
        start = 0
        while start < len(text):
            end = min(len(text), start + max_chars)
            if end < len(text):
                boundary = text.rfind("\n\n", start, end)
                if boundary > start + max_chars // 2:
                    end = boundary
            value = text[start:end].strip()
            if value:
                chunks.append(Chunk(f"chunk-{len(chunks):06d}", value, section, len(chunks)))
            if end >= len(text):
                break
            start = max(end - overlap, start + 1)
    return chunks
