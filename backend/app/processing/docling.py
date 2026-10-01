from pathlib import Path


class ProcessingError(Exception):
    """A safe, user-facing processing failure."""


class DoclingProcessor:
    """Thin synchronous boundary around Docling, called from a worker thread."""

    def convert_to_markdown(self, source: Path) -> str:
        try:
            from docling.document_converter import DocumentConverter
        except ImportError as error:
            raise ProcessingError("PARSER_UNAVAILABLE") from error

        try:
            result = DocumentConverter().convert(source)
            return result.document.export_to_markdown()
        except Exception as error:
            raise ProcessingError("PARSER_FAILED") from error
