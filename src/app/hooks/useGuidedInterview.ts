import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInferenceJob, getInferenceJob } from "../lib/coordinatorApi";
import { createClientId } from "../lib/createClientId";
import { useMediaRecorder } from "./useMediaRecorder";
import { useRecordingTimer } from "./useRecordingTimer";
import { useInterviewAnalysis } from "./useInterviewAnalysis";
import {
  getLocalizedText,
  toEnglishQuestionInput,
  type LeadingQuestion,
} from "../constants/leadingQuestions";
import {
  randomDemoFollowUpDelayMs,
  randomDemoSeededTranscribeDelayMs,
} from "../lib/loadingTiming";
import { isInferenceConfigured, isCoordinatorConfigured } from "../types/inference";
import type {
  AnalyzeInterviewResponse,
  FollowUpSuggestion,
  QuestionCoverage,
} from "../types/interviewAnalysis";
import {
  buildTranscriptFromResponses,
  type InterviewLanguage,
  type QuestionResponse,
} from "../types/interviewee";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90;
const ANALYSIS_DEBOUNCE_MS = 800;
// Segments shorter than this (e.g. a skipped question) are treated as empty and
// not sent for transcription, to avoid wasting inference calls.
const SHORT_SEGMENT_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A question shown in the guided interview, display-ready in the conduct
 * language with English fallbacks. Set questions and AI follow-ups share this
 * shape so the queue can hold both. */
export interface GuidedQuestion {
  /** Unique within the session; also used as the QuestionResponse key. */
  itemId: string;
  /** Leading-question id, or generated id for a follow-up. */
  questionId: string;
  promptConduct: string;
  promptEnglish: string;
  hintConduct?: string;
  hintEnglish?: string;
  /** English section label (set questions only). */
  section?: string;
  isFollowUp: boolean;
  relatedQuestionId?: string | null;
  reason?: string;
}

export interface GuidedInterviewResult {
  transcriptOriginal: string;
  transcriptEnglish: string;
  questionResponses: QuestionResponse[];
  askedQuestionIds: string[];
  analysis: AnalyzeInterviewResponse | null;
}

export interface GuidedInterviewDemoMode {
  fixedAnswers: Record<string, { original: string; english: string }>;
  generateFollowUp?: (
    answers: Record<string, string>,
    lastQuestionId: string
  ) => { question: LeadingQuestion; demoAnswer: string } | null;
}

interface UseGuidedInterviewConfig {
  /** Leading questions for the selected set (already filtered, never "none"). */
  questions: LeadingQuestion[];
  interviewLanguage: InterviewLanguage;
  /** Existing per-question answers to resume from. */
  initialResponses?: QuestionResponse[];
  /** Animation-only recording with pre-seeded answers (no coordinator calls). */
  demoMode?: GuidedInterviewDemoMode;
}

function buildSetQueue(
  questions: LeadingQuestion[],
  language: InterviewLanguage
): GuidedQuestion[] {
  return questions.map((question) => ({
    itemId: question.id,
    questionId: question.id,
    promptConduct: getLocalizedText(question.prompt, language),
    promptEnglish: question.prompt.en,
    hintConduct: question.hint ? getLocalizedText(question.hint, language) : undefined,
    hintEnglish: question.hint?.en,
    section: question.section.en,
    isFollowUp: false,
    relatedQuestionId: null,
  }));
}

