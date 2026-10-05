from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle
from fleet.views import year_ago


class FleetTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("operator", is_staff=True)
        self.client.force_authenticate(self.user)
        self.office = Office.objects.create(name="North", city="Boston")
        self.other = Office.objects.create(name="West", city="Seattle")
        self.mechanic = Mechanic.objects.create(name="Alex", certification_number="ASE-1")
        self.vehicle = Vehicle.objects.create(
            vin="1FTBR1C80PK000001",
            license_plate="AB-100",
            make="Ford",
            model="Transit",
            year=2023,
            office=self.office,
        )
        self.today = timezone.localdate()

    def record(self, days=0, **kwargs):
        return MaintenanceRecord.objects.create(
            vehicle=kwargs.pop("vehicle", self.vehicle),
            mechanic=kwargs.pop("mechanic", self.mechanic),
            maintenance_date=self.today - timedelta(days=days),
            maintenance_type="inspection",
            cost=kwargs.pop("cost", Decimal("100.00")),
            **kwargs,
        )

    def test_all_crud_resources(self):
        inputs = {
            "offices": {"name": "South", "city": "Austin"},
            "mechanics": {"name": "Maya", "certification_number": "ASE-2"},
            "vehicles": {
                "vin": "1FTBR1C80PK000002",
                "license_plate": "XY-2",
                "make": "Toyota",
                "model": "Tacoma",
                "year": 2024,
                "office": self.office.pk,
            },
            "maintenance": {
                "vehicle": self.vehicle.pk,
                "mechanic": self.mechanic.pk,
                "maintenance_date": str(self.today),
                "maintenance_type": "inspection",
                "cost": "125.25",
            },
        }
        for resource, data in inputs.items():
            with self.subTest(resource=resource):
                result = self.client.post(f"/api/{resource}/", data)
                self.assertEqual(result.status_code, 201, result.data)
                url = f"/api/{resource}/{result.data['id']}/"
                self.assertEqual(self.client.get(url).status_code, 200)
                self.assertEqual(self.client.put(url, data).status_code, 200)
                self.assertEqual(self.client.patch(url, {}).status_code, 200)
                self.assertEqual(self.client.delete(url).status_code, 204)

    def test_normalization_and_duplicate_vin(self):
        data = {
            "vin": "1ftbr1c80pk000001",
            "license_plate": "other",
            "make": "Ford",
            "model": "Transit",
            "year": 2023,
            "office": self.office.pk,
        }
        result = self.client.post("/api/vehicles/", data)
        self.assertEqual(result.status_code, 400)
        self.assertIn("vin", result.data)
        data["vin"] = "invalid"
        self.assertEqual(self.client.post("/api/vehicles/", data).status_code, 400)

    def test_active_plate_uniqueness_on_create_and_reactivation(self):
        other = Vehicle.objects.create(
            vin="1FTBR1C80PK000002",
            license_plate="ab-100",
            make="Ford",
            model="Transit",
            year=2023,
            office=self.office,
            active=False,
        )
        response = self.client.patch(f"/api/vehicles/{other.pk}/", {"active": True})
        self.assertEqual(response.status_code, 400)
        self.assertIn("license_plate", response.data)
        self.assertEqual(
            self.client.patch(f"/api/vehicles/{self.vehicle.pk}/", {"active": False}).status_code,
            200,
        )
        self.assertEqual(
            self.client.patch(f"/api/vehicles/{other.pk}/", {"active": True}).status_code, 200
        )

    def test_database_blocks_active_plate_race(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Vehicle.objects.create(
                vin="1FTBR1C80PK000002",
                license_plate="ab-100",
                make="Ford",
                model="Transit",
                year=2023,
                office=self.office,
            )

    def test_negative_cost_future_dates_and_inactive_mechanic(self):
        data = {
            "vehicle": self.vehicle.pk,
            "mechanic": self.mechanic.pk,
            "maintenance_date": str(self.today),
            "maintenance_type": "inspection",
            "cost": "-1.00",
        }
        self.assertEqual(self.client.post("/api/maintenance/", data).status_code, 400)
        data.update(cost="20", maintenance_date=str(self.today + timedelta(days=1)))
        self.assertEqual(self.client.post("/api/maintenance/", data).status_code, 400)
        self.mechanic.active = False
        self.mechanic.save()
        data["maintenance_date"] = str(self.today)
        self.assertEqual(self.client.post("/api/maintenance/", data).status_code, 400)

    def test_history_protects_referenced_entities(self):
        self.record()
        for resource, pk in [
            ("offices", self.office.pk),
            ("vehicles", self.vehicle.pk),
            ("mechanics", self.mechanic.pk),
        ]:
            self.assertEqual(self.client.delete(f"/api/{resource}/{pk}/").status_code, 409)

    def test_summary_counts_once_and_includes_empty_offices(self):
        self.record(cost=Decimal("110.20"))
        self.record(days=1, cost=Decimal("110.20"))
        self.record(days=800, cost=Decimal("900"))
        with self.assertNumQueries(1):
            result = self.client.get("/api/offices/summary/")
        north = next(row for row in result.data if row["id"] == self.office.pk)
        self.assertEqual(north["active_vehicle_count"], 1)
        self.assertEqual(north["maintenance_cost_last_year"], "220.40")
        west = next(row for row in result.data if row["id"] == self.other.pk)
        self.assertEqual(west["maintenance_cost_last_year"], "0.00")
        self.assertIsNone(west["last_maintenance"])

    def test_filters_apply_to_same_maintenance_record_and_do_not_duplicate(self):
        second = Mechanic.objects.create(name="Other", certification_number="ASE-2")
        self.record(days=10)
        self.record(days=500, mechanic=second)
        params = {
            "office": self.office.pk,
            "active": "true",
            "make": "for",
            "model": "trans",
            "maintenanceFrom": str(self.today - timedelta(days=20)),
            "maintenanceTo": str(self.today),
            "certification": "ase-2",
        }
        self.assertEqual(self.client.get("/api/vehicles/", params).data["count"], 0)
        params["certification"] = "ase-1"
        self.assertEqual(self.client.get("/api/vehicles/", params).data["count"], 1)
        self.record(days=10)
        self.assertEqual(self.client.get("/api/vehicles/", params).data["count"], 1)

    def test_filter_validation(self):
        for params in [
            {"active": "maybe"},
            {"maintenanceFrom": "wrong"},
            {"office": "missing"},
            {"maintenanceFrom": "2025-02-01", "maintenanceTo": "2025-01-01"},
        ]:
            self.assertEqual(self.client.get("/api/vehicles/", params).status_code, 400)

    def test_details_have_constant_query_count_with_hundreds_of_records(self):
        MaintenanceRecord.objects.bulk_create(
            [
                MaintenanceRecord(
                    vehicle=self.vehicle,
                    mechanic=self.mechanic,
                    maintenance_date=self.today - timedelta(days=i),
                    maintenance_type="inspection",
                    cost=1,
                )
                for i in range(300)
            ]
        )
        with self.assertNumQueries(2):
            result = self.client.get(f"/api/vehicles/{self.vehicle.pk}/")
        self.assertEqual(len(result.data["maintenance_history"]), 300)
        self.assertEqual(result.data["maintenance_history"][0]["mechanic_detail"]["name"], "Alex")
        history = self.client.get(f"/api/vehicles/{self.vehicle.pk}/history/")
        self.assertEqual(history.data["count"], 300)
        self.assertEqual(len(history.data["results"]), 12)
        self.assertEqual(history.data["results"][0]["maintenance_date"], str(self.today))

    def test_assign_changes_only_office(self):
        record = self.record()
        result = self.client.post(
            f"/api/vehicles/{self.vehicle.pk}/assign/", {"office": self.other.pk}
        )
        self.assertEqual(result.status_code, 200)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.office_id, self.other.pk)
        self.assertEqual(self.vehicle.vin, "1FTBR1C80PK000001")
        record.refresh_from_db()
        self.assertEqual(record.vehicle_id, self.vehicle.pk)
        self.assertEqual(
            self.client.post(
                f"/api/vehicles/{self.vehicle.pk}/assign/", {"office": 99999}
            ).status_code,
            400,
        )

    def test_workload_current_year(self):
        self.record()
        record = self.record()
        record.maintenance_date = self.today.replace(year=self.today.year - 1, month=12, day=31)
        record.save()
        Mechanic.objects.create(name="Idle", certification_number="IDLE")
        with self.assertNumQueries(1):
            result = self.client.get("/api/mechanics/workload/")
        self.assertEqual(result.data[0]["maintenance_count"], 1)
        self.assertEqual(result.data[0]["total_cost"], "100.00")
        self.assertEqual(result.data[1]["maintenance_count"], 0)

    def test_due_boundary_and_never_serviced_first(self):
        self.record(days=365)
        self.assertEqual(self.client.get("/api/vehicles/needing-maintenance/").data["count"], 0)
        MaintenanceRecord.objects.all().delete()
        self.record(days=366)
        never = Vehicle.objects.create(
            vin="1FTBR1C80PK000002",
            license_plate="BB-2",
            make="Ford",
            model="Transit",
            year=2023,
            office=self.office,
        )
        result = self.client.get("/api/vehicles/needing-maintenance/")
        self.assertEqual(result.data["count"], 2)
        self.assertEqual(result.data["results"][0]["id"], never.pk)
        never.active = False
        never.save()
        self.assertEqual(self.client.get("/api/vehicles/needing-maintenance/").data["count"], 1)

    def test_duplicate_check_excludes_self_and_inactive_plate(self):
        params = {"vin": self.vehicle.vin.lower(), "license_plate": "ab-100"}
        self.assertEqual(
            self.client.get("/api/vehicles/duplicate-check/", params).data["conflicts"],
            ["vin", "license_plate"],
        )
        params["exclude_id"] = self.vehicle.pk
        self.assertEqual(
            self.client.get("/api/vehicles/duplicate-check/", params).data["conflicts"], []
        )
        params.pop("exclude_id")
        params["active"] = "false"
        self.assertEqual(
            self.client.get("/api/vehicles/duplicate-check/", params).data["conflicts"], ["vin"]
        )

    def test_viewer_cannot_mutate(self):
        self.user.is_staff = False
        self.user.save()
        self.assertEqual(self.client.get("/api/vehicles/").status_code, 200)
        self.assertEqual(
            self.client.post("/api/offices/", {"name": "X", "city": "Y"}).status_code, 403
        )
        self.assertEqual(
            self.client.post(
                f"/api/vehicles/{self.vehicle.pk}/assign/", {"office": self.other.pk}
            ).status_code,
            403,
        )
        self.assertEqual(self.client.delete(f"/api/vehicles/{self.vehicle.pk}/").status_code, 403)

    def test_page_size_is_bounded_and_missing_record_is_404(self):
        self.assertEqual(self.client.get("/api/vehicles/999999/").status_code, 404)
        self.assertEqual(self.client.get("/api/vehicles/", {"page": 999}).status_code, 404)
        self.assertEqual(self.client.get("/api/vehicles/", {"pageSize": 9999}).status_code, 200)


class CalendarTests(TestCase):
    def test_calendar_year_and_leap_day(self):
        self.assertEqual(year_ago(date(2024, 2, 29)), date(2023, 2, 28))
        self.assertEqual(year_ago(date(2025, 3, 1)), date(2024, 3, 1))
