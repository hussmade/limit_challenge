from decimal import Decimal

from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models.functions import Upper


class Office(models.Model):
    name = models.CharField(max_length=120)
    city = models.CharField(max_length=120)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class Vehicle(models.Model):
    vin = models.CharField(
        max_length=17,
        unique=True,
        validators=[
            RegexValidator(r"^[A-HJ-NPR-Z0-9]{17}$", "Enter a 17-character VIN without I, O or Q.")
        ],
    )
    license_plate = models.CharField(max_length=20)
    make = models.CharField(max_length=80)
    model = models.CharField(max_length=80)
    year = models.PositiveSmallIntegerField()
    office = models.ForeignKey(Office, on_delete=models.PROTECT, related_name="vehicles")
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["make", "model", "id"]
        constraints = [
            models.UniqueConstraint(
                Upper("license_plate"), condition=models.Q(active=True), name="unique_active_plate"
            ),
            models.CheckConstraint(
                condition=models.Q(year__gte=1886, year__lte=9999), name="valid_vehicle_year"
            ),
        ]
        indexes = [models.Index(fields=["office", "active"])]

    def save(self, *args, **kwargs):
        self.vin = self.vin.strip().upper()
        self.license_plate = self.license_plate.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.make} {self.model} · {self.license_plate}"


class Mechanic(models.Model):
    name = models.CharField(max_length=120)
    certification_number = models.CharField(max_length=64, unique=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]

    def save(self, *args, **kwargs):
        self.certification_number = self.certification_number.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class MaintenanceRecord(models.Model):
    class Type(models.TextChoices):
        INSPECTION = "inspection", "Inspection"
        OIL_CHANGE = "oil_change", "Oil change"
        TIRES = "tires", "Tires"
        BRAKES = "brakes", "Brakes"
        REPAIR = "repair", "Repair"
        OTHER = "other", "Other"

    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.PROTECT, related_name="maintenance_records"
    )
    mechanic = models.ForeignKey(
        Mechanic, on_delete=models.PROTECT, related_name="maintenance_records"
    )
    maintenance_date = models.DateField()
    maintenance_type = models.CharField(max_length=32, choices=Type.choices)
    cost = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    notes = models.TextField(blank=True, max_length=4000)

    class Meta:
        ordering = ["-maintenance_date", "-id"]
        indexes = [
            models.Index(fields=["vehicle", "-maintenance_date", "-id"]),
            models.Index(fields=["mechanic", "maintenance_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cost__gte=0), name="nonnegative_maintenance_cost"
            )
        ]
