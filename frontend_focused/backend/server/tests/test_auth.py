from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase


class AuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username="tester", password="a-long-test-password", is_staff=True
        )
        self.client = APIClient(enforce_csrf_checks=True)

    def csrf(self):
        self.client.get("/api/auth/csrf/")
        return self.client.cookies[settings.CSRF_COOKIE_NAME].value

    def login(self):
        return self.client.post(
            "/api/auth/login/",
            {"username": "tester", "password": "a-long-test-password"},
            HTTP_X_CSRFTOKEN=self.csrf(),
        )

    def test_anonymous_access_is_denied(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_login_requires_csrf_and_does_not_leak_tokens(self):
        self.assertEqual(
            self.client.post(
                "/api/auth/login/", {"username": "tester", "password": "a-long-test-password"}
            ).status_code,
            403,
        )
        result = self.login()
        self.assertEqual(result.status_code, 200)
        self.assertNotIn("access", result.data)
        self.assertTrue(result.cookies[f"{settings.APP_COOKIE_PREFIX}_access"]["httponly"])
        self.assertEqual(self.client.get("/api/auth/me/").data["role"], "operator")
        self.assertEqual(result["Cache-Control"], "no-store")
        self.assertIn("X-Request-ID", result)

    @override_settings(AUTH_COOKIE_SECURE=True)
    def test_secure_cookie_flag(self):
        response = self.login()
        self.assertTrue(response.cookies[f"{settings.APP_COOKIE_PREFIX}_access"]["secure"])

    def test_login_rejects_invalid_and_inactive_accounts(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "tester", "password": "wrong"},
            HTTP_X_CSRFTOKEN=self.csrf(),
        )
        self.assertEqual(response.status_code, 401)
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.login().status_code, 401)

    def test_refresh_rotation_and_logout_revoke_refresh(self):
        self.login()
        name = f"{settings.APP_COOKIE_PREFIX}_refresh"
        original = self.client.cookies[name].value
        response = self.client.post("/api/auth/refresh/", {}, HTTP_X_CSRFTOKEN=self.csrf())
        self.assertEqual(response.status_code, 200)
        rotated = self.client.cookies[name].value
        self.assertNotEqual(original, rotated)
        self.client.cookies[name] = original
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {}, HTTP_X_CSRFTOKEN=self.csrf()).status_code,
            401,
        )
        self.client.cookies[name] = rotated
        self.assertEqual(
            self.client.post("/api/auth/logout/", {}, HTTP_X_CSRFTOKEN=self.csrf()).status_code, 204
        )
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.client.cookies[name] = rotated
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {}, HTTP_X_CSRFTOKEN=self.csrf()).status_code,
            401,
        )

    def test_refresh_and_logout_require_csrf(self):
        self.login()
        self.assertEqual(self.client.post("/api/auth/refresh/", {}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/logout/", {}).status_code, 403)

    def test_login_throttling(self):
        token = self.csrf()
        for _ in range(10):
            self.client.post(
                "/api/auth/login/",
                {"username": "tester", "password": "wrong"},
                HTTP_X_CSRFTOKEN=token,
            )
        self.assertEqual(
            self.client.post(
                "/api/auth/login/",
                {"username": "tester", "password": "wrong"},
                HTTP_X_CSRFTOKEN=token,
            ).status_code,
            429,
        )

    def test_health(self):
        self.assertEqual(self.client.get("/health/").json(), {"status": "ok"})

    def test_password_change_revokes_existing_access(self):
        self.login()
        self.user.set_password("another-long-test-password")
        self.user.save()
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_inactive_user_cannot_refresh(self):
        self.login()
        self.user.is_active = False
        self.user.save()
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {}, HTTP_X_CSRFTOKEN=self.csrf()).status_code,
            401,
        )

    def test_password_change_revokes_refresh(self):
        self.login()
        self.user.set_password("a-new-long-test-password")
        self.user.save()
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {}, HTTP_X_CSRFTOKEN=self.csrf()).status_code,
            401,
        )

    def test_deleted_user_cannot_refresh(self):
        self.login()
        self.user.delete()
        self.assertEqual(
            self.client.post("/api/auth/refresh/", {}, HTTP_X_CSRFTOKEN=self.csrf()).status_code,
            401,
        )
