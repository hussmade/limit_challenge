from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Exists, F, Max, OuterRef, Prefetch, Q, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from server.api import OperatorOrReadOnly

from .models import MaintenanceRecord, Mechanic, Office, Vehicle
from .serializers import (
    AssignmentInput,
    DuplicateInput,
    MaintenanceSerializer,
    MechanicSerializer,
    OfficeSerializer,
    OfficeSummarySerializer,
    VehicleDetailSerializer,
    VehicleSearchInput,
    VehicleSerializer,
    WorkloadSerializer,
)


def year_ago(today):
    try:
        return today.replace(year=today.year - 1)
    except ValueError:
        return today.replace(year=today.year - 1, day=28)


class OfficeViewSet(viewsets.ModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "city"]
    permission_classes = [OperatorOrReadOnly]

    @action(detail=False, pagination_class=None)
    def summary(self, request):
        today = timezone.localdate()
        period = Q(
            vehicles__maintenance_records__maintenance_date__gte=year_ago(today),
            vehicles__maintenance_records__maintenance_date__lte=today,
        )
        offices = Office.objects.annotate(
            active_vehicle_count=Count("vehicles", filter=Q(vehicles__active=True), distinct=True),
            maintenance_cost_last_year=Sum(
                "vehicles__maintenance_records__cost", filter=period, default=Decimal("0")
            ),
            last_maintenance=Max("vehicles__maintenance_records__maintenance_date"),
        )
        return Response(OfficeSummarySerializer(offices, many=True).data)


class MechanicViewSet(viewsets.ModelViewSet):
    queryset = Mechanic.objects.all()
    serializer_class = MechanicSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ["name", "certification_number"]
    filterset_fields = ["active"]
    permission_classes = [OperatorOrReadOnly]

    @action(detail=False, pagination_class=None)
    def workload(self, request):
        today = timezone.localdate()
        period = Q(
            maintenance_records__maintenance_date__gte=today.replace(month=1, day=1),
            maintenance_records__maintenance_date__lte=today,
        )
        mechanics = Mechanic.objects.annotate(
            maintenance_count=Count("maintenance_records", filter=period),
            total_cost=Sum("maintenance_records__cost", filter=period, default=Decimal("0")),
        ).order_by("-maintenance_count", "name", "id")
        return Response(WorkloadSerializer(mechanics, many=True).data)


class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    permission_classes = [OperatorOrReadOnly]

    def get_queryset(self):
        query = (
            Vehicle.objects.select_related("office")
            .annotate(last_maintenance=Max("maintenance_records__maintenance_date"))
            .order_by("make", "model", "id")
        )
        if self.action == "retrieve":
            query = query.prefetch_related(
                Prefetch(
                    "maintenance_records",
                    queryset=MaintenanceRecord.objects.select_related("mechanic", "vehicle"),
                )
            )
        return query

    def get_serializer_class(self):
        return VehicleDetailSerializer if self.action == "retrieve" else VehicleSerializer

    def filter_queryset(self, queryset):
        if self.action not in ("list", "needing_maintenance"):
            return queryset
        filters = VehicleSearchInput(data=self.request.query_params.dict())
        filters.is_valid(raise_exception=True)
        values = filters.validated_data
        for field in ("office", "active"):
            if field in values:
                queryset = queryset.filter(**{field: values[field]})
        for field in ("make", "model"):
            if field in values:
                queryset = queryset.filter(**{f"{field}__icontains": values[field]})
        if "search" in values:
            value = values["search"]
            queryset = queryset.filter(
                Q(vin__icontains=value)
                | Q(license_plate__icontains=value)
                | Q(make__icontains=value)
                | Q(model__icontains=value)
            )
        records = MaintenanceRecord.objects.filter(vehicle_id=OuterRef("pk"))
        criteria = {}
        if "maintenanceFrom" in values:
            criteria["maintenance_date__gte"] = values["maintenanceFrom"]
        if "maintenanceTo" in values:
            criteria["maintenance_date__lte"] = values["maintenanceTo"]
        if "certification" in values:
            criteria["mechanic__certification_number__iexact"] = values["certification"]
        if criteria:
            queryset = queryset.filter(Exists(records.filter(**criteria)))
        return queryset

    @action(detail=True)
    def history(self, request, pk=None):
        vehicle = self.get_object()
        records = vehicle.maintenance_records.select_related("mechanic", "vehicle")
        page = self.paginate_queryset(records)
        return self.get_paginated_response(MaintenanceSerializer(page, many=True).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        vehicle = self.get_object()
        serializer = AssignmentInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        vehicle.office = serializer.validated_data["office"]
        vehicle.save(update_fields=["office"])
        return Response(VehicleSerializer(vehicle).data)

    @action(detail=False, url_path="needing-maintenance")
    def needing_maintenance(self, request):
        query = (
            self.filter_queryset(self.get_queryset())
            .filter(active=True)
            .filter(
                Q(last_maintenance__isnull=True)
                | Q(last_maintenance__lt=timezone.localdate() - timedelta(days=365))
            )
            .order_by(F("last_maintenance").asc(nulls_first=True), "id")
        )
        page = self.paginate_queryset(query)
        return self.get_paginated_response(VehicleSerializer(page, many=True).data)

    @action(detail=False, url_path="duplicate-check")
    def duplicate_check(self, request):
        serializer = DuplicateInput(data=request.query_params.dict())
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        query = Vehicle.objects.all()
        if "exclude_id" in values:
            query = query.exclude(pk=values["exclude_id"].pk)
        conflicts = []
        if query.filter(vin__iexact=values["vin"].strip()).exists():
            conflicts.append("vin")
        if (
            values["active"]
            and query.filter(
                active=True, license_plate__iexact=values["license_plate"].strip()
            ).exists()
        ):
            conflicts.append("license_plate")
        return Response({"conflicts": conflicts})


class MaintenanceViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("mechanic", "vehicle")
    serializer_class = MaintenanceSerializer
    permission_classes = [OperatorOrReadOnly]
    filterset_fields = ["vehicle", "mechanic", "maintenance_type"]
