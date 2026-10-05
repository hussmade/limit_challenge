from django.urls import include, path
from rest_framework.routers import DefaultRouter

from fleet.views import MaintenanceViewSet, MechanicViewSet, OfficeViewSet, VehicleViewSet

from .health import health

router = DefaultRouter()
router.register("offices", OfficeViewSet)
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("mechanics", MechanicViewSet)
router.register("maintenance", MaintenanceViewSet)
urlpatterns = [
    path("api/auth/", include("server.auth_urls")),
    path("api/", include(router.urls)),
    path("health/", health),
]
