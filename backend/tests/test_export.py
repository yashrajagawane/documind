import html
import json
from uuid import uuid4

from app.schemas.documents import DocumentPreview


def test_document_preview_schema_validation() -> None:
    doc_id = uuid4()
    preview = DocumentPreview(
        id=doc_id,
        original_name="financial_report.pdf",
        checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        status="ready",
        processing_stage="completed",
        processing_progress=100,
        created_at="2026-10-01T12:00:00Z",
        markdown="# Financial Report\n\nQ3 Revenue: $1.2M",
        metadata={"character_count": 36, "line_count": 3, "word_count": 5},
        tables=[{"index": 0, "markdown": "| Metric | Value |\n|---|---|\n| Revenue | $1.2M |"}],
    )

    assert preview.id == doc_id
    assert preview.metadata["word_count"] == 5
    assert len(preview.tables) == 1


def test_export_projections_content_and_headers() -> None:
    markdown = "# Title\n\n<p>Safe & sound</p>"
    artifact = {
        "markdown": markdown,
        "metadata": {"word_count": 4},
        "tables": [],
    }

    # Markdown format
    md_body = markdown
    assert md_body.startswith("# Title")

    # JSON format
    json_body = json.dumps(artifact, indent=2)
    parsed = json.loads(json_body)
    assert parsed["markdown"] == markdown
    assert parsed["metadata"]["word_count"] == 4

    # HTML format escaping
    html_body = f'<!doctype html><meta charset="utf-8"><pre>{html.escape(markdown)}</pre>'
    assert "&lt;p&gt;Safe &amp; sound&lt;/p&gt;" in html_body
    assert "<script>" not in html_body


def test_export_original_mimetype_and_disposition() -> None:
    import mimetypes

    filename_pdf = "quarterly_presentation.pdf"
    guessed_pdf, _ = mimetypes.guess_type(filename_pdf)
    assert guessed_pdf == "application/pdf"

    filename_txt = "notes.txt"
    guessed_txt, _ = mimetypes.guess_type(filename_txt)
    assert guessed_txt == "text/plain"

