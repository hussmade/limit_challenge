from django.urls import include, path
from rest_framework.routers import DefaultRouter

from submissions.views import BrokerViewSet, DocumentDownloadView, SubmissionViewSet

from .health import health

router = DefaultRouter()
router.register("submissions", SubmissionViewSet, basename="submission")
router.register("brokers", BrokerViewSet)
urlpatterns = [
    path("api/auth/", include("server.auth_urls")),
    path("api/documents/<int:pk>/download/", DocumentDownloadView.as_view()),
    path("api/", include(router.urls)),
    path("health/", health),
]
