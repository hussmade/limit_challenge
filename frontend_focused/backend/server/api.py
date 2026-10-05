from django.db.models.deletion import ProtectedError
from rest_framework.exceptions import APIException
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import SAFE_METHODS, BasePermission


class StandardPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "pageSize"
    max_page_size = 100


class OperatorOrReadOnly(BasePermission):
    message = "An operator account is required to change records."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.method in SAFE_METHODS or request.user.is_staff)
        )


class Conflict(APIException):
    status_code = 409
    default_detail = "This record is still in use. Keep its history and deactivate it instead."


def exception_handler(exc, context):
    from rest_framework.views import exception_handler as drf_exception_handler

    if isinstance(exc, ProtectedError):
        exc = Conflict()
    response = drf_exception_handler(exc, context)
    if response is not None:
        response["Cache-Control"] = "no-store"
    return response
