from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def error_response(request: Request, status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "request_id": getattr(request.state, "request_id", None),
            },
        },
    )


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exception: StarletteHTTPException
    ) -> JSONResponse:
        code = (
            "NOT_FOUND" if exception.status_code == status.HTTP_404_NOT_FOUND else "HTTP_ERROR"
        )
        return error_response(
            request, exception.status_code, code, "The requested operation failed."
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, _: RequestValidationError
    ) -> JSONResponse:
        return error_response(
            request,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            "The request could not be validated.",
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, _: Exception) -> JSONResponse:
        return error_response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "An unexpected error occurred.",
        )
