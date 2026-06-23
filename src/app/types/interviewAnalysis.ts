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

export interface TranslatedInterviewQuestion {
  id: string;
  prompt_conduct: string;
  hint_conduct?: string | null;
  section_conduct?: string | null;
}

export interface QuestionTranslationResult {
  questions: TranslatedInterviewQuestion[];
  source: "fake" | "ollama" | "nim";
}

export interface AnalyzeInterviewResponse {
  coverage: QuestionCoverage[];
  follow_ups: FollowUpSuggestion[];
  source: "fake" | "ollama" | "nim";
}
