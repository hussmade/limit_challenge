from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from .models import MaintenanceRecord, Mechanic, Office, Vehicle


class SafeWriteSerializer(serializers.ModelSerializer):
    """Friendly conflict responses even when concurrent writes race validation."""

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "A conflicting record already exists. Refresh and check unique fields."
                    ]
                }
            ) from exc

    def update(self, instance, validated_data):
        try:
            with transaction.atomic():
                return super().update(instance, validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "A conflicting record already exists. Refresh and check unique fields."
                    ]
                }
            ) from exc


class OfficeSerializer(SafeWriteSerializer):
    class Meta:
        model = Office
        fields = ["id", "name", "city"]


class MechanicSerializer(SafeWriteSerializer):
    class Meta:
        model = Mechanic
        fields = ["id", "name", "certification_number", "active"]

    def validate_certification_number(self, value):
        value = value.strip().upper()
        query = Mechanic.objects.filter(certification_number__iexact=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("This certification number is already registered.")
        return value


class VehicleSerializer(SafeWriteSerializer):
    office_detail = OfficeSerializer(source="office", read_only=True)
    last_maintenance = serializers.DateField(read_only=True, allow_null=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "office",
            "office_detail",
            "active",
            "last_maintenance",
        ]
        extra_kwargs = {"vin": {"validators": []}}

    def validate_vin(self, value):
        value = value.strip().upper()
        Vehicle._meta.get_field("vin").validators[0](value)
        query = Vehicle.objects.filter(vin=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("A vehicle with this VIN already exists.")
        return value

    def validate_year(self, value):
        if not 1886 <= value <= timezone.localdate().year + 1:
            raise serializers.ValidationError("Use a year from 1886 through next year.")
        return value

    def validate_license_plate(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        active = attrs.get("active", getattr(self.instance, "active", True))
        plate = attrs.get("license_plate", getattr(self.instance, "license_plate", ""))
        query = Vehicle.objects.filter(active=True, license_plate__iexact=plate)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if active and query.exists():
            raise serializers.ValidationError(
                {"license_plate": "Another active vehicle uses this license plate."}
            )
        return attrs


class MaintenanceSerializer(SafeWriteSerializer):
    mechanic_detail = MechanicSerializer(source="mechanic", read_only=True)
    vehicle_label = serializers.CharField(source="vehicle.__str__", read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "vehicle",
            "vehicle_label",
            "mechanic",
            "mechanic_detail",
            "maintenance_date",
            "maintenance_type",
            "cost",
            "notes",
        ]

    def validate_maintenance_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Maintenance must have been completed; future dates are not allowed."
            )
        return value

    def validate(self, attrs):
        # Existing historical records can still be corrected after deactivation.
        for field in ["vehicle", "mechanic"]:
            selected = attrs.get(field)
            changed = selected is not None and (
                not self.instance or selected.pk != getattr(self.instance, f"{field}_id")
            )
            if changed and not selected.active:
                raise serializers.ValidationError({field: f"Choose an active {field}."})
        return attrs


class VehicleDetailSerializer(VehicleSerializer):
    maintenance_history = MaintenanceSerializer(
        source="maintenance_records", many=True, read_only=True
    )

    class Meta(VehicleSerializer.Meta):
        fields = [*VehicleSerializer.Meta.fields, "maintenance_history"]


class OfficeSummarySerializer(OfficeSerializer):
    active_vehicle_count = serializers.IntegerField()
    maintenance_cost_last_year = serializers.DecimalField(max_digits=18, decimal_places=2)
    last_maintenance = serializers.DateField(allow_null=True)

    class Meta(OfficeSerializer.Meta):
        fields = [
            *OfficeSerializer.Meta.fields,
            "active_vehicle_count",
            "maintenance_cost_last_year",
            "last_maintenance",
        ]


class WorkloadSerializer(MechanicSerializer):
    maintenance_count = serializers.IntegerField()
    total_cost = serializers.DecimalField(max_digits=18, decimal_places=2)

    class Meta(MechanicSerializer.Meta):
        fields = [*MechanicSerializer.Meta.fields, "maintenance_count", "total_cost"]


class VehicleSearchInput(serializers.Serializer):
    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all(), required=False)
    active = serializers.BooleanField(required=False)
    make = serializers.CharField(max_length=80, required=False)
    model = serializers.CharField(max_length=80, required=False)
    maintenanceFrom = serializers.DateField(required=False)
    maintenanceTo = serializers.DateField(required=False)
    certification = serializers.CharField(max_length=64, required=False)
    search = serializers.CharField(max_length=120, required=False)

    def validate(self, attrs):
        if (
            attrs.get("maintenanceFrom")
            and attrs.get("maintenanceTo")
            and attrs["maintenanceFrom"] > attrs["maintenanceTo"]
        ):
            raise serializers.ValidationError(
                {"maintenanceTo": "End date must be on or after start date."}
            )
        return attrs


class DuplicateInput(serializers.Serializer):
    vin = serializers.CharField(max_length=17)
    license_plate = serializers.CharField(max_length=20)
    active = serializers.BooleanField(default=True)
    exclude_id = serializers.PrimaryKeyRelatedField(queryset=Vehicle.objects.all(), required=False)


class AssignmentInput(serializers.Serializer):
    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all())
