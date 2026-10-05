"""Cookie transport for Simple JWT, with explicit CSRF enforcement."""

from django.conf import settings
from django.contrib.auth import authenticate
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .authentication import CookieJWTAuthentication


def cookie_name(kind):
    return f"{settings.APP_COOKIE_PREFIX}_{kind}"


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class RefreshThrottle(AnonRateThrottle):
    scope = "refresh"


def user_data(user):
    return {
        "id": user.pk,
        "username": user.username,
        "name": user.get_full_name() or user.username,
        "role": "operator" if user.is_staff else "viewer",
    }


def set_tokens(response, access, refresh):
    common = {"httponly": True, "secure": settings.AUTH_COOKIE_SECURE, "samesite": "Lax"}
    response.set_cookie(cookie_name("access"), str(access), max_age=300, path="/api/", **common)
    response.set_cookie(
        cookie_name("refresh"), str(refresh), max_age=28800, path="/api/auth/", **common
    )
    response["Cache-Control"] = "no-store"
    return response


class CsrfView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request)
        return Response({"detail": "CSRF cookie set."})


class LoginInput(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=256, trim_whitespace=False, write_only=True)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        data = LoginInput(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(request=request, **data.validated_data)
        if user is None:
            return Response({"detail": "Username or password is incorrect."}, status=401)
        rotate_token(request)
        token = RefreshToken.for_user(user)
        return set_tokens(Response(user_data(user)), token.access_token, token)


@method_decorator(csrf_protect, name="dispatch")
class RefreshView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [RefreshThrottle]

    def post(self, request):
        token = request.COOKIES.get(cookie_name("refresh"))
        if not token:
            return Response({"detail": "Please sign in again."}, status=401)
        serializer = TokenRefreshSerializer(data={"refresh": token})
        try:
            # Reject deleted, deactivated or password-revoked users before rotating.
            CookieJWTAuthentication().get_user(RefreshToken(token))
            serializer.is_valid(raise_exception=True)
        except (TokenError, AuthenticationFailed):
            return Response(
                {"detail": "Your session has expired. Please sign in again."}, status=401
            )
        return set_tokens(
            Response({"detail": "Session renewed."}),
            serializer.validated_data["access"],
            serializer.validated_data["refresh"],
        )


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.COOKIES.get(cookie_name("refresh"))
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=204)
        response.delete_cookie(cookie_name("access"), path="/api/", samesite="Lax")
        response.delete_cookie(cookie_name("refresh"), path="/api/auth/", samesite="Lax")
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(user_data(request.user))
