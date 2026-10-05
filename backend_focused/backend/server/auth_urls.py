from django.urls import path

from .auth import CsrfView, LoginView, LogoutView, MeView, RefreshView

urlpatterns = [
    path("csrf/", CsrfView.as_view()),
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("refresh/", RefreshView.as_view()),
    path("me/", MeView.as_view()),
]
