import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SCHOOL = "SCHOOL"
    JUDGE = "JUDGE"


class CompetitionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    APPLICATIONS_OPEN = "APPLICATIONS_OPEN"
    APPLICATIONS_CLOSED = "APPLICATIONS_CLOSED"
    UNDER_REVIEW = "UNDER_REVIEW"
    JUDGING_OPEN = "JUDGING_OPEN"
    JUDGING_CLOSED = "JUDGING_CLOSED"
    RESULTS_FINALIZED = "RESULTS_FINALIZED"
    ARCHIVED = "ARCHIVED"


class ParticipantStatus(str, enum.Enum):
    JOINED = "JOINED"
    WITHDRAWN = "WITHDRAWN"


class ApplicationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    JUDGING = "JUDGING"
    COMPLETED = "COMPLETED"


class ResourceType(str, enum.Enum):
    DOCUMENT = "DOCUMENT"
    PRESENTATION = "PRESENTATION"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    OTHER = "OTHER"


class AIAnalysisStatus(str, enum.Enum):
    NOT_CHECKED = "NOT_CHECKED"
    PROCESSING = "PROCESSING"
    LOW_INDICATION = "LOW_INDICATION"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    REVIEWED = "REVIEWED"
    ERROR = "ERROR"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class EvaluationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
