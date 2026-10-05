from datetime import UTC, datetime, time, timedelta

from django.db.models import Exists, OuterRef
from rest_framework import serializers

from submissions.models import Broker, Document, Note, Submission


class SubmissionFilters(serializers.Serializer):
    status = serializers.ChoiceField(choices=Submission.Status.choices, required=False)
    priority = serializers.ChoiceField(choices=Submission.Priority.choices, required=False)
    brokerId = serializers.PrimaryKeyRelatedField(queryset=Broker.objects.all(), required=False)
    companySearch = serializers.CharField(max_length=255, required=False)
    createdFrom = serializers.DateField(required=False)
    createdTo = serializers.DateField(required=False)
    hasDocuments = serializers.BooleanField(required=False)
    hasNotes = serializers.BooleanField(required=False)
    ordering = serializers.ChoiceField(
        choices=["-createdAt", "createdAt", "company", "priority"], default="-createdAt"
    )

    def validate(self, values):
        if (
            values.get("createdFrom")
            and values.get("createdTo")
            and values["createdFrom"] > values["createdTo"]
        ):
            raise serializers.ValidationError(
                {"createdTo": "End date must be on or after start date."}
            )
        return values

    def apply(self, queryset):
        self.is_valid(raise_exception=True)
        data = self.validated_data
        for name in ["status", "priority"]:
            if name in data:
                queryset = queryset.filter(**{name: data[name]})
        if "brokerId" in data:
            queryset = queryset.filter(broker=data["brokerId"])
        if "companySearch" in data:
            queryset = queryset.filter(company__legal_name__icontains=data["companySearch"])
        if "createdFrom" in data:
            queryset = queryset.filter(
                created_at__gte=datetime.combine(data["createdFrom"], time.min, tzinfo=UTC)
            )
        if "createdTo" in data:
            # An exclusive next-day boundary includes the entire chosen UTC date.
            date = data["createdTo"]
            if date.year == 9999 and date.month == 12 and date.day == 31:
                raise serializers.ValidationError({"createdTo": "Choose a date before 9999-12-31."})
            queryset = queryset.filter(
                created_at__lt=datetime.combine(date + timedelta(days=1), time.min, tzinfo=UTC)
            )
        for param, model in [("hasDocuments", Document), ("hasNotes", Note)]:
            if param in data:
                exists = Exists(model.objects.filter(submission_id=OuterRef("pk")))
                queryset = queryset.filter(exists if data[param] else ~exists)
        ordering = {
            "-createdAt": "-created_at",
            "createdAt": "created_at",
            "company": "company__legal_name",
            "priority": "priority_rank",
        }[data["ordering"]]
        return queryset.order_by(ordering, "-id")
