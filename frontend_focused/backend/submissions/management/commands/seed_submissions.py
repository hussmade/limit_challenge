import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from submissions.models import Broker, Company, Contact, Document, Note, Submission, TeamMember


class Command(BaseCommand):
    help = "Seed deterministic sample submissions and optional local demo users."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true", help="Replace demo domain data (development only)."
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Demo seeding is disabled outside development.")
        if options["force"]:
            Submission.objects.all().delete()
            Broker.objects.all().delete()
            Company.objects.all().delete()
            TeamMember.objects.all().delete()
        if Submission.objects.exists():
            self.stdout.write("Submissions already exist; left them unchanged.")
        else:
            brokers = [
                Broker.objects.create(name=name, primary_contact_email=f"broker{i}@example.com")
                for i, name in enumerate(
                    [
                        "Meridian Risk Partners",
                        "Northstar Brokerage",
                        "Atlas Insurance Group",
                        "Bridgepoint Advisors",
                        "Cedar & Co.",
                    ]
                )
            ]
            owners = [
                TeamMember.objects.create(full_name=name, email=f"owner{i}@example.com")
                for i, name in enumerate(
                    ["Alex Morgan", "Sarah Chen", "Jordan Davis", "Priya Shah"]
                )
            ]
            businesses = [
                ("Evergreen Logistics", "Transportation", "Portland"),
                ("Nova Health Systems", "Healthcare", "Boston"),
                ("Summit Manufacturing", "Manufacturing", "Detroit"),
                ("Harbor & Field", "Hospitality", "San Diego"),
                ("Orion Technologies", "Technology", "Austin"),
                ("Bluebird Foods", "Food & beverage", "Chicago"),
                ("Stonebridge Construction", "Construction", "Denver"),
                ("Acorn Retail Group", "Retail", "Seattle"),
                ("Clearwater Energy", "Energy", "Houston"),
                ("Lumen Creative", "Professional services", "New York"),
            ]
            now = timezone.now()
            for i in range(30):
                name, industry, city = businesses[i % 10]
                company, _ = Company.objects.get_or_create(
                    legal_name=name, defaults={"industry": industry, "headquarters_city": city}
                )
                submission = Submission.objects.create(
                    company=company,
                    broker=brokers[i % 5],
                    owner=owners[i % 4],
                    status=["new", "in_review", "new", "closed", "lost", "in_review"][i % 6],
                    priority=["high", "medium", "low"][i % 3],
                    summary=f"{name} is reviewing its annual coverage for {industry.lower()} operations. The broker has requested an assessment of current exposure, coverage limits and renewal terms. Please review the supporting materials and confirm any outstanding information before proceeding.",
                    created_at=now - timedelta(days=i * 2, hours=i),
                )
                Contact.objects.create(
                    submission=submission,
                    name=["Taylor Reed", "Jamie Park", "Casey Adams"][i % 3],
                    role="Operations director",
                    email=f"contact{i}@example.com",
                    phone=f"+1 202 555 {100 + i:04d}",
                )
                if i % 5 != 0:
                    for j, title in enumerate(
                        ["Company overview", "Coverage requirements", "Loss history"][: 1 + i % 3]
                    ):
                        document = Document.objects.create(
                            submission=submission,
                            title=title,
                            doc_type=["Summary", "Schedule", "Report"][j],
                            sample_content=f"""DEMONSTRATION DOCUMENT — not a real insurance record

{title}
{name}

Prepared for the Limit challenge sample dataset.
Industry: {industry}
Headquarters: {city}

This file demonstrates an authenticated document download.
""",
                        )
                        Document.objects.filter(pk=document.pk).update(
                            uploaded_at=submission.created_at + timedelta(hours=j + 1)
                        )
                if i % 4 != 0:
                    for j, body in enumerate(
                        [
                            "Initial submission received. Checking the application against our review requirements.",
                            "Broker confirmed the operating locations. Loss history is ready for review.",
                            "Coverage details reviewed with the owner. Follow up on the renewal timeline before closing.",
                        ][: 1 + i % 3]
                    ):
                        Note.objects.create(
                            submission=submission,
                            author_name=owners[(i + j) % 4].full_name,
                            body=body,
                            created_at=submission.created_at + timedelta(hours=j + 2),
                        )
            self.stdout.write(
                self.style.SUCCESS(
                    "Created 30 submissions with contacts, downloadable sample documents and notes."
                )
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
