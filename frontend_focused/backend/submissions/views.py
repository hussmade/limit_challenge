from django.db.models import Case, Count, IntegerField, OuterRef, Subquery, Value, When
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters.submission import SubmissionFilters
from .models import Broker, Document, Note, Submission
from .serializers import BrokerSerializer, SubmissionDetailSerializer, SubmissionListSerializer


def related_count(model):
    counts = (
        model.objects.filter(submission_id=OuterRef("pk"))
        .order_by()
        .values("submission_id")
        .annotate(total=Count("pk"))
        .values("total")
    )
    return Coalesce(Subquery(counts, output_field=IntegerField()), Value(0))


class SubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    def get_queryset(self):
        query = Submission.objects.select_related("company", "broker", "owner")
        if self.action == "retrieve":
            return query.prefetch_related("contacts", "documents", "notes")
        latest = Note.objects.filter(submission_id=OuterRef("pk")).order_by("-created_at", "-id")
        return query.annotate(
            document_count=related_count(Document),
            note_count=related_count(Note),
            latest_note_at=Subquery(latest.values("created_at")[:1]),
            latest_note_author=Subquery(latest.values("author_name")[:1]),
            latest_note_body=Subquery(latest.values("body")[:1]),
            priority_rank=Case(
                When(priority="high", then=Value(0)),
                When(priority="medium", then=Value(1)),
                default=Value(2),
                output_field=IntegerField(),
            ),
        )

    def get_serializer_class(self):
        return SubmissionDetailSerializer if self.action == "retrieve" else SubmissionListSerializer

    def filter_queryset(self, queryset):
        return (
            SubmissionFilters(data=self.request.query_params.dict()).apply(queryset)
            if self.action == "list"
            else queryset
        )

    @action(detail=False, pagination_class=None)
    def summary(self, request):
        counts = dict(Submission.objects.values_list("status").annotate(total=Count("id")))
        return Response(
            {
                "total": sum(counts.values()),
                **{status: counts.get(status, 0) for status in Submission.Status.values},
            }
        )


class BrokerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Broker.objects.all()
    serializer_class = BrokerSerializer
    pagination_class = None
    http_method_names = ["get", "head", "options"]


class DocumentDownloadView(APIView):
    def get(self, request, pk):
        document = get_object_or_404(Document, pk=pk)
        if not document.sample_content:
            return Response(
                {"detail": "This document is held by an external provider."}, status=404
            )
        response = HttpResponse(document.sample_content, content_type="text/plain; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="sample-document-{document.pk}.txt"'
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response
