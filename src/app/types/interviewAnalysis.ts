export type QuestionCoverageStatus = "answered" | "partial" | "unanswered" | "unclear";

export interface InterviewQuestionInput {
  id: string;
  prompt: string;
  hint?: string;
  section?: string;
}

export interface QuestionCoverage {
  id: string;
  status: QuestionCoverageStatus;
  evidence: string;
  confidence: number;
}

export interface FollowUpSuggestion {
  related_question_id: string | null;
  prompt: string;
  prompt_conduct: string;
  reason: string;
}

export interface AnalyzeInterviewResponse {
  coverage: QuestionCoverage[];
  follow_ups: FollowUpSuggestion[];
  source: "fake" | "ollama" | "nim";
}