export function useGuidedInterview({
  questions,
  interviewLanguage,
  initialResponses,
  demoMode,
}: UseGuidedInterviewConfig) {
  const isDemoMode = Boolean(demoMode);
  const useLiveInference = isInferenceConfigured() && !isDemoMode;
  const useRecordingUi = useLiveInference || isDemoMode;
  const canAnalyze = isCoordinatorConfigured() && !isDemoMode;

  const {
    isRecording,
    isPaused,
    stream,
    pauseSupported,
    pause: pauseMedia,
    resume: resumeMedia,
    startContinuous,
    advanceSegment,
    stopContinuous,
  } = useMediaRecorder();
  const {
    recordingTime,
    start: startTimer,
    stop: stopTimer,
    pause: pauseTimer,
    resume: resumeTimer,
    formatTime,
  } = useRecordingTimer();
  const { runAnalysis } = useInterviewAnalysis();

  const [queue, setQueue] = useState<GuidedQuestion[]>(() =>
    buildSetQueue(questions, interviewLanguage)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>(
    () => {
      const seed: Record<string, QuestionResponse> = {};
      for (const response of initialResponses ?? []) {
        seed[response.questionId] = response;
      }
      return seed;
    }
  );
  const [transcribingItems, setTranscribingItems] = useState<Set<string>>(
    new Set()
  );
  // Questions that have been put to the interviewee (a segment was captured),
  // even if the transcript has not returned yet or came back empty.
  const [askedItems, setAskedItems] = useState<Set<string>>(new Set());
  const [coverage, setCoverage] = useState<Map<string, QuestionCoverage>>(
    new Map()
  );
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [analysisSource, setAnalysisSource] =
    useState<AnalyzeInterviewResponse["source"] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoRecording, setDemoRecording] = useState(false);
  const [demoPaused, setDemoPaused] = useState(false);

  // Refs so async continuations and debounced analysis see the latest state.
  const responsesRef = useRef(responses);
  responsesRef.current = responses;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisInFlightRef = useRef(false);
  const analysisDirtyRef = useRef(false);
  const cancelledRef = useRef(false);
  const demoFixedAnswersRef = useRef(demoMode?.fixedAnswers ?? {});
  const demoFollowUpsGeneratedRef = useRef(new Set<string>());
  // Wall-clock time the current continuous segment began recording, used to
  // gate out near-empty (skipped) segments.
  const segmentStartRef = useRef<number | null>(null);

  const analysisQuestions = useMemo(
    () => questions.map(toEnglishQuestionInput),
    [questions]
  );

  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    },
    []
  );

  useEffect(() => {
    demoFixedAnswersRef.current = { ...(demoMode?.fixedAnswers ?? {}) };
    demoFollowUpsGeneratedRef.current = new Set();
  }, [demoMode]);

  const setTranscribing = useCallback((itemId: string, active: boolean) => {
    setTranscribingItems((prev) => {
      const next = new Set(prev);
      if (active) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const mergeFollowUps = useCallback((incoming: FollowUpSuggestion[]) => {
    if (incoming.length === 0) return;
    setQueue((prevQueue) => {
      const existingPrompts = new Set(
        prevQueue.map((item) => item.promptConduct.trim().toLowerCase())
      );
      const additions: GuidedQuestion[] = [];
      for (const followUp of incoming) {
        const key = followUp.prompt_conduct.trim().toLowerCase();
        if (!key || existingPrompts.has(key)) continue;
        existingPrompts.add(key);
        additions.push({
          itemId: createClientId(),
          questionId: createClientId(),
          promptConduct: followUp.prompt_conduct,
          promptEnglish: followUp.prompt,
          isFollowUp: true,
          relatedQuestionId: followUp.related_question_id,
          reason: followUp.reason,
        });
      }
      return additions.length > 0 ? [...prevQueue, ...additions] : prevQueue;
    });
  }, []);

  const runAnalysisNow = useCallback(async () => {
    if (!canAnalyze || analysisQuestions.length === 0) return;
    if (analysisInFlightRef.current) {
      analysisDirtyRef.current = true;
      return;
    }
    const built = buildTranscriptFromResponses(
      Object.values(responsesRef.current)
    );
    const transcript = built.english.trim();
    if (!transcript) return;

    analysisInFlightRef.current = true;
    setIsAnalyzing(true);
    try {
      const result = await runAnalysis(
        transcript,
        analysisQuestions,
        interviewLanguage
      );
      if (cancelledRef.current) return;
      setCoverage(new Map(result.coverage.map((item) => [item.id, item])));
      setFollowUps(result.follow_ups);
      setAnalysisSource(result.source);
      mergeFollowUps(result.follow_ups);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Background analysis failed");
      }
    } finally {
      analysisInFlightRef.current = false;
      if (!cancelledRef.current) setIsAnalyzing(false);
      if (analysisDirtyRef.current && !cancelledRef.current) {
        analysisDirtyRef.current = false;
        void runAnalysisNow();
      }
    }
  }, [
    analysisQuestions,
    canAnalyze,
    interviewLanguage,
    mergeFollowUps,
    runAnalysis,
  ]);

  const scheduleAnalysis = useCallback(() => {
    if (!canAnalyze) return;
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    analysisTimerRef.current = setTimeout(() => {
      void runAnalysisNow();
    }, ANALYSIS_DEBOUNCE_MS);
  }, [canAnalyze, runAnalysisNow]);

  const appendDemoFollowUp = useCallback(
    async (item: GuidedQuestion, answersByQuestionId: Record<string, string>) => {
      if (!isDemoMode || item.isFollowUp || !demoMode?.generateFollowUp) return;
      if (demoFollowUpsGeneratedRef.current.has(item.questionId)) return;

      const result = demoMode.generateFollowUp(
        answersByQuestionId,
        item.questionId
      );
      if (!result) return;

      demoFollowUpsGeneratedRef.current.add(item.questionId);

      const itemId = createClientId();
      const guidedQuestion: GuidedQuestion = {
        itemId,
        questionId: result.question.id,
        promptConduct: getLocalizedText(result.question.prompt, interviewLanguage),
        promptEnglish: result.question.prompt.en,
        hintConduct: result.question.hint
          ? getLocalizedText(result.question.hint, interviewLanguage)
          : undefined,
        hintEnglish: result.question.hint?.en,
        section: result.question.section.en,
        isFollowUp: true,
        relatedQuestionId: item.questionId,
        reason: "Generated from previous answer",
      };

      demoFixedAnswersRef.current[itemId] = {
        original: result.demoAnswer,
        english: result.demoAnswer,
      };

      setIsAnalyzing(true);
      try {
        await sleep(randomDemoFollowUpDelayMs());
        if (cancelledRef.current) return;
        setQueue((prevQueue) => [...prevQueue, guidedQuestion]);
      } finally {
        if (!cancelledRef.current) setIsAnalyzing(false);
      }
    },
    [demoMode, interviewLanguage, isDemoMode]
  );

  const applyAnswer = useCallback(
    (item: GuidedQuestion, original: string, english: string, jobId?: string) => {
      setResponses((prev) => ({
        ...prev,
        [item.itemId]: {
          questionId: item.itemId,
          promptEnglish: item.promptEnglish,
          transcriptOriginal: original,
          transcriptEnglish: english,
          jobId,
          isFollowUp: item.isFollowUp,
        },
      }));

      if (isDemoMode && !item.isFollowUp) {
        const answersByQuestionId: Record<string, string> = {};
        for (const queueItem of queueRef.current) {
          if (queueItem.isFollowUp) continue;
          const response = responsesRef.current[queueItem.itemId];
          const text =
            queueItem.itemId === item.itemId
              ? english
              : response?.transcriptEnglish.trim() ||
                response?.transcriptOriginal.trim() ||
                "";
          if (text) answersByQuestionId[queueItem.questionId] = text;
        }
        void appendDemoFollowUp(item, answersByQuestionId);
      }

      if (!isDemoMode) scheduleAnalysis();
    },
    [appendDemoFollowUp, isDemoMode, scheduleAnalysis]
  );

  const injectDemoAnswer = useCallback(
    async (item: GuidedQuestion) => {
      const fixed = demoFixedAnswersRef.current[item.itemId];
      if (!fixed) return;
      setTranscribing(item.itemId, true);
      setError(null);
      try {
        await sleep(randomDemoSeededTranscribeDelayMs());
        if (cancelledRef.current) return;
        applyAnswer(item, fixed.original, fixed.english);
      } finally {
        if (!cancelledRef.current) setTranscribing(item.itemId, false);
      }
    },
    [applyAnswer, demoMode, setTranscribing]
  );

  const transcribeSegment = useCallback(
    async (item: GuidedQuestion, blob: Blob) => {
      setTranscribing(item.itemId, true);
      setError(null);
      try {
        const created = await createInferenceJob(
          blob,
          "interview",
          undefined,
          interviewLanguage
        );
        let job = created;
        for (let i = 0; i < MAX_POLLS; i += 1) {
          if (job.status === "transcribed" || job.status === "failed") break;
          await sleep(POLL_INTERVAL_MS);
          if (cancelledRef.current) return;
          job = await getInferenceJob(created.id);
        }
        if (job.status === "failed") {
          throw new Error(job.error ?? "Transcription failed");
        }
        if (job.status !== "transcribed") {
          throw new Error("Transcription timed out");
        }
        const english = (job.transcript_english ?? job.transcript ?? "").trim();
        const original = (job.transcript_original ?? english).trim();
        if (cancelledRef.current) return;
        applyAnswer(item, original, english, job.id);
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        }
        throw err;
      } finally {
        if (!cancelledRef.current) setTranscribing(item.itemId, false);
      }
    },
    [applyAnswer, interviewLanguage, setTranscribing]
  );

  const markAsked = useCallback((itemId: string) => {
    setAskedItems((prev) => {
      if (prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }, []);

  /** Mark a finished segment as asked and, unless it was too short to contain
   * speech, transcribe (and analyse) it in the background. */
  const finalizeSegment = useCallback(
    (item: GuidedQuestion, blob: Blob, startedAt: number | null) => {
      markAsked(item.itemId);
      const durationMs = startedAt ? Date.now() - startedAt : 0;
      if (durationMs < SHORT_SEGMENT_MS) return;
      if (isDemoMode) {
        void injectDemoAnswer(item);
        return;
      }
      if (blob.size === 0) return;
      void transcribeSegment(item, blob).catch(() => {});
    },
    [injectDemoAnswer, isDemoMode, markAsked, transcribeSegment]
  );

  const startRecording = useCallback(async () => {
    if (isDemoMode) {
      startTimer();
      setDemoRecording(true);
      setDemoPaused(false);
      segmentStartRef.current = Date.now();
      return;
    }
    if (!useLiveInference) return;
    await startContinuous();
    startTimer();
    segmentStartRef.current = Date.now();
  }, [isDemoMode, startContinuous, startTimer, useLiveInference]);

  const pauseRecording = useCallback(() => {
    if (isDemoMode) {
      if (demoPaused) {
        resumeTimer();
        setDemoPaused(false);
      } else {
        pauseTimer();
        setDemoPaused(true);
      }
      return;
    }
    if (isPaused) {
      resumeMedia();
      resumeTimer();
    } else {
      pauseMedia();
      pauseTimer();
    }
  }, [demoPaused, isDemoMode, isPaused, pauseMedia, pauseTimer, resumeMedia, resumeTimer]);

  /** Close the current answer's segment and advance to the next question while
   * keeping the mic live (no re-prompt, no re-pressing record). */
  const advanceRecording = useCallback(async () => {
    const index = currentIndexRef.current;
    const item = queueRef.current[index];
    const startedAt = segmentStartRef.current;

    if (isDemoMode) {
      segmentStartRef.current = Date.now();
      if (item) finalizeSegment(item, new Blob(), startedAt);
      if (index < queueRef.current.length - 1) {
        setCurrentIndex(index + 1);
      }
      return;
    }

    let blob: Blob;
    try {
      blob = await advanceSegment();
    } catch {
      return;
    }
    segmentStartRef.current = Date.now();
    if (item) finalizeSegment(item, blob, startedAt);
    if (index < queueRef.current.length - 1) {
      setCurrentIndex(index + 1);
    }
  }, [advanceSegment, finalizeSegment, isDemoMode]);

  /** Skip the current question: roll the segment boundary and discard the
   * captured audio (no transcription) while keeping the mic live, then advance
   * to the next question. */
  const skipRecording = useCallback(async () => {
    const index = currentIndexRef.current;

    if (isDemoMode) {
      segmentStartRef.current = Date.now();
      if (index < queueRef.current.length - 1) {
        setCurrentIndex(index + 1);
      }
      return;
    }

    try {
      await advanceSegment();
    } catch {
      return;
    }
    segmentStartRef.current = Date.now();
    if (index < queueRef.current.length - 1) {
      setCurrentIndex(index + 1);
    }
  }, [advanceSegment, isDemoMode]);

  /** Finish the continuous session: finalize the current segment and release
   * the mic, staying on the current question. Used by "Stop & finish", the
   * explicit "Stop recording" control, and the single-shot re-record flow. */
  const stopRecording = useCallback(async () => {
    const index = currentIndexRef.current;
    const item = queueRef.current[index];
    const startedAt = segmentStartRef.current;
    stopTimer();

    if (isDemoMode) {
      setDemoRecording(false);
      setDemoPaused(false);
      segmentStartRef.current = null;
      if (item) finalizeSegment(item, new Blob(), startedAt);
      return;
    }

    let blob: Blob;
    try {
      blob = await stopContinuous();
    } catch {
      return;
    }
    segmentStartRef.current = null;
    if (item) finalizeSegment(item, blob, startedAt);
  }, [finalizeSegment, isDemoMode, stopContinuous, stopTimer]);

  // Alias for call-site clarity when ending the interview.
  const finishRecording = stopRecording;

  /** Manual typed answer (offline / unconfigured fallback). */
  const setManualAnswer = useCallback(
    (itemId: string, text: string) => {
      const item = queueRef.current.find((q) => q.itemId === itemId);
      if (!item) return;
      const trimmed = text;
      setResponses((prev) => ({
        ...prev,
        [itemId]: {
          questionId: itemId,
          promptEnglish: item.promptEnglish,
          transcriptOriginal: trimmed,
          transcriptEnglish: trimmed,
          isFollowUp: item.isFollowUp,
        },
      }));
      if (!isDemoMode) scheduleAnalysis();
    },
    [isDemoMode, scheduleAnalysis]
  );

  /** Edit an already-captured answer's text (keeps the recording job id). */
  const editAnswer = useCallback(
    (itemId: string, patch: { original?: string; english?: string }) => {
      const item = queueRef.current.find((q) => q.itemId === itemId);
      if (!item) return;
      setResponses((prev) => {
        const existing = prev[itemId];
        if (!existing) {
          return {
            ...prev,
            [itemId]: {
              questionId: itemId,
              promptEnglish: item.promptEnglish,
              transcriptOriginal: patch.original ?? "",
              transcriptEnglish: patch.english ?? "",
              isFollowUp: item.isFollowUp,
            },
          };
        }
        return {
          ...prev,
          [itemId]: {
            ...existing,
            transcriptOriginal: patch.original ?? existing.transcriptOriginal,
            transcriptEnglish: patch.english ?? existing.transcriptEnglish,
          },
        };
      });
      if (!isDemoMode) scheduleAnalysis();
    },
    [isDemoMode, scheduleAnalysis]
  );

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex((prev) => {
        const clamped = Math.min(Math.max(index, 0), queueRef.current.length - 1);
        return clamped;
      });
    },
    []
  );

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  const reanalyze = useCallback(() => {
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
    void runAnalysisNow();
  }, [runAnalysisNow]);

  const buildResult = useCallback((): GuidedInterviewResult => {
    const ordered = queueRef.current
      .map((item) => responsesRef.current[item.itemId])
      .filter((response): response is QuestionResponse => Boolean(response));
    const { original, english } = buildTranscriptFromResponses(ordered);
    const askedQuestionIds = queueRef.current
      .filter(
        (item) =>
          !item.isFollowUp &&
          (responsesRef.current[item.itemId]?.transcriptEnglish.trim() ||
            responsesRef.current[item.itemId]?.transcriptOriginal.trim())
      )
      .map((item) => item.questionId);

    const analysis: AnalyzeInterviewResponse | null =
      coverage.size > 0 || followUps.length > 0
        ? {
            coverage: Array.from(coverage.values()),
            follow_ups: followUps,
            source: analysisSource ?? "fake",
          }
        : null;

    return {
      transcriptOriginal: original,
      transcriptEnglish: english,
      questionResponses: ordered,
      askedQuestionIds,
      analysis,
    };
  }, [analysisSource, coverage, followUps]);

  const answeredCount = useMemo(
    () =>
      queue.filter((item) => {
        const response = responses[item.itemId];
        return Boolean(
          response &&
            (response.transcriptEnglish.trim() ||
              response.transcriptOriginal.trim())
        );
      }).length,
    [queue, responses]
  );

  const current = queue[currentIndex];
  const isTranscribingCurrent = current
    ? transcribingItems.has(current.itemId)
    : false;
  const activeRecording = isDemoMode ? demoRecording : isRecording;
  const activePaused = isDemoMode ? demoPaused : isPaused;
  const activePauseSupported = isDemoMode ? true : pauseSupported;
  const activeStream = isDemoMode ? null : stream;
  const isBusy = activeRecording || transcribingItems.size > 0;

  return {
    // config
    useLiveInference,
    useRecordingUi,
    isDemoMode,
    canAnalyze,
    interviewLanguage,
    // queue / navigation
    queue,
    currentIndex,
    current,
    answeredCount,
    goTo,
    next,
    prev,
    // recording
    isRecording: activeRecording,
    isPaused: activePaused,
    pauseSupported: activePauseSupported,
    stream: activeStream,
    recordingTime,
    formatTime,
    startRecording,
    pauseRecording,
    stopRecording,
    advanceRecording,
    skipRecording,
    finishRecording,
    setManualAnswer,
    editAnswer,
    // transcription
    responses,
    transcribingItems,
    askedItems,
    isTranscribingCurrent,
    isBusy,
    // analysis
    coverage,
    followUps,
    isAnalyzing,
    reanalyze,
    // misc
    error,
    buildResult,
  };
}
