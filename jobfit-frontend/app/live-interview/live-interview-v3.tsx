'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Clock3,
  Gauge,
  History,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { buildExpectedInterviewResponse } from '../../lib/interview-expected-response.mjs';
import {
  analyseInterviewDelivery,
  buildInterviewSessionReport,
  buildTargetedRetry,
  combineInterviewReadiness,
} from '../../lib/interview-performance.mjs';

type InterviewState = 'setup' | 'active' | 'complete';
type CoachState = 'ready' | 'speaking' | 'listening' | 'thinking';
type InterviewType = 'hr' | 'behavioural' | 'technical';
type CoachMode = 'ai' | 'fallback';
type PracticeMode = 'learn' | 'practice' | 'assessment';
type Demeanour = 'supportive' | 'neutral' | 'challenging' | 'executive' | 'technical';
type EvidenceStatus = 'confirmed' | 'partial' | 'unsupported' | 'unknown';

type CoachDimension = { key: string; label: string; score: number; rationale: string };
type EvidenceFinding = { status: EvidenceStatus; claim: string; evidence: string };
type TranscriptSegment = { at_ms: number; text: string };

type DeliveryAnalytics = {
  score: number;
  word_count: number;
  duration_sec: number;
  duration_source: string;
  wpm: number;
  filler_count: number;
  filler_rate_pct: number;
  filler_breakdown: Array<{ label: string; count: number }>;
  long_pause_count: number;
  avg_sentence_words: number;
  repetitions: Array<{ phrase: string; count: number }>;
  ownership: { i_count: number; we_count: number; i_ratio_pct: number };
  dimensions: Record<string, number>;
  coaching: string[];
};

type Assessment = {
  question: string;
  answer: string;
  total: number;
  rating: number;
  label: string;
  dimensions: CoachDimension[];
  strengths: string[];
  improvements: string[];
  evidence_findings: EvidenceFinding[];
  credibility_flags: string[];
  follow_up: string;
  next_question: string;
  coaching_message: string;
  revised_answer: string;
  mode: CoachMode;
  delivery: DeliveryAnalytics;
  readiness: number;
  retry_targets: string[];
  transcript_segments: TranscriptSegment[];
  recording_url?: string;
};

type CoachResponse = {
  mode: CoachMode;
  assessment: Omit<Assessment, 'mode' | 'delivery' | 'readiness' | 'retry_targets' | 'transcript_segments' | 'recording_url'>;
};

type ExpectedResponse = {
  mode: 'ai' | 'fallback';
  question: string;
  intent_summary: string;
  interviewer_testing: string[];
  structure: string;
  expected_response: string;
  relevant_evidence: string[];
  evidence_gaps: string[];
  response_basis: 'verified_evidence' | 'illustrative_model';
};

type StoredContext = {
  role?: string;
  company?: string;
  jobDescription?: string;
  interviewType?: InterviewType;
  candidateEvidence?: string[];
};

type ProgressSession = {
  id: string;
  at: string;
  role: string;
  company: string;
  interviewType: InterviewType;
  practiceMode: PracticeMode;
  demeanour: Demeanour;
  turns: number;
  contentAverage: number;
  deliveryAverage: number;
  readinessAverage: number;
};

type SpeechRecognitionResultLike = { 0: { transcript: string }; isFinal?: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike>; resultIndex?: number };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const INTERVIEW_TYPES: Record<InterviewType, { label: string; description: string; opening: string; suggestions: string[] }> = {
  hr: {
    label: 'Initial HR screening',
    description: 'Motivation, fit, credibility, communication and practical readiness.',
    opening: 'Please introduce yourself and explain why you are interested in this role.',
    suggestions: [
      'Why are you interested in this specific opportunity, and why now?',
      'Which parts of your background are most relevant to this role?',
      'Why do you want to join this organisation rather than another employer?',
      'What are your verified availability, location and working-pattern requirements?',
    ],
  },
  behavioural: {
    label: 'Behavioural interview',
    description: 'STAR, ownership, judgement, stakeholder leadership and measurable outcomes.',
    opening: 'Tell me about a complex programme or project you led. What made it difficult, and what did you personally do?',
    suggestions: [
      'Tell me about a major dependency or risk that threatened delivery. What did you personally do?',
      'Describe a stakeholder disagreement you resolved. How did you reach the decision?',
      'Tell me about a difficult decision you made with incomplete information.',
      'Describe a delivery setback. What did you change afterwards?',
    ],
  },
  technical: {
    label: 'Technical interview',
    description: 'Architecture, technical depth, trade-offs, controls and operational readiness.',
    opening: 'Walk me through the architecture of a complex platform or transformation you delivered.',
    suggestions: [
      'Describe a serious technical risk you identified and how you validated the mitigation.',
      'How did you manage security, resilience, performance and observability requirements?',
      'Explain a technical trade-off you made between speed, cost, quality and risk.',
      'How did you move a complex solution from design through deployment and operational handover?',
    ],
  },
};

