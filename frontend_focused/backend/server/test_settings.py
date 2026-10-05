import os

os.environ["DJANGO_SECRET_KEY"] = (
    "test-only-key-that-is-deliberately-long-and-never-used-in-production"
)
os.environ["DJANGO_TESTING"] = "true"
from .settings import *  # noqa: F403, E402

SECURE_SSL_REDIRECT = False
AUTH_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
DATABASES = {"default": dj_database_url.config(default="sqlite:///:memory:")}  # noqa: F405
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
LOGGING = {"version": 1, "disable_existing_loggers": True}
