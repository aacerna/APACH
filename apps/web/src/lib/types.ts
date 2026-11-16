export type Role = "ADMIN" | "TEACHER" | "STUDENT";
export type User = {
  id: number; email: string; first_name: string; last_name: string; full_name: string; role: Role;
  is_active: boolean; must_change_password: boolean; program: { id: number; code: string; name: string } | null; created_at: string;
};
export type Program = { id: number; code: string; name: string; active: boolean };
export type Term = { id: number; code: string; name: string; start_date: string; end_date: string; active: boolean };
export type Course = { id: number; code: string; name: string; program_id: number; active: boolean; program: { id: number; code: string; name: string } };
export type Section = { id: number; code: string; active: boolean; course: Course; term: Term; teachers: string[]; student_count: number | null };
export type Counts = { errors: number; possible_problems: number; needs_teacher: number; not_verifiable: number };
export type DocumentItem = {
  id: number; original_filename: string; size_bytes: number; sha256: string; status: "UPLOADED" | "ANALYZING" | "ANALYZED" | "FAILED";
  review_status: "PENDING" | "REVIEWED"; created_at: string; updated_at: string; section_id: number; section_label: string;
  student_id: number; student_name: string; latest_counts: Counts | null; comment_count: number;
};
export type Severity = "ERROR" | "POSSIBLE_PROBLEM" | "NEEDS_TEACHER";
export type Verification = "CHECKED" | "NOT_VERIFIABLE" | "NOT_APPLICABLE";
export type Finding = {
  id: number; rule_code: string; severity: Severity; verification_status: Verification; message: string;
  evidence: Record<string, unknown>; location: { paragraph_index?: number; section_index?: number; excerpt?: string; region?: string };
  suggestion: string; guide_slug: string | null; rule_set_version: string;
};
export type RuleOutcome = { code: string; outcome: "PASSED" | "FINDINGS" | "NOT_APPLICABLE" | "NOT_VERIFIABLE"; checked_items: number; findings: number; note: string };
export type Analysis = {
  run_id: number; document_id: number; status: "RUNNING" | "COMPLETED" | "FAILED"; rule_set_version: string; started_at: string;
  finished_at: string | null; error_message: string | null;
  summary: { counts?: Counts; rules?: RuleOutcome[]; document?: Record<string, number | boolean>; limitations?: string[]; enabled_rules?: string[] };
  findings: Finding[];
};
export type RunItem = { id: number; status: string; rule_set_version: string; started_at: string; counts: Counts | null };
export type Comment = { id: number; document_id: number; teacher_id: number; teacher_name: string; body: string; created_at: string; updated_at: string };
export type Rule = { id: number; code: string; name: string; description: string; scope: "GENERAL" | "ECC"; version: string; enabled: boolean; implemented: boolean; guide_slug: string | null; source: string; effective_from: string | null };
export type Template = { id: number; name: string; description: string; program_id: number | null; program_name: string | null; template_type: string; url: string; active: boolean; updated_by: string | null; updated_at: string };
export type PublicSettings = { institutional_contact: string; welcome_video_url: string | null; ecc_guide_status: string; environment: string };
export type AccountLink = { user: User; purpose: string; expires_at: string; dev_link: string | null; notice: string };
export type Membership = { id: number; user_id: number; user_name: string; user_email: string; section_id: number; section_label: string };
export type FindingsByRule = { rule_code: string; verified_errors: number; possible_or_teacher: number; not_verifiable: number };
export type SectionStats = { students: number; documents: number; reviewed: number; pending: number; students_with_documents: number; findings_by_rule: FindingsByRule[]; disclaimer: string };
