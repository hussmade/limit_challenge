import os
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle


class Command(BaseCommand):
    help = "Create a deterministic, non-destructive local fleet dataset."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Demo seeding is disabled outside development.")
        if Vehicle.objects.exists():
            self.stdout.write("Fleet data already exists; left it unchanged.")
        else:
            offices = [
                Office.objects.create(name=name, city=city)
                for name, city in [
                    ("Northeast hub", "New York"),
                    ("Pacific operations", "San Francisco"),
                    ("Central dispatch", "Chicago"),
                    ("Southern depot", "Austin"),
                ]
            ]
            mechanics = [
                Mechanic.objects.create(name=name, certification_number=f"ASE-{100 + i}")
                for i, name in enumerate(
                    ["Maya Chen", "Daniel Brooks", "Sofia Rivera", "James Wilson"]
                )
            ]
            cars = [
                ("Ford", "Transit"),
                ("Toyota", "Tacoma"),
                ("Mercedes-Benz", "Sprinter"),
                ("Chevrolet", "Silverado"),
                ("Ram", "ProMaster"),
                ("Ford", "F-150"),
            ]
            today = timezone.localdate()
            for i in range(28):
                make, model = cars[i % len(cars)]
                vehicle = Vehicle.objects.create(
                    vin=f"1FTBR1C80PK{i:06d}",
                    license_plate=f"FL-{1000 + i}",
                    make=make,
                    model=model,
                    year=2020 + i % 6,
                    office=offices[i % 4],
                    active=i % 9 != 8,
                )
                if i % 7 == 0:
                    continue
                ages = [420, 650] if i % 5 == 0 else [15 + i * 3, 220 + i, 500 + i]
                for j, age in enumerate(ages):
                    MaintenanceRecord.objects.create(
                        vehicle=vehicle,
                        mechanic=mechanics[(i + j) % 4],
                        maintenance_date=today - timedelta(days=age),
                        maintenance_type=["inspection", "oil_change", "tires"][j],
                        cost=Decimal(85 + i * 12 + j * 45),
                        notes=[
                            "Routine check completed. Vehicle cleared for service.",
                            "Oil and filter replaced. Fluid levels checked.",
                            "Tires rotated and pressure adjusted.",
                        ][j],
                    )
            Office.objects.create(name="Mountain depot", city="Denver")
            self.stdout.write(
                self.style.SUCCESS("Created 28 vehicles, 5 offices and maintenance history.")
            )
        password = os.environ.get("DEMO_PASSWORD")
        if password:
            if len(password) < 12:
                raise CommandError("DEMO_PASSWORD must have at least 12 characters.")
            for username, staff in [("operator", True), ("viewer", False)]:
                user, created = get_user_model().objects.get_or_create(
                    username=username,
                    defaults={
                        "first_name": "Demo",
                        "last_name": username.title(),
                        "is_staff": staff,
                    },
                )
                if created:
                    user.set_password(password)
                    user.save()
            self.stdout.write("Demo accounts are available. Existing passwords were not changed.")
