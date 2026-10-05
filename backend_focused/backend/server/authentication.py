from django.conf import settings
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


def cookie_name(kind):
    return f"{settings.APP_COOKIE_PREFIX}_{kind}"


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # Bearer clients do not rely on ambient browser credentials.
        if self.get_header(request) is not None:
            return super().authenticate(request)
        raw = request.COOKIES.get(cookie_name("access"))
        if not raw:
            return None
        validated = self.get_validated_token(raw)
        check = CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied("CSRF verification failed. Refresh the page and try again.")
        return self.get_user(validated), validated
