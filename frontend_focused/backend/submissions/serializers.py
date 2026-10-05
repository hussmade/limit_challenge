from rest_framework import serializers

from .models import Broker, Company, Contact, Document, Note, Submission, TeamMember


class BrokerSerializer(serializers.ModelSerializer):
    primaryContactEmail = serializers.EmailField(source="primary_contact_email")

    class Meta:
        model = Broker
        fields = ["id", "name", "primaryContactEmail"]


class CompanySerializer(serializers.ModelSerializer):
    legalName = serializers.CharField(source="legal_name")
    headquartersCity = serializers.CharField(source="headquarters_city")

    class Meta:
        model = Company
        fields = ["id", "legalName", "industry", "headquartersCity"]


class OwnerSerializer(serializers.ModelSerializer):
    fullName = serializers.CharField(source="full_name")

    class Meta:
        model = TeamMember
        fields = ["id", "fullName", "email"]


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ["id", "name", "role", "email", "phone"]


class DocumentSerializer(serializers.ModelSerializer):
    docType = serializers.CharField(source="doc_type")
    uploadedAt = serializers.DateTimeField(source="uploaded_at")
    fileUrl = serializers.URLField(source="file_url")
    downloadUrl = serializers.SerializerMethodField()

    def get_downloadUrl(self, obj):
        return f"/api/documents/{obj.pk}/download/" if obj.sample_content else None

    class Meta:
        model = Document
        fields = ["id", "title", "docType", "uploadedAt", "fileUrl", "downloadUrl"]


class NoteSerializer(serializers.ModelSerializer):
    authorName = serializers.CharField(source="author_name")
    createdAt = serializers.DateTimeField(source="created_at")

    class Meta:
        model = Note
        fields = ["id", "authorName", "body", "createdAt"]


class SubmissionBaseSerializer(serializers.ModelSerializer):
    company = CompanySerializer()
    broker = BrokerSerializer()
    owner = OwnerSerializer()
    createdAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")

    class Meta:
        model = Submission
        fields = [
            "id",
            "company",
            "broker",
            "owner",
            "status",
            "priority",
            "summary",
            "createdAt",
            "updatedAt",
        ]


class SubmissionListSerializer(SubmissionBaseSerializer):
    documentCount = serializers.IntegerField(source="document_count")
    noteCount = serializers.IntegerField(source="note_count")
    latestNote = serializers.SerializerMethodField()

    def get_latestNote(self, obj):
        if obj.latest_note_at is None:
            return None
        return {
            "authorName": obj.latest_note_author,
            "bodyPreview": obj.latest_note_body[:180],
            "createdAt": serializers.DateTimeField().to_representation(obj.latest_note_at),
        }

    class Meta(SubmissionBaseSerializer.Meta):
        fields = [*SubmissionBaseSerializer.Meta.fields, "documentCount", "noteCount", "latestNote"]


class SubmissionDetailSerializer(SubmissionBaseSerializer):
    contacts = ContactSerializer(many=True)
    documents = DocumentSerializer(many=True)
    notes = NoteSerializer(many=True)

    class Meta(SubmissionBaseSerializer.Meta):
        fields = [*SubmissionBaseSerializer.Meta.fields, "contacts", "documents", "notes"]
