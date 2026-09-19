export type UserRole = "ADMIN" | "SCHOOL" | "JUDGE";

export interface CurrentUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  school_id?: string | null;
}

export type CompetitionStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "APPLICATIONS_OPEN"
  | "APPLICATIONS_CLOSED"
  | "UNDER_REVIEW"
  | "JUDGING_OPEN"
  | "JUDGING_CLOSED"
  | "RESULTS_FINALIZED"
  | "ARCHIVED";

export interface Competition {
  id: string;
  name: string;
  description: string;
  theme: string;
  eligibility: string;
  status: CompetitionStatus;
  max_participants: number;
  registered_count: number;
  spaces_remaining: number;
  application_open_date: string | null;
  application_close_date: string | null;
  judging_open_date: string | null;
  judging_close_date: string | null;
  created_at: string;
}

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "JUDGING"
  | "COMPLETED";

export interface TeamMember {
  id?: string;
  name: string;
  grade: string;
  role: string;
}

export interface Application {
  id: string;
  competition_id: string;
  school_id: string;
  project_title: string;
  problem_description: string;
  solution_description: string;
  innovation_description: string;
  impact_description: string;
  implementation_plan: string;
  technology_used: string;
  category: string;
  teacher_coordinator: string;
  status: ApplicationStatus;
  review_notes: string;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string;
  team_members: TeamMember[];
}

export interface ResourceItem {
  id: string;
  application_id: string;
  resource_type: "DOCUMENT" | "PRESENTATION" | "IMAGE" | "VIDEO" | "OTHER";
  original_filename: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  upload_status: string;
  ai_analysis_status: string;
  created_at: string;
}

export interface AIAnalysisRecord {
  id: string;
  resource_id: string;
  analysis_type: string;
  status: string;
  confidence: number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | null;
  analysis_summary: string;
  provider: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string;
  created_at: string;
  completed_at: string | null;
}

export interface AIResourceReportItem {
  resource_id: string;
  filename: string;
  resource_type: "DOCUMENT" | "PRESENTATION" | "IMAGE" | "VIDEO" | "OTHER";
  ai_status: string;
  latest_analysis: AIAnalysisRecord | null;
}

export interface AIApplicationReport {
  application_id: string;
  overall_risk: "LOW" | "MEDIUM" | "HIGH" | null;
  items: AIResourceReportItem[];
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  minimum_score: number;
  maximum_score: number;
  display_order: number;
}

export interface Rubric {
  id: string;
  competition_id: string;
  name: string;
  active: boolean;
  criteria: RubricCriterion[];
}

export interface EvaluationScoreItem {
  criterion_id: string;
  score: number;
  weighted_contribution: number;
}

export interface Evaluation {
  id: string;
  competition_id: string;
  application_id: string;
  status: "DRAFT" | "SUBMITTED";
  weighted_total: number | null;
  strengths: string;
  improvements: string;
  comments: string;
  submitted_at: string | null;
  last_saved_at: string;
  scores: EvaluationScoreItem[];
}
