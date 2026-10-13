from dataclasses import dataclass, field
from pathlib import Path


class ProcessingError(Exception):
    """A safe, user-facing processing failure."""


@dataclass
class ParsedDocument:
    markdown: str
    tables: list[dict[str, object]] = field(default_factory=list)


class DoclingProcessor:
    """Thin synchronous boundary around Docling, called from a worker thread."""

    def process(self, source: Path) -> ParsedDocument:
        try:
            from docling.document_converter import DocumentConverter
        except ImportError as error:
            raise ProcessingError("PARSER_UNAVAILABLE") from error

        try:
            result = DocumentConverter().convert(source)
            doc = result.document
            markdown = doc.export_to_markdown()

            tables: list[dict[str, object]] = []
            if hasattr(doc, "tables"):
                for idx, table in enumerate(doc.tables):
                    table_dict: dict[str, object] = {
                        "index": idx,
                    }
                    if hasattr(table, "export_to_markdown"):
                        table_dict["markdown"] = table.export_to_markdown()
                    if hasattr(table, "export_to_dataframe"):
                        try:
                            df = table.export_to_dataframe()
                            table_dict["rows"] = df.to_dict(orient="records")
                            table_dict["columns"] = list(df.columns)
                        except Exception:
                            pass
                    tables.append(table_dict)

            return ParsedDocument(markdown=markdown, tables=tables)
        except Exception as error:
            if isinstance(error, ProcessingError):
                raise
            raise ProcessingError("PARSER_FAILED") from error

    def convert_to_markdown(self, source: Path) -> str:
        return self.process(source).markdown
