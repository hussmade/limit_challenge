import logging
import time
import uuid

logger = logging.getLogger("requests")


class RequestLogMiddleware:
    """Correlation and mutation metadata without credentials, query strings or payloads."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = uuid.uuid4().hex
        started = time.monotonic()
        response = self.get_response(request)
        response["X-Request-ID"] = request_id
        if request.path.startswith("/api/"):
            response["Cache-Control"] = "no-store"
            user = getattr(request, "user", None)
            logger.info(
                "request_id=%s method=%s path=%s status=%s actor=%s duration_ms=%s",
                request_id,
                request.method,
                request.path,
                response.status_code,
                getattr(user, "pk", None),
                round((time.monotonic() - started) * 1000),
            )
        return response
