from datetime import UTC, datetime

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from submissions.models import Broker, Company, Contact, Document, Note, Submission, TeamMember


class SubmissionTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("reviewer")
        self.client.force_authenticate(self.user)
        self.broker = Broker.objects.create(name="Meridian")
        self.company = Company.objects.create(
            legal_name="Evergreen Logistics", industry="Transport", headquarters_city="Portland"
        )
        self.owner = TeamMember.objects.create(full_name="Alex", email="alex@example.com")
        self.submission = Submission.objects.create(
            company=self.company,
            broker=self.broker,
            owner=self.owner,
            status="new",
            priority="high",
            created_at=datetime(2025, 6, 12, 23, 59, tzinfo=UTC),
        )
        self.other = Submission.objects.create(
            company=self.company,
            broker=self.broker,
            owner=self.owner,
            status="closed",
            priority="low",
            created_at=datetime(2025, 6, 13, tzinfo=UTC),
        )

    def note(self, body="Reviewing", **kwargs):
        return Note.objects.create(
            submission=self.submission, author_name="Alex", body=body, **kwargs
        )

    def document(self, **kwargs):
        return Document.objects.create(
            submission=self.submission, title="Overview", doc_type="Summary", **kwargs
        )

    def test_list_shape_counts_and_latest_note_without_join_multiplication(self):
        self.document()
        self.document()
        self.note("First", created_at=datetime(2025, 6, 12, tzinfo=UTC))
        self.note("Latest", created_at=datetime(2025, 6, 13, tzinfo=UTC))
        self.note("Tie winner", created_at=datetime(2025, 6, 13, tzinfo=UTC))
        with self.assertNumQueries(2):
            response = self.client.get("/api/submissions/")
        row = next(r for r in response.data["results"] if r["id"] == self.submission.pk)
        self.assertEqual(row["company"]["legalName"], "Evergreen Logistics")
        self.assertEqual(row["documentCount"], 2)
        self.assertEqual(row["noteCount"], 3)
        self.assertEqual(row["latestNote"]["bodyPreview"], "Tie winner")
        empty = next(r for r in response.data["results"] if r["id"] == self.other.pk)
        self.assertIsNone(empty["latestNote"])

    def test_combined_filters(self):
        self.document()
        self.note()
        params = {
            "status": "new",
            "priority": "high",
            "brokerId": self.broker.pk,
            "companySearch": "EVERGREEN",
            "createdFrom": "2025-06-12",
            "createdTo": "2025-06-12",
            "hasDocuments": "true",
            "hasNotes": "true",
        }
        response = self.client.get("/api/submissions/", params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.submission.pk)
        params["companySearch"] = "missing"
        self.assertEqual(self.client.get("/api/submissions/", params).data["count"], 0)

    def test_absence_filters(self):
        self.document()
        self.note()
        response = self.client.get(
            "/api/submissions/", {"hasDocuments": "false", "hasNotes": "false"}
        )
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.other.pk)

    def test_invalid_filters_return_helpful_errors(self):
        for key, value in [
            ("status", "bad"),
            ("brokerId", "bad"),
            ("createdFrom", "bad"),
            ("hasDocuments", "perhaps"),
            ("ordering", "secret"),
            ("priority", "urgent"),
        ]:
            response = self.client.get("/api/submissions/", {key: value})
            self.assertEqual(response.status_code, 400, key)
            self.assertIn(key, response.data)
        self.assertEqual(
            self.client.get(
                "/api/submissions/", {"createdFrom": "2025-06-13", "createdTo": "2025-06-12"}
            ).status_code,
            400,
        )

    def test_detail_relations_constant_query_count(self):
        Contact.objects.create(submission=self.submission, name="Taylor")
        for _ in range(20):
            self.note()
            self.document()
        with self.assertNumQueries(4):
            response = self.client.get(f"/api/submissions/{self.submission.pk}/")
        self.assertEqual(len(response.data["notes"]), 20)
        self.assertEqual(len(response.data["documents"]), 20)
        self.assertEqual(response.data["contacts"][0]["name"], "Taylor")

    def test_broker_options_and_summary(self):
        self.assertEqual(self.client.get("/api/brokers/").data[0]["name"], "Meridian")
        response = self.client.get("/api/submissions/summary/")
        self.assertEqual(
            response.data, {"total": 2, "new": 1, "in_review": 0, "closed": 1, "lost": 0}
        )

    def test_ordering_and_pagination(self):
        self.assertEqual(
            self.client.get("/api/submissions/", {"ordering": "priority"}).data["results"][0]["id"],
            self.submission.pk,
        )
        first = self.client.get("/api/submissions/", {"pageSize": 1}).data
        second = self.client.get("/api/submissions/", {"pageSize": 1, "page": 2}).data
        self.assertNotEqual(first["results"][0]["id"], second["results"][0]["id"])
        self.assertIsNotNone(first["next"])

    def test_endpoints_are_read_only(self):
        self.assertEqual(self.client.post("/api/submissions/", {}).status_code, 405)
        self.assertEqual(
            self.client.patch(
                f"/api/submissions/{self.submission.pk}/", {"status": "closed"}
            ).status_code,
            405,
        )
        self.assertEqual(
            self.client.delete(f"/api/submissions/{self.submission.pk}/").status_code, 405
        )

    def test_download_is_attachment_and_requires_auth(self):
        document = self.document(sample_content="DEMONSTRATION DOCUMENT")
        url = f"/api/documents/{document.pk}/download/"
        result = self.client.get(url)
        self.assertEqual(result.status_code, 200)
        self.assertIn("attachment", result["Content-Disposition"])
        self.assertEqual(result["X-Content-Type-Options"], "nosniff")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.get("/api/submissions/").status_code, 401)

    def test_missing_detail_and_external_download(self):
        self.assertEqual(self.client.get("/api/submissions/99999/").status_code, 404)
        document = self.document(file_url="https://example.com/example.pdf")
        self.assertEqual(
            self.client.get(f"/api/documents/{document.pk}/download/").status_code, 404
        )