const MODES: Record<PracticeMode, { label: string; description: string }> = {
  learn: { label: 'Learn', description: 'See question-specific guidance before answering.' },
  practice: { label: 'Practice', description: 'Answer first; guidance unlocks after coaching.' },
  assessment: { label: 'Assessment', description: 'No hints during the session; review only at the end.' },
};

const DEMEANOURS: Record<Demeanour, { label: string; description: string }> = {
  supportive: { label: 'Supportive', description: 'Calm and encouraging follow-ups.' },
  neutral: { label: 'Neutral', description: 'Balanced hiring-manager style.' },
  challenging: { label: 'Challenging', description: 'Pushes for evidence and precision.' },
  executive: { label: 'Executive', description: 'Concise, outcome and trade-off focused.' },
  technical: { label: 'Technical', description: 'Probes architecture, controls and decisions.' },
};

const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';
const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';
const PROGRESS_KEY = 'cognitwist-interview-progress-v1';
const TTS_KEY = 'cognitwist-live-interview-tts';

function safeInterviewType(value: unknown): InterviewType {
  return value === 'hr' || value === 'technical' || value === 'behavioural' ? value : 'behavioural';
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function deriveCompany(jobDescription: string) {
  const firstLine = String(jobDescription || '').split(/\n+/)[0] || '';
  return firstLine.includes(' at ') ? firstLine.split(' at ').slice(1).join(' at ').trim().slice(0, 240) : '';
}

function readStoredContext(): StoredContext {
  try {
    const raw = window.sessionStorage.getItem('cognitwist-live-interview-context');
    return raw ? JSON.parse(raw) as StoredContext : {};
  } catch { return {}; }
}

function readProgress(): ProgressSession[] {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch { return []; }
}

function evidenceTone(status: EvidenceStatus) {
  if (status === 'confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-950';
  if (status === 'unsupported') return 'border-rose-200 bg-rose-50 text-rose-950';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

function styleQuestion(question: string, demeanour: Demeanour) {
  const clean = question.trim();
  if (!clean) return clean;
  if (demeanour === 'challenging') return `I want a precise, evidenced answer. ${clean}`;
  if (demeanour === 'executive') return `Keep this concise and outcome-focused. ${clean}`;
  if (demeanour === 'technical') return `Be technically specific about your decisions and controls. ${clean}`;
  if (demeanour === 'supportive') return `Take a moment to structure your answer. ${clean}`;
  return clean;
}

function localExpected(role: string, company: string, jobDescription: string, interviewType: InterviewType, question: string, candidateEvidence: string[]): ExpectedResponse {
  const fallback = buildExpectedInterviewResponse({ role, company, job_description: jobDescription, interview_type: interviewType, question, candidate_evidence: candidateEvidence }) as Record<string, unknown>;
  return {
    mode: 'fallback',
    question,
    intent_summary: String(fallback.intent || `Guidance for: ${question}`),
    interviewer_testing: Array.isArray(fallback.interviewer_testing) ? fallback.interviewer_testing.map(String) : [],
    structure: String(fallback.structure || ''),
    expected_response: String(fallback.expected_response || `Answer this exact question directly: ${question}`),
    relevant_evidence: Array.isArray(fallback.relevant_evidence) ? fallback.relevant_evidence.map(String) : [],
    evidence_gaps: Array.isArray(fallback.missing_evidence) ? fallback.missing_evidence.map(String) : [],
    response_basis: fallback.basis === 'verified_evidence' ? 'verified_evidence' : 'illustrative_model',
  };
}

export default function LiveInterviewV3() {
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioural');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('learn');
  const [demeanour, setDemeanour] = useState<Demeanour>('neutral');
  const [role, setRole] = useState('Technical Programme Manager');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [candidateEvidence, setCandidateEvidence] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(INTERVIEW_TYPES.behavioural.opening);
  const [questionDraft, setQuestionDraft] = useState('');
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState<Assessment[]>([]);
  const [sessionState, setSessionState] = useState<InterviewState>('setup');
  const [coachState, setCoachState] = useState<CoachState>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState<ProgressSession[]>([]);
  const [expected, setExpected] = useState<ExpectedResponse | null>(null);
  const [expectedLoading, setExpectedLoading] = useState(false);
  const [guidanceRevealed, setGuidanceRevealed] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('auto');
  const [speechRate, setSpeechRate] = useState(0.94);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseAnswerRef = useRef('');
  const answerStartedAtRef = useRef<number | null>(null);
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);
  const speechStartedAtRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const stopRecordingResolverRef = useRef<((url: string) => void) | null>(null);
  const expectedAbortRef = useRef<AbortController | null>(null);
  const sessionSavedRef = useRef(false);

  const config = INTERVIEW_TYPES[interviewType];
  const latest = history[history.length - 1];
  const report = useMemo(() => buildInterviewSessionReport(history.map((item) => ({ question: item.question, content_score: item.total, delivery_score: item.delivery.score, readiness_score: item.readiness }))), [history]);

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    setRecordingSupported(Boolean(navigator.mediaDevices?.getUserMedia && 'MediaRecorder' in window));
    setProgress(readProgress());
    const context = readStoredContext();
    const params = new URLSearchParams(window.location.search);
    const nextRole = params.get('role') || context.role || '';
    const nextType = safeInterviewType(params.get('type') || context.interviewType);
    const nextDescription = typeof context.jobDescription === 'string' ? context.jobDescription.slice(0, 12000) : '';
    if (nextRole) setRole(nextRole.slice(0, 240));
    setInterviewType(nextType);
    setCurrentQuestion(INTERVIEW_TYPES[nextType].opening);
    if (nextDescription) {
      setJobDescription(nextDescription);
      setCompany((context.company || deriveCompany(nextDescription)).slice(0, 240));
    }
    if (Array.isArray(context.candidateEvidence)) setCandidateEvidence(context.candidateEvidence.map((item) => String(item).slice(0, 1200)).filter(Boolean).slice(0, 30));

    try {
      const stored = JSON.parse(window.localStorage.getItem(TTS_KEY) || '{}') as { voiceURI?: string; rate?: number };
      setVoiceURI(stored.voiceURI || 'auto');
      if (Number.isFinite(Number(stored.rate))) setSpeechRate(Math.max(0.7, Math.min(1.3, Number(stored.rate))));
    } catch { /* no-op */ }

    if ('speechSynthesis' in window) {
      const load = () => setVoices(window.speechSynthesis.getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith('en')).sort((a, b) => `${a.lang}-${a.name}`.localeCompare(`${b.lang}-${b.name}`)));
      load();
      window.speechSynthesis.addEventListener?.('voiceschanged', load);
      return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
    }
    return undefined;
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(TTS_KEY, JSON.stringify({ voiceURI, rate: speechRate })); } catch { /* no-op */ }
  }, [voiceURI, speechRate]);

  useEffect(() => {
    if (sessionState !== 'active') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionState]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    expectedAbortRef.current?.abort();
    window.speechSynthesis?.cancel();
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    history.forEach((item) => { if (item.recording_url) URL.revokeObjectURL(item.recording_url); });
  }, [history]);

  useEffect(() => {
    if (sessionState !== 'active' || !role.trim() || !currentQuestion.trim()) return;
    const question = currentQuestion.trim();
    const fallback = localExpected(role, company, jobDescription, interviewType, question, candidateEvidence);
    setExpected(fallback);
    setExpectedLoading(true);
    expectedAbortRef.current?.abort();
    const controller = new AbortController();
    expectedAbortRef.current = controller;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/interview-coach/expected', {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: role.trim(), company: company.trim(), job_description: jobDescription.trim(), interview_type: interviewType, question, candidate_evidence: candidateEvidence }),
        });
        const data = await response.json().catch(() => null) as ExpectedResponse | null;
        if (response.ok && data?.question === question && data.expected_response?.trim()) setExpected(data);
      } catch { setExpected(fallback); }
      finally {
        if (expectedAbortRef.current === controller) {
          expectedAbortRef.current = null;
          setExpectedLoading(false);
        }
      }
    }, 100);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [sessionState, role, company, jobDescription, interviewType, currentQuestion, candidateEvidence]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) { setCoachState('ready'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const available = window.speechSynthesis.getVoices();
    const selected = voiceURI === 'auto'
      ? available.find((voice) => voice.lang === 'en-GB') || available.find((voice) => voice.lang?.toLowerCase().startsWith('en'))
      : available.find((voice) => voice.voiceURI === voiceURI);
    if (selected) { utterance.voice = selected; utterance.lang = selected.lang; }
    utterance.rate = speechRate;
    utterance.onstart = () => setCoachState('speaking');
    utterance.onend = () => setCoachState('ready');
    utterance.onerror = () => setCoachState('ready');
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, voiceURI, speechRate]);

  const startMediaRecording = async () => {
    if (!recordingSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) mediaChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = blob.size ? URL.createObjectURL(blob) : '';
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        stopRecordingResolverRef.current?.(url);
        stopRecordingResolverRef.current = null;
      };
      recorder.start(250);
      setIsRecording(true);
    } catch {
      setRecordingSupported(false);
      setNotice('Audio recording is unavailable, but speech transcription and typed practice can continue.');
    }
  };

  const stopMediaRecording = () => new Promise<string>((resolve) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') { resolve(''); return; }
    stopRecordingResolverRef.current = resolve;
    try { recorder.stop(); } catch { resolve(''); }
  });

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* no-op */ }
    recognitionRef.current = null;
    setIsListening(false);
    if (coachState === 'listening') setCoachState('ready');
  }, [coachState]);

  const startListening = async () => {
    if (!speechSupported) { setNotice('Speech recognition is unavailable in this browser. Type your answer instead.'); return; }
    window.speechSynthesis?.cancel();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';
    recognitionRef.current = recognition;
    baseAnswerRef.current = answer.trim();
    transcriptSegmentsRef.current = [];
    speechStartedAtRef.current = performance.now();
    answerStartedAtRef.current = performance.now();

    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += `${result[0].transcript} `;
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          const at = speechStartedAtRef.current ? performance.now() - speechStartedAtRef.current : 0;
          const previous = transcriptSegmentsRef.current[transcriptSegmentsRef.current.length - 1];
          if (text && previous?.text !== text) transcriptSegmentsRef.current.push({ at_ms: Math.round(at), text });
        }
      }
      setAnswer(`${baseAnswerRef.current} ${transcript}`.replace(/\s+/g, ' ').trim());
    };
    recognition.onerror = () => {
      setNotice('The microphone could not capture your answer. Check permission or type your response.');
      setIsListening(false);
      setCoachState('ready');
    };
    recognition.onend = () => { setIsListening(false); setCoachState('ready'); };

    try {
      recognition.start();
      setIsListening(true);
      setCoachState('listening');
      setNotice(recordingSupported ? 'Listening and recording. Press Stop when you finish.' : 'Listening. Press Stop when you finish.');
      void startMediaRecording();
    } catch { setNotice('The microphone is already active or unavailable.'); }
  };

  const setQuestion = (question: string, applyStyle = true) => {
    const clean = question.trim();
    if (!clean) return;
    stopListening();
    void stopMediaRecording();
    const next = applyStyle ? styleQuestion(clean, demeanour) : clean;
    setCurrentQuestion(next);
    setQuestionDraft('');
    setAnswer('');
    setError('');
    setGuidanceRevealed(false);
    answerStartedAtRef.current = null;
    transcriptSegmentsRef.current = [];
    setNotice('Question ready. Answer naturally; content and delivery will be assessed separately.');
    window.setTimeout(() => speak(next), 80);
  };

  const startInterview = () => {
    if (!role.trim()) { setError('Enter the exact target role before starting practice.'); return; }
    const opening = styleQuestion(INTERVIEW_TYPES[interviewType].opening, demeanour);
    setHistory([]);
    sessionSavedRef.current = false;
    setElapsed(0);
    setCurrentQuestion(opening);
    setAnswer('');
    setError('');
    setGuidanceRevealed(false);
    setNotice(`${MODES[practiceMode].label} mode started. Content and delivery are scored independently.`);
    setSessionState('active');
    window.setTimeout(() => speak(`Welcome to your ${INTERVIEW_TYPES[interviewType].label.toLowerCase()} practice for the ${role.trim()} role. ${opening}`), 120);
  };

  const submitAnswer = async () => {
    if (!answer.trim() || analysing) { if (!answer.trim()) setError('Speak or type an answer before requesting coaching.'); return; }
    stopListening();
    window.speechSynthesis?.cancel();
    setAnalysing(true);
    setCoachState('thinking');
    setError('');
    setNotice('Analysing role relevance, evidence quality and communication delivery…');

    const endedAt = performance.now();
    const startedAt = answerStartedAtRef.current || endedAt;
    const durationSec = Math.max(0, (endedAt - startedAt) / 1000);
    const segments = [...transcriptSegmentsRef.current];
    const source = speechStartedAtRef.current ? 'speech' : 'typed';
    const recordingUrlPromise = stopMediaRecording();
    const delivery = analyseInterviewDelivery({ text: answer.trim(), duration_sec: durationSec, source, segments }) as DeliveryAnalytics;

    try {
      const response = await fetch('/api/interview-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role.trim(),
          company: company.trim(),
          job_description: `${jobDescription.trim()}\n\nInterviewer simulation style: ${DEMEANOURS[demeanour].label}. ${DEMEANOURS[demeanour].description}`.trim(),
          interview_type: interviewType,
          question: currentQuestion,
          answer: answer.trim(),
          candidate_evidence: candidateEvidence,
          history: history.map((item) => ({ question: item.question, answer: item.answer, score: item.total })).slice(-8),
        }),
      });
      const data = await response.json().catch(() => null) as CoachResponse | { detail?: string } | null;
      if (!response.ok || !data || !('assessment' in data)) throw new Error(data && 'detail' in data && data.detail ? data.detail : 'Interview coaching could not complete this turn.');
      const recordingUrl = await Promise.race([recordingUrlPromise, new Promise<string>((resolve) => window.setTimeout(() => resolve(''), 1800))]);
      const readiness = combineInterviewReadiness(data.assessment.total, delivery.score);
      const retryTargets = buildTargetedRetry({ content_dimensions: data.assessment.dimensions, delivery });
      const item: Assessment = { ...data.assessment, mode: data.mode, delivery, readiness, retry_targets: retryTargets, transcript_segments: segments, recording_url: recordingUrl || undefined };
      setHistory((items) => [...items, item]);
      setGuidanceRevealed(practiceMode !== 'assessment');
      setNotice(`${data.mode === 'ai' ? 'Adaptive AI' : 'Fallback'} coaching complete · Content ${item.total}/100 · Delivery ${delivery.score}/100 · Readiness ${readiness}/100.`);
      speak(`${item.coaching_message} ${item.follow_up}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Interview coaching could not complete this turn.');
      setNotice('');
    } finally {
      setAnalysing(false);
      setCoachState('ready');
    }
  };

  const saveSession = () => {
    if (sessionSavedRef.current || !history.length) return;
    const currentReport = buildInterviewSessionReport(history.map((item) => ({ question: item.question, content_score: item.total, delivery_score: item.delivery.score, readiness_score: item.readiness })));
    const summary: ProgressSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      role: role.trim(),
      company: company.trim(),
      interviewType,
      practiceMode,
      demeanour,
      turns: currentReport.turns,
      contentAverage: currentReport.content_average,
      deliveryAverage: currentReport.delivery_average,
      readinessAverage: currentReport.readiness_average,
    };
    const next = [summary, ...readProgress()].slice(0, 20);
    try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch { /* no-op */ }
    setProgress(next);
    sessionSavedRef.current = true;
  };

  const finishSession = () => { saveSession(); setGuidanceRevealed(true); setSessionState('complete'); };

  const resetInterview = () => {
    stopListening();
    void stopMediaRecording();
    window.speechSynthesis?.cancel();
    history.forEach((item) => { if (item.recording_url) URL.revokeObjectURL(item.recording_url); });
    setSessionState('setup');
    setCoachState('ready');
    setHistory([]);
    setElapsed(0);
    setAnswer('');
    setNotice('');
    setError('');
    setGuidanceRevealed(false);
    answerStartedAtRef.current = null;
    speechStartedAtRef.current = null;
    transcriptSegmentsRef.current = [];
  };

  const copyRevision = async () => {
    if (!latest?.revised_answer) return;
    await navigator.clipboard?.writeText(latest.revised_answer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const onTypedAnswer = (value: string) => {
    if (!answerStartedAtRef.current && value.trim()) answerStartedAtRef.current = performance.now();
    setAnswer(value);
  };

  const showGuidance = practiceMode === 'learn' || (practiceMode === 'practice' && guidanceRevealed) || sessionState === 'complete';
  const statusLabel = coachState === 'speaking' ? 'Speaking' : coachState === 'listening' ? 'Listening' : coachState === 'thinking' ? 'Analysing' : 'Ready';

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2.2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-9">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><BrainCircuit className="h-3.5 w-3.5" /> Interview Coach v3 · Performance Intelligence</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Content intelligence + communication performance.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Practise against the exact vacancy and candidate evidence while CogniTwist separately measures answer quality, pace, filler words, repetition, ownership and fluency.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-xs font-black"><Clock3 className="h-4 w-4 text-[var(--accent-strong)]" /> {formatTime(elapsed)}</div>
          </div>
        </section>

        {sessionState === 'setup' ? (
          <section className={`${panelClass} p-5 md:p-7`}>
            <div className="flex items-center gap-3"><Target className="h-5 w-5 text-[var(--accent-strong)]" /><div><h2 className="text-xl font-black">Configure the simulation</h2><p className="text-xs text-[var(--ink-soft)]">Vacancy and evidence context loads automatically from Job Intelligence when available.</p></div></div>
            <div className="mt-6 space-y-6">
              <fieldset><legend className="text-xs font-black">Coaching mode</legend><div className="mt-2 grid gap-2 md:grid-cols-3">{(Object.keys(MODES) as PracticeMode[]).map((mode) => <button key={mode} type="button" onClick={() => setPracticeMode(mode)} className={`rounded-2xl border p-4 text-left ${practiceMode === mode ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-xs">{MODES[mode].label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--ink-soft)]">{MODES[mode].description}</span></button>)}</div></fieldset>
              <fieldset><legend className="text-xs font-black">Interview stage</legend><div className="mt-2 grid gap-2 md:grid-cols-3">{(Object.keys(INTERVIEW_TYPES) as InterviewType[]).map((type) => <button key={type} type="button" onClick={() => { setInterviewType(type); setCurrentQuestion(INTERVIEW_TYPES[type].opening); }} className={`rounded-2xl border p-4 text-left ${interviewType === type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-xs">{INTERVIEW_TYPES[type].label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--ink-soft)]">{INTERVIEW_TYPES[type].description}</span></button>)}</div></fieldset>
              <fieldset><legend className="text-xs font-black">Interviewer demeanour</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(DEMEANOURS) as Demeanour[]).map((style) => <button key={style} type="button" onClick={() => setDemeanour(style)} className={`rounded-2xl border p-3 text-left ${demeanour === style ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-[11px]">{DEMEANOURS[style].label}</strong><span className="mt-1 block text-[9px] leading-4 text-[var(--ink-soft)]">{DEMEANOURS[style].description}</span></button>)}</div></fieldset>
              <div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-black">Target role<input value={role} onChange={(event) => setRole(event.target.value)} className={`${inputClass} mt-2`} /></label><label className="text-xs font-black">Company<input value={company} onChange={(event) => setCompany(event.target.value)} className={`${inputClass} mt-2`} /></label></div>
              <label className="text-xs font-black">Job description / role context<textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={5} className={`${inputClass} mt-2 resize-y text-xs leading-6`} /></label>
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <label className="text-xs font-black">Coach voice<select value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)} className={`${inputClass} mt-2`}><option value="auto">Auto · best English voice</option>{voices.map((voice) => <option key={`${voice.voiceURI}-${voice.lang}`} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></label>
                <label className="text-xs font-black"><span className="flex justify-between"><span>Speech speed</span><span>{speechRate.toFixed(2)}×</span></span><input className="mt-4 w-full" type="range" min="0.7" max="1.3" step="0.05" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} /></label>
              </div>
              {error ? <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div> : null}
              <button type="button" onClick={startInterview} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)]"><Play className="h-4 w-4" /> Start {MODES[practiceMode].label.toLowerCase()} session</button>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[0.65fr_1.35fr]">
              <div className="space-y-4">
                <section className={`${panelClass} overflow-hidden`}><div className="relative flex min-h-[320px] flex-col items-center justify-center bg-[radial-gradient(circle_at_top,var(--accent-soft),transparent_58%),linear-gradient(145deg,#132238,#07111f)] p-7 text-white"><div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider">{statusLabel}</div><div className={`flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl ${coachState === 'thinking' || coachState === 'speaking' ? 'animate-pulse' : ''}`}><BrainCircuit className="h-16 w-16" /></div><p className="mt-5 text-lg font-black">{DEMEANOURS[demeanour].label} interviewer</p><p className="mt-2 max-w-sm text-center text-xs leading-6 text-white/70">{MODES[practiceMode].label} mode · {config.label} · evidence guard</p><div className="mt-5 flex gap-2"><span className="rounded-full border border-white/20 px-3 py-1.5 text-[9px] font-black">{history.length} coached turns</span>{isRecording ? <span className="rounded-full border border-rose-300/50 bg-rose-500/20 px-3 py-1.5 text-[9px] font-black">● recording</span> : null}</div></div></section>
                <section className={`${panelClass} p-5`}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-strong)]" /><div><h2 className="text-sm font-black">Evidence guard</h2><p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">Content coaching is grounded in your answer, vacancy and carried evidence. Delivery analytics never invent career claims.</p></div></div></section>
                {progress.length ? <section className={`${panelClass} p-5`}><div className="flex items-center gap-2"><History className="h-4 w-4 text-[var(--accent-strong)]" /><h2 className="text-sm font-black">Recent progress</h2></div><div className="mt-3 space-y-2">{progress.slice(0, 3).map((item) => <div key={item.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-3"><div className="flex justify-between gap-3"><p className="text-[10px] font-black">{item.role}</p><span className="text-xs font-black">{item.readinessAverage}</span></div><p className="mt-1 text-[9px] text-[var(--ink-soft)]">{new Date(item.at).toLocaleDateString()} · {item.turns} turns · C {item.contentAverage} / D {item.deliveryAverage}</p></div>)}</div></section> : null}
              </div>

              <div className="space-y-5">
                <section className={`${panelClass} p-5 md:p-7`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Current question</p><h2 className="mt-3 text-xl font-black leading-8 md:text-2xl">{currentQuestion}</h2></div><button type="button" onClick={() => speak(currentQuestion)} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2 text-[11px] font-black">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Repeat</button></div><div className="mt-5 flex gap-2"><input value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder="Practise another interview question…" className={`${inputClass} min-w-0 flex-1`} /><button type="button" onClick={() => setQuestion(questionDraft)} disabled={!questionDraft.trim()} className="rounded-xl bg-[var(--accent)] px-4 text-xs font-black text-white disabled:opacity-40"><Send className="h-4 w-4" /></button></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{config.suggestions.map((question) => <button key={question} type="button" onClick={() => setQuestion(question)} className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-2 text-[10px] font-bold text-[var(--ink-soft)]">{question.slice(0, 55)}{question.length > 55 ? '…' : ''}</button>)}</div></section>

                {showGuidance && expected ? <section className={`${panelClass} p-5 md:p-7`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Expected response for this exact question</p><p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{expected.intent_summary}</p></div><div className="flex items-center gap-2">{expectedLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}<span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${expected.mode === 'ai' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{expected.mode === 'ai' ? 'Adaptive AI' : 'Fallback'}</span></div></div><div className="mt-4 flex flex-wrap gap-1.5">{expected.interviewer_testing.map((item) => <span key={item} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[9px] font-black">{item}</span>)}</div><div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Best structure</p><p className="mt-2 text-xs leading-6">{expected.structure}</p><p className="mt-4 text-[9px] font-black uppercase text-[var(--ink-soft)]">Model / evidence-grounded response</p><pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-6">{expected.expected_response}</pre></div></section> : practiceMode !== 'learn' && sessionState === 'active' ? <section className={`${panelClass} p-5`}><p className="text-xs font-black">Guidance hidden in {MODES[practiceMode].label} mode</p><p className="mt-1 text-[11px] leading-5 text-[var(--ink-soft)]">{practiceMode === 'practice' ? 'It unlocks after you coach this answer.' : 'It remains hidden until the assessment is finished.'}</p></section> : null}

                <section className={`${panelClass} p-5 md:p-7`}><div className="flex items-center justify-between gap-3"><label htmlFor="interview-answer" className="text-xs font-black">Your answer</label><button type="button" onClick={() => setVoiceEnabled((value) => !value)} className="rounded-lg border border-[var(--surface-border)] p-2">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div><textarea id="interview-answer" value={answer} onChange={(event) => onTypedAnswer(event.target.value)} rows={8} className={`${inputClass} mt-2 resize-y leading-7`} placeholder="Speak or type your answer. CogniTwist scores content and delivery separately." /><div className="mt-3 flex flex-wrap gap-2">{isListening ? <button type="button" onClick={() => { stopListening(); void stopMediaRecording(); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-xs font-black text-rose-900"><Square className="h-4 w-4" /> Stop</button> : <button type="button" onClick={startListening} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black"><Mic className="h-4 w-4" /> Speak & record</button>}<button type="button" onClick={submitAnswer} disabled={analysing || !answer.trim()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-xs font-black text-white disabled:opacity-45">{analysing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{analysing ? 'Analysing…' : 'Coach this answer'}</button></div>{!speechSupported ? <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ink-soft)]"><MicOff className="h-3.5 w-3.5" /> Speech recognition unavailable; typed practice remains available.</div> : null}{notice ? <div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6">{notice}</div> : null}{error ? <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div> : null}</section>

                {latest ? <section className={`${panelClass} p-5 md:p-7`}><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Content</p><p className="mt-1 text-3xl font-black">{latest.total}</p></div><div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Delivery</p><p className="mt-1 text-3xl font-black">{latest.delivery.score}</p></div><div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="text-[9px] font-black uppercase text-[var(--accent-strong)]">Readiness</p><p className="mt-1 text-3xl font-black">{latest.readiness}</p></div></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-[var(--surface-border)] p-3"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Pace</p><p className="mt-1 text-lg font-black">{latest.delivery.wpm || '—'}{latest.delivery.wpm ? ' WPM' : ''}</p></div><div className="rounded-xl border border-[var(--surface-border)] p-3"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Fillers</p><p className="mt-1 text-lg font-black">{latest.delivery.filler_count}</p></div><div className="rounded-xl border border-[var(--surface-border)] p-3"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Long pauses</p><p className="mt-1 text-lg font-black">{latest.delivery.long_pause_count}</p></div><div className="rounded-xl border border-[var(--surface-border)] p-3"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">I / we ownership</p><p className="mt-1 text-lg font-black">{latest.delivery.ownership.i_ratio_pct}%</p></div></div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><p className="text-xs font-black">Content strengths</p><ul className="mt-2 space-y-2 text-[11px] leading-5">{latest.strengths.map((item) => <li key={item}>• {item}</li>)}</ul></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="text-xs font-black">Delivery coaching</p><ul className="mt-2 space-y-2 text-[11px] leading-5">{latest.delivery.coaching.map((item) => <li key={item}>• {item}</li>)}</ul></div></div>
                  <div className="mt-5 grid gap-3 md:grid-cols-5">{latest.dimensions.map((dimension) => <div key={dimension.key} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-3"><div className="flex justify-between gap-2"><p className="text-[9px] font-black">{dimension.label}</p><span className="text-[10px] font-black">{dimension.score}/20</span></div><p className="mt-2 text-[9px] leading-4 text-[var(--ink-soft)]">{dimension.rationale}</p></div>)}</div>
                  {latest.recording_url ? <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-xs font-black">Answer replay</p><audio className="mt-3 w-full" controls src={latest.recording_url} /></div> : null}
                  {latest.transcript_segments.length ? <div className="mt-5 rounded-2xl border border-[var(--surface-border)] p-4"><p className="text-xs font-black">Timestamped transcript</p><div className="mt-3 space-y-2">{latest.transcript_segments.map((segment, index) => <p key={`${segment.at_ms}-${index}`} className="text-[10px] leading-5"><span className="mr-2 font-black text-[var(--accent-strong)]">{formatTime(Math.round(segment.at_ms / 1000))}</span>{segment.text}</p>)}</div></div> : null}
                  <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex justify-between gap-3"><p className="text-xs font-black">Stronger response</p><button type="button" onClick={copyRevision} className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-[9px] font-black"><Clipboard className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}</button></div><pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-6 text-[var(--ink-soft)]">{latest.revised_answer}</pre></div>
                  <div className="mt-5 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="text-xs font-black">Targeted retry</p><ul className="mt-2 space-y-1 text-[11px] leading-5">{latest.retry_targets.map((item) => <li key={item}>• {item}</li>)}</ul><button type="button" onClick={() => { setQuestion(latest.question, false); setNotice(`Retry target: ${latest.retry_targets.join(' ')}`); }} className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-black text-white">Retry this question</button></div>
                  {latest.evidence_findings.length ? <div className="mt-5 grid gap-2">{latest.evidence_findings.map((finding, index) => <div key={`${finding.claim}-${index}`} className={`rounded-xl border p-3 ${evidenceTone(finding.status)}`}><div className="flex justify-between gap-2"><p className="text-[10px] font-black">{finding.claim}</p><span className="text-[8px] font-black uppercase">{finding.status}</span></div>{finding.evidence ? <p className="mt-1 text-[9px] leading-4">{finding.evidence}</p> : null}</div>)}</div> : null}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setQuestion(latest.follow_up)} className="min-h-14 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-white"><span className="block text-[9px] uppercase opacity-75">Adaptive follow-up</span><span className="mt-1 block line-clamp-2">{latest.follow_up}</span></button><button type="button" onClick={() => setQuestion(latest.next_question)} className="min-h-14 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-sm font-black"><span className="block text-[9px] uppercase text-[var(--ink-soft)]">Next competency</span><span className="mt-1 block line-clamp-2">{latest.next_question}</span></button></div>
                </section> : null}

                <section className={`${panelClass} p-5`}><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black">Session · {history.length} coached answer{history.length === 1 ? '' : 's'}</p><p className="mt-1 text-xs text-[var(--ink-soft)]">Content {report.content_average} · Delivery {report.delivery_average} · Readiness {report.readiness_average}</p></div><div className="flex gap-2"><button type="button" onClick={finishSession} disabled={!history.length} className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-black disabled:opacity-40">Finish session</button><button type="button" onClick={resetInterview} className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-black"><RotateCcw className="h-4 w-4" /> Reset</button></div></div></section>
              </div>
            </section>

            {sessionState === 'complete' ? <section className={`${panelClass} p-6 md:p-8`}><div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><div><h2 className="text-2xl font-black">Interview session report</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Your latest session has been saved locally to progress history.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[var(--surface-border)] p-4"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Content average</p><p className="mt-1 text-3xl font-black">{report.content_average}</p></div><div className="rounded-2xl border border-[var(--surface-border)] p-4"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Delivery average</p><p className="mt-1 text-3xl font-black">{report.delivery_average}</p></div><div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="text-[9px] font-black uppercase text-[var(--accent-strong)]">Readiness average</p><p className="mt-1 text-3xl font-black">{report.readiness_average}</p></div></div>{report.strongest_turn ? <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-950">Strongest answer · {report.strongest_turn.score}</p><p className="mt-2 text-[11px] leading-5 text-emerald-900">{report.strongest_turn.question}</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-950">Priority answer · {report.weakest_turn?.score}</p><p className="mt-2 text-[11px] leading-5 text-amber-900">{report.weakest_turn?.question}</p></div></div> : null}<div className="mt-6 space-y-3">{history.map((item, index) => <div key={`${item.question}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase text-[var(--accent-strong)]">Question {index + 1}</p><p className="mt-1 text-xs font-black">{item.question}</p></div><div className="flex gap-3 text-[10px] font-black"><span>C {item.total}</span><span>D {item.delivery.score}</span><span>R {item.readiness}</span></div></div></div>)}</div><button type="button" onClick={resetInterview} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-black text-white"><RotateCcw className="h-4 w-4" /> Start another practice</button></section> : null}
          </>
        )}
      </div>
    </main>
  );
}
