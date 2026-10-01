from pathlib import Path

from app.processing.docling import DoclingProcessor, ProcessingError


def test_processing_adapter_isolates_missing_optional_docling_dependency(tmp_path: Path) -> None:
    source = tmp_path / "sample.pdf"
    source.write_bytes(b"%PDF-1.7")

    try:
        result = DoclingProcessor().convert_to_markdown(source)
    except ProcessingError as error:
        assert str(error) == "PARSER_UNAVAILABLE"
    else:
        assert isinstance(result, str)
