from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_JSON = "application/problem+json"


class ProblemError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        title: str,
        detail: str | None = None,
        extra: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(detail or title)
        self.status = status
        self.code = code
        self.title = title
        self.detail = detail
        self.extra = extra or {}
        self.headers = headers


def not_found(what: str) -> ProblemError:
    return ProblemError(404, "NOT_FOUND", f"{what} not found")


def forbidden(detail: str = "You do not have access to this resource") -> ProblemError:
    return ProblemError(403, "FORBIDDEN", "Forbidden", detail)


def unauthorized(detail: str = "Missing or invalid bearer token") -> ProblemError:
    return ProblemError(401, "UNAUTHORIZED", "Unauthorized", detail, headers={"WWW-Authenticate": "Bearer"})


def bad_request(code: str, detail: str) -> ProblemError:
    return ProblemError(400, code, "Bad request", detail)


def conflict(code: str, detail: str) -> ProblemError:
    return ProblemError(409, code, "Conflict", detail)


def problem_body(
    request: Request, status: int, code: str, title: str, detail: str | None, extra: dict[str, Any]
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": f"https://kb.northwind.example/problems/{code.lower().replace('_', '-')}",
        "title": title,
        "status": status,
        "code": code,
        "instance": request.url.path,
    }
    if detail:
        body["detail"] = detail
    correlation = request.headers.get("x-correlation-id")
    if correlation:
        body["correlation_id"] = correlation
    body.update(extra)
    return body


def problem_response(
    request: Request,
    status: int,
    code: str,
    title: str,
    detail: str | None = None,
    extra: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        problem_body(request, status, code, title, detail, extra or {}),
        status_code=status,
        media_type=PROBLEM_JSON,
        headers=headers,
    )


def install_error_handlers(app: FastAPI) -> None:
    async def handle_problem(request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, ProblemError)
        return problem_response(
            request,
            exc.status,
            exc.code,
            exc.title,
            exc.detail,
            exc.extra,
            dict(exc.headers) if exc.headers else None,
        )

    async def handle_validation(request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, RequestValidationError)
        errors = [
            {
                "loc": [str(p) for p in e.get("loc", ())],
                "msg": str(e.get("msg", "")),
                "type": str(e.get("type", "")),
            }
            for e in exc.errors()
        ]
        return problem_response(
            request, 422, "VALIDATION_FAILED", "Validation failed", "Request is invalid", {"errors": errors}
        )

    async def handle_http(request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, StarletteHTTPException)
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 401: "UNAUTHORIZED", 403: "FORBIDDEN"}.get(
            exc.status_code, "HTTP_ERROR"
        )
        return problem_response(
            request,
            exc.status_code,
            code,
            str(exc.detail),
            None,
            None,
            dict(exc.headers) if exc.headers else None,
        )

    async def handle_unexpected(request: Request, _exc: Exception) -> JSONResponse:
        return problem_response(request, 500, "INTERNAL", "Internal server error")

    app.add_exception_handler(ProblemError, handle_problem)
    app.add_exception_handler(RequestValidationError, handle_validation)
    app.add_exception_handler(StarletteHTTPException, handle_http)
    app.add_exception_handler(Exception, handle_unexpected)
