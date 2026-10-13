from pathlib import Path

from app.processing.docling import DoclingProcessor, ParsedDocument, ProcessingError


def test_processing_adapter_isolates_missing_optional_docling_dependency(tmp_path: Path) -> None:
    source = tmp_path / "sample.pdf"
    source.write_bytes(b"%PDF-1.7")

    processor = DoclingProcessor()
    try:
        result = processor.convert_to_markdown(source)
    except ProcessingError as error:
        assert str(error) == "PARSER_UNAVAILABLE"
    else:
        assert isinstance(result, str)

    try:
        parsed = processor.process(source)
    except ProcessingError as error:
        assert str(error) == "PARSER_UNAVAILABLE"
    else:
        assert isinstance(parsed, ParsedDocument)
        assert isinstance(parsed.markdown, str)
        assert isinstance(parsed.tables, list)
