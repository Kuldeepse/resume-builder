'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Clock3,
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
  buildMicroDrills,
  buildProgressInsights,
  buildTargetedRetry,
  combineInterviewReadiness,
} from '../../lib/interview-performance.mjs';

type InterviewState = 'setup' | 'active' | 'complete';
type CoachState = 'ready' | 'speaking' | 'listening' | 'thinking';
type InterviewType = 'hr' | 'behavioural' | 'technical';
type PracticeMode = 'learn' | 'practice' | 'assessment';
type Demeanour = 'supportive' | 'recruiter' | 'neutral' | 'challenging' | 'skeptical' | 'time_pressured' | 'executive' | 'architect' | 'product' | 'risk' | 'technical';
type CoachMode = 'ai' | 'fallback';
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

type CoachAssessment = {
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
};

type Assessment = CoachAssessment & {
  mode: CoachMode;
  delivery: DeliveryAnalytics;
  readiness: number;
  retry_targets: string[];
  transcript_segments: TranscriptSegment[];
  recording_url?: string;
};

type CoachResponse = { mode: CoachMode; assessment: CoachAssessment };
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
  evidenceScore?: number;
  structureScore?: number | null;
  technicalDepthScore?: number | null;
  communicationScore?: number;
  contentDimensions?: Array<{ key: string; label: string; score: number }>;
  deliveryDimensions?: Array<{ key: string; label: string; score: number }>;
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
    description: 'Motivation, fit, credibility and practical readiness.',
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
    description: 'STAR, ownership, judgement, stakeholders and measurable outcomes.',
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
    description: 'Architecture, depth, trade-offs, controls and operational readiness.',
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
  learn: { label: 'Learn', description: 'See exact-question guidance before answering.' },
  practice: { label: 'Practice', description: 'Answer first; guidance unlocks after coaching.' },
  assessment: { label: 'Assessment', description: 'No hints during the session; review at the end.' },
};

const DEMEANOURS: Record<Demeanour, { label: string; description: string }> = {
  supportive: { label: 'Supportive coach', description: 'Calm, encouraging and gives space to structure.' },
  recruiter: { label: 'Recruiter', description: 'Motivation, credibility, fit and practical readiness.' },
  neutral: { label: 'Hiring manager', description: 'Balanced evidence-led hiring-manager style.' },
  challenging: { label: 'Challenging director', description: 'Pushes for precision, ownership and evidence.' },
  skeptical: { label: 'Skeptical interviewer', description: 'Questions assumptions and asks for proof.' },
  time_pressured: { label: 'Time-pressured interviewer', description: 'Requires concise answers and rapid decisions.' },
  executive: { label: 'Executive', description: 'Outcome, business impact and trade-off focused.' },
  architect: { label: 'Principal architect', description: 'Architecture, dependencies, NFRs and technical decisions.' },
  product: { label: 'Product leader', description: 'Users, prioritisation, outcomes and product judgement.' },
  risk: { label: 'Risk & controls', description: 'Governance, controls, assurance and residual risk.' },
  technical: { label: 'Technical interviewer', description: 'Probes implementation context, controls and decisions.' },
};

const PANEL: Array<{ label: string; demeanour: Demeanour }> = [
  { label: 'Hiring Manager', demeanour: 'neutral' },
  { label: 'Principal Architect', demeanour: 'architect' },
  { label: 'Product Director', demeanour: 'product' },
  { label: 'Risk Lead', demeanour: 'risk' },
];

const LANGUAGES = [
  { code: 'en-GB', label: 'English · UK' },
  { code: 'en-US', label: 'English · US' },
  { code: 'hi-IN', label: 'Hindi · India' },
  { code: 'es-ES', label: 'Spanish · Spain' },
  { code: 'fr-FR', label: 'French · France' },
  { code: 'de-DE', label: 'German · Germany' },
];

const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';
const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';
const PROGRESS_KEY = 'cognitwist-interview-progress-v2';
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
    const v2: unknown = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || '[]');
    if (Array.isArray(v2) && v2.length) return (v2 as ProgressSession[]).slice(0, 50);
    const legacy: unknown = JSON.parse(window.localStorage.getItem('cognitwist-interview-progress-v1') || '[]');
    return Array.isArray(legacy) ? (legacy as ProgressSession[]).slice(0, 50) : [];
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
  if (demeanour === 'skeptical') return `Do not give me a generic answer; prove your contribution. ${clean}`;
  if (demeanour === 'time_pressured') return `You have about 90 seconds. Be concise. ${clean}`;
  if (demeanour === 'executive') return `Keep this outcome and business-impact focused. ${clean}`;
  if (demeanour === 'architect') return `Be explicit about architecture, dependencies and technical decisions. ${clean}`;
  if (demeanour === 'product') return `Connect your answer to users, prioritisation and measurable outcomes. ${clean}`;
  if (demeanour === 'risk') return `Explain the control, assurance and residual-risk decision. ${clean}`;
  if (demeanour === 'technical') return `Be technically specific about your decisions and validation. ${clean}`;
  if (demeanour === 'recruiter') return `Keep your answer credible, relevant and specific to this opportunity. ${clean}`;
  if (demeanour === 'supportive') return `Take a moment to structure your answer. ${clean}`;
  return clean;
}

function fallbackExpected(role: string, company: string, jobDescription: string, interviewType: InterviewType, question: string, candidateEvidence: string[]): ExpectedResponse {
  const raw = buildExpectedInterviewResponse({
    role,
    company,
    job_description: jobDescription,
    interview_type: interviewType,
    question,
    candidate_evidence: candidateEvidence,
  }) as {
    intent?: string;
    interviewer_testing?: string[];
    structure?: string;
    expected_response?: string;
    relevant_evidence?: string[];
    missing_evidence?: string[];
    basis?: string;
  };
  return {
    mode: 'fallback',
    question,
    intent_summary: raw.intent || `Guidance for: ${question}`,
    interviewer_testing: raw.interviewer_testing || [],
    structure: raw.structure || '',
    expected_response: raw.expected_response || `Answer this exact question directly: ${question}`,
    relevant_evidence: raw.relevant_evidence || [],
    evidence_gaps: raw.missing_evidence || [],
    response_basis: raw.basis === 'verified_evidence' ? 'verified_evidence' : 'illustrative_model',
  };
}

export default function LiveInterviewV3() {
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioural');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('learn');
  const [demeanour, setDemeanour] = useState<Demeanour>('neutral');
  const [panelMode, setPanelMode] = useState(false);
  const [role, setRole] = useState('Technical Programme Manager');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [candidateEvidence, setCandidateEvidence] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState('');
  const [targetQuestions, setTargetQuestions] = useState(6);
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [language, setLanguage] = useState('en-GB');
  const [adaptiveSpeechRate, setAdaptiveSpeechRate] = useState(true);
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
  const speechStartedAtRef = useRef<number | null>(null);
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const currentAudioUrlRef = useRef('');
  const recordingResolverRef = useRef<((url: string) => void) | null>(null);
  const storedRecordingUrlsRef = useRef<string[]>([]);
  const expectedAbortRef = useRef<AbortController | null>(null);
  const sessionSavedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const config = INTERVIEW_TYPES[interviewType];
  const latest = history[history.length - 1];
  const activePersona = panelMode ? PANEL[history.length % PANEL.length] : { label: DEMEANOURS[demeanour].label, demeanour };
  const languageLabel = LANGUAGES.find((item) => item.code === language)?.label || language;
  const filteredVoices = useMemo(() => {
    const prefix = language.split('-')[0].toLowerCase();
    const matching = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(prefix));
    return matching.length ? matching : voices;
  }, [voices, language]);

  const report = useMemo(() => buildInterviewSessionReport(history.map((item) => ({
    question: item.question,
    content_score: item.total,
    delivery_score: item.delivery.score,
    readiness_score: item.readiness,
    content_dimensions: item.dimensions,
    delivery_dimensions: item.delivery.dimensions,
    evidence_findings: item.evidence_findings,
  }))), [history]);
  const progressInsights = useMemo(() => buildProgressInsights(progress, role), [progress, role]);
  const microDrills = useMemo(() => latest ? buildMicroDrills({ question: latest.question, retry_targets: latest.retry_targets }) : [], [latest]);

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    setRecordingSupported(typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices !== 'undefined');
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
    if (Array.isArray(context.candidateEvidence)) {
      setCandidateEvidence(context.candidateEvidence.map((item) => String(item).slice(0, 1200)).filter(Boolean).slice(0, 30));
    }

    try {
      const stored = JSON.parse(window.localStorage.getItem(TTS_KEY) || '{}') as { voiceURI?: string; rate?: number; language?: string; adaptive?: boolean };
      setVoiceURI(stored.voiceURI || 'auto');
      if (typeof stored.language === 'string' && LANGUAGES.some((item) => item.code === stored.language)) setLanguage(stored.language);
      if (typeof stored.adaptive === 'boolean') setAdaptiveSpeechRate(stored.adaptive);
      const rate = Number(stored.rate);
      if (Number.isFinite(rate)) setSpeechRate(Math.max(0.7, Math.min(1.3, rate)));
    } catch { /* local storage can be unavailable */ }
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    const synth = window.speechSynthesis;
    const loadVoices = () => setVoices(synth.getVoices().sort((a, b) => `${a.lang}-${a.name}`.localeCompare(`${b.lang}-${b.name}`)));
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    return () => synth.removeEventListener?.('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(TTS_KEY, JSON.stringify({ voiceURI, rate: speechRate, language, adaptive: adaptiveSpeechRate })); } catch { /* no-op */ }
  }, [voiceURI, speechRate, language, adaptiveSpeechRate]);

  useEffect(() => {
    if (sessionState !== 'active') return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionState]);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* no-op */ }
    expectedAbortRef.current?.abort();
    window.speechSynthesis?.cancel();
    if (mediaRecorderRef.current?.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch { /* no-op */ }
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    storedRecordingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
  }, []);

  useEffect(() => {
    if (sessionState !== 'active' || practiceMode === 'assessment' || !role.trim() || !currentQuestion.trim()) {
      setExpected(null);
      setExpectedLoading(false);
      return undefined;
    }
    const question = currentQuestion.trim();
    const context = `${jobDescription.trim()}\n\nPractice focus: ${focusAreas || 'role-relevant competencies'}. Interview language: ${languageLabel}. Return guidance in this language.`.trim();
    const fallback = fallbackExpected(role, company, context, interviewType, question, candidateEvidence);
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
          body: JSON.stringify({
            role: role.trim(),
            company: company.trim(),
            job_description: context,
            interview_type: interviewType,
            question,
            candidate_evidence: candidateEvidence,
            history: history.map((item) => ({ question: item.question, answer: item.answer, score: item.total })).slice(-8),
          }),
        });
        const data = await response.json().catch(() => null) as ExpectedResponse | null;
        if (response.ok && data?.question === question && data.expected_response?.trim()) setExpected(data);
      } catch {
        setExpected(fallback);
      } finally {
        if (expectedAbortRef.current === controller) {
          expectedAbortRef.current = null;
          setExpectedLoading(false);
        }
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [sessionState, practiceMode, role, company, jobDescription, focusAreas, languageLabel, interviewType, currentQuestion, candidateEvidence, history]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) {
      setCoachState('ready');
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const available = synth.getVoices();
    const prefix = language.split('-')[0].toLowerCase();
    const selected = voiceURI === 'auto'
      ? available.find((voice) => voice.lang === language) || available.find((voice) => voice.lang?.toLowerCase().startsWith(prefix))
      : available.find((voice) => voice.voiceURI === voiceURI);
    if (selected) {
      utterance.voice = selected;
      utterance.lang = selected.lang;
    } else {
      utterance.lang = language;
    }
    utterance.rate = speechRate;
    utterance.onstart = () => setCoachState('speaking');
    utterance.onend = () => setCoachState('ready');
    utterance.onerror = () => setCoachState('ready');
    synth.speak(utterance);
  }, [voiceEnabled, voiceURI, speechRate, language]);

  const stopRecognition = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* no-op */ }
    recognitionRef.current = null;
    setIsListening(false);
    setCoachState((state) => state === 'listening' ? 'ready' : state);
  }, []);

  const startRecorder = async () => {
    if (!recordingSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      currentAudioUrlRef.current = '';
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = blob.size > 0 ? URL.createObjectURL(blob) : '';
        currentAudioUrlRef.current = url;
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        recordingResolverRef.current?.(url);
        recordingResolverRef.current = null;
      };
      recorder.start(250);
      setIsRecording(true);
    } catch {
      setRecordingSupported(false);
      setNotice('Audio recording is unavailable, but transcription and typed practice still work.');
    }
  };

  const stopRecorder = () => new Promise<string>((resolve) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      resolve(currentAudioUrlRef.current);
      return;
    }
    recordingResolverRef.current = resolve;
    try { recorder.stop(); } catch { resolve(currentAudioUrlRef.current); }
  });

  const startCapture = async () => {
    if (!speechSupported) {
      setNotice('Speech recognition is unavailable in this browser. Type your answer instead.');
      return;
    }
    window.speechSynthesis?.cancel();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognitionRef.current = recognition;
    baseAnswerRef.current = answer.trim();
    transcriptSegmentsRef.current = [];
    speechStartedAtRef.current = performance.now();
    answerStartedAtRef.current = performance.now();

    recognition.onresult = (event) => {
      let transcript = '';
      const startIndex = Math.max(0, event.resultIndex || 0);
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += `${result[0].transcript} `;
        if (index >= startIndex && result.isFinal) {
          const text = result[0].transcript.trim();
          const atMs = speechStartedAtRef.current ? performance.now() - speechStartedAtRef.current : 0;
          if (text) transcriptSegmentsRef.current.push({ at_ms: Math.round(atMs), text });
        }
      }
      setAnswer(`${baseAnswerRef.current} ${transcript}`.replace(/\s+/g, ' ').trim());
    };
    recognition.onerror = () => {
      setNotice('The microphone could not capture your answer. Check permission or type your response.');
      setIsListening(false);
      setCoachState('ready');
    };
    recognition.onend = () => {
      setIsListening(false);
      setCoachState('ready');
    };

    try {
      recognition.start();
      setIsListening(true);
      setCoachState('listening');
      setNotice(recordingSupported ? 'Listening and recording. Press Stop when you finish.' : 'Listening. Press Stop when you finish.');
      void startRecorder();
    } catch {
      setNotice('The microphone is already active or unavailable.');
    }
  };

  const stopCapture = () => {
    stopRecognition();
    void stopRecorder();
  };

  const clearUnsubmittedRecording = () => {
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = '';
    }
  };

  const setQuestion = (question: string, applyStyle = true) => {
    const clean = question.trim();
    if (!clean) return;
    stopRecognition();
    void stopRecorder();
    clearUnsubmittedRecording();
    const persona = panelMode ? PANEL[history.length % PANEL.length] : { label: DEMEANOURS[demeanour].label, demeanour };
    const next = applyStyle ? styleQuestion(clean, persona.demeanour) : clean;
    setCurrentQuestion(next);
    setQuestionDraft('');
    setAnswer('');
    setError('');
    setGuidanceRevealed(false);
    answerStartedAtRef.current = null;
    speechStartedAtRef.current = null;
    transcriptSegmentsRef.current = [];
    setNotice(`Question ready · ${persona.label}. Content and delivery are assessed separately.`);
    window.setTimeout(() => speak(next), 80);
  };

  const startInterview = () => {
    if (!role.trim()) {
      setError('Enter the exact target role before starting practice.');
      return;
    }
    const persona = panelMode ? PANEL[0] : { label: DEMEANOURS[demeanour].label, demeanour };
    const opening = styleQuestion(INTERVIEW_TYPES[interviewType].opening, persona.demeanour);
    setHistory([]);
    sessionSavedRef.current = false;
    setElapsed(0);
    setCurrentQuestion(opening);
    setAnswer('');
    setError('');
    setGuidanceRevealed(false);
    setNotice(`${MODES[practiceMode].label} mode started · ${targetQuestions} questions / ${targetMinutes} minutes target.`);
    setSessionState('active');
    window.setTimeout(() => speak(`Welcome to your ${INTERVIEW_TYPES[interviewType].label.toLowerCase()} practice for the ${role.trim()} role. ${opening}`), 120);
  };

  const submitAnswer = async () => {
    if (!answer.trim() || analysing) {
      if (!answer.trim()) setError('Speak or type an answer before requesting coaching.');
      return;
    }
    stopRecognition();
    window.speechSynthesis?.cancel();
    setAnalysing(true);
    setCoachState('thinking');
    setError('');
    setNotice('Analysing exact-question content, evidence and communication delivery…');

    const endedAt = performance.now();
    const startedAt = answerStartedAtRef.current || endedAt;
    const durationSec = Math.max(0, (endedAt - startedAt) / 1000);
    const segments = [...transcriptSegmentsRef.current];
    const source = speechStartedAtRef.current ? 'speech' : 'typed';
    const recordingPromise = stopRecorder();
    const delivery = analyseInterviewDelivery({ text: answer.trim(), duration_sec: durationSec, source, segments }) as DeliveryAnalytics;

    try {
      const persona = panelMode ? PANEL[history.length % PANEL.length] : { label: DEMEANOURS[demeanour].label, demeanour };
      const response = await fetch('/api/interview-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role.trim(),
          company: company.trim(),
          job_description: `${jobDescription.trim()}\n\nInterview simulation: ${persona.label}. ${DEMEANOURS[persona.demeanour].description}\nPractice focus: ${focusAreas || 'role-relevant competencies'}.\nInterview language: ${languageLabel}. Return coaching in this language.`.trim(),
          interview_type: interviewType,
          question: currentQuestion,
          answer: answer.trim(),
          candidate_evidence: candidateEvidence,
          history: history.map((item) => ({ question: item.question, answer: item.answer, score: item.total })).slice(-8),
        }),
      });
      const data = await response.json().catch(() => null) as CoachResponse | { detail?: string } | null;
      if (!response.ok || !data || !('assessment' in data)) {
        const detail = data && 'detail' in data ? data.detail : '';
        throw new Error(detail || 'Interview coaching could not complete this turn.');
      }

      const recordingUrl = await Promise.race([
        recordingPromise,
        new Promise<string>((resolve) => window.setTimeout(() => resolve(currentAudioUrlRef.current), 1800)),
      ]);
      if (recordingUrl) {
        storedRecordingUrlsRef.current.push(recordingUrl);
        currentAudioUrlRef.current = '';
      }
      const readiness = combineInterviewReadiness(data.assessment.total, delivery.score);
      const retryTargets = buildTargetedRetry({ content_dimensions: data.assessment.dimensions, delivery }) as string[];
      const item: Assessment = {
        ...data.assessment,
        mode: data.mode,
        delivery,
        readiness,
        retry_targets: retryTargets,
        transcript_segments: segments,
        recording_url: recordingUrl || undefined,
      };
      setHistory((items) => [...items, item]);
      setGuidanceRevealed(practiceMode !== 'assessment');
      if (adaptiveSpeechRate && source === 'speech' && delivery.wpm > 0) {
        const matched = Math.max(0.85, Math.min(1.15, 1 + (delivery.wpm - 145) / 450));
        setSpeechRate(Math.round(matched * 20) / 20);
      }
      const completed = history.length + 1;
      setNotice(`${data.mode === 'ai' ? 'Adaptive AI' : 'Fallback'} coaching complete · Content ${item.total}/100 · Delivery ${delivery.score}/100 · Readiness ${readiness}/100.${completed >= targetQuestions ? ' Target question count reached.' : ''}`);
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
    const summary: ProgressSession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      role: role.trim(),
      company: company.trim(),
      interviewType,
      practiceMode,
      demeanour: panelMode ? 'neutral' : demeanour,
      turns: report.turns,
      contentAverage: report.content_average,
      deliveryAverage: report.delivery_average,
      readinessAverage: report.readiness_average,
      evidenceScore: report.evidence_score,
      structureScore: report.structure_score,
      technicalDepthScore: report.technical_depth_score,
      communicationScore: report.communication_score,
      contentDimensions: report.content_dimensions,
      deliveryDimensions: report.delivery_dimensions,
    };
    const next = [summary, ...readProgress()].slice(0, 50);
    try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch { /* no-op */ }
    setProgress(next);
    sessionSavedRef.current = true;
  };

  const finishSession = () => {
    saveSession();
    setGuidanceRevealed(true);
    setSessionState('complete');
  };

  const resetInterview = () => {
    stopRecognition();
    void stopRecorder();
    window.speechSynthesis?.cancel();
    clearUnsubmittedRecording();
    storedRecordingUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    storedRecordingUrlsRef.current = [];
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

  const seekRecording = (atMs: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, atMs / 1000);
    void audioRef.current.play().catch(() => undefined);
  };

  const exportSession = () => {
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      role,
      company,
      interview_type: interviewType,
      practice_mode: practiceMode,
      panel_mode: panelMode,
      language,
      focus_areas: focusAreas,
      report,
      turns: history.map((item) => ({
        question: item.question,
        answer: item.answer,
        content_score: item.total,
        delivery_score: item.delivery.score,
        readiness_score: item.readiness,
        dimensions: item.dimensions,
        delivery: item.delivery,
        evidence_findings: item.evidence_findings,
        retry_targets: item.retry_targets,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cognitwist-interview-${Date.now()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><BrainCircuit className="h-3.5 w-3.5" /> Interview Coach v3.1 · Performance Intelligence</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Content intelligence + communication performance.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Practise against the exact vacancy and verified evidence while CogniTwist separately measures answer quality, pace, fillers, repetition, ownership, fluency and progress.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-xs font-black"><Clock3 className="h-4 w-4 text-[var(--accent-strong)]" /> {formatTime(elapsed)} / {targetMinutes}:00</div>
          </div>
        </section>

        {sessionState === 'setup' && (
          <section className={`${panelClass} p-5 md:p-7`}>
            <div className="flex items-center gap-3"><Target className="h-5 w-5 text-[var(--accent-strong)]" /><div><h2 className="text-xl font-black">Configure the simulation</h2><p className="text-xs text-[var(--ink-soft)]">Vacancy and evidence context loads automatically from Job Intelligence when available.</p></div></div>
            <div className="mt-6 space-y-6">
              <fieldset><legend className="text-xs font-black">Coaching mode</legend><div className="mt-2 grid gap-2 md:grid-cols-3">{(Object.keys(MODES) as PracticeMode[]).map((mode) => <button key={mode} type="button" onClick={() => setPracticeMode(mode)} className={`rounded-2xl border p-4 text-left ${practiceMode === mode ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-xs">{MODES[mode].label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--ink-soft)]">{MODES[mode].description}</span></button>)}</div></fieldset>
              <fieldset><legend className="text-xs font-black">Interview stage</legend><div className="mt-2 grid gap-2 md:grid-cols-3">{(Object.keys(INTERVIEW_TYPES) as InterviewType[]).map((type) => <button key={type} type="button" onClick={() => { setInterviewType(type); setCurrentQuestion(INTERVIEW_TYPES[type].opening); }} className={`rounded-2xl border p-4 text-left ${interviewType === type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-xs">{INTERVIEW_TYPES[type].label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--ink-soft)]">{INTERVIEW_TYPES[type].description}</span></button>)}</div></fieldset>
              <fieldset><legend className="text-xs font-black">Interviewer / panel</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><button type="button" onClick={() => setPanelMode(true)} className={`rounded-2xl border p-3 text-left ${panelMode ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-[11px]">4-person panel</strong><span className="mt-1 block text-[9px] leading-4 text-[var(--ink-soft)]">Hiring Manager → Architect → Product → Risk</span></button>{(Object.keys(DEMEANOURS) as Demeanour[]).map((style) => <button key={style} type="button" onClick={() => { setPanelMode(false); setDemeanour(style); }} className={`rounded-2xl border p-3 text-left ${!panelMode && demeanour === style ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-[11px]">{DEMEANOURS[style].label}</strong><span className="mt-1 block text-[9px] leading-4 text-[var(--ink-soft)]">{DEMEANOURS[style].description}</span></button>)}</div></fieldset>
              <div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-black">Target role<input value={role} onChange={(event) => setRole(event.target.value)} className={`${inputClass} mt-2`} /></label><label className="text-xs font-black">Company<input value={company} onChange={(event) => setCompany(event.target.value)} className={`${inputClass} mt-2`} /></label></div>
              <label className="text-xs font-black">Job description / role context<textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={5} className={`${inputClass} mt-2 resize-y text-xs leading-6`} /></label>
              <label className="text-xs font-black">Focus areas<input value={focusAreas} onChange={(event) => setFocusAreas(event.target.value)} placeholder="e.g. stakeholder conflict, architecture, release readiness" className={`${inputClass} mt-2`} /></label>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-black">Questions<input type="number" min={1} max={20} value={targetQuestions} onChange={(event) => setTargetQuestions(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} className={`${inputClass} mt-2`} /></label><label className="text-xs font-black">Minutes<input type="number" min={5} max={120} value={targetMinutes} onChange={(event) => setTargetMinutes(Math.max(5, Math.min(120, Number(event.target.value) || 5)))} className={`${inputClass} mt-2`} /></label><label className="text-xs font-black">Language<select value={language} onChange={(event) => { setLanguage(event.target.value); setVoiceURI('auto'); }} className={`${inputClass} mt-2`}>{LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label className="text-xs font-black">Adaptive TTS<select value={adaptiveSpeechRate ? 'on' : 'off'} onChange={(event) => setAdaptiveSpeechRate(event.target.value === 'on')} className={`${inputClass} mt-2`}><option value="on">On · match speaking pace</option><option value="off">Off · manual speed</option></select></label></div>
              <div className="grid gap-4 lg:grid-cols-[1fr_220px]"><label className="text-xs font-black">Coach voice<select value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)} className={`${inputClass} mt-2`}><option value="auto">Auto · best {languageLabel} voice</option>{filteredVoices.map((voice) => <option key={`${voice.voiceURI}-${voice.lang}`} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></label><label className="text-xs font-black"><span className="flex justify-between"><span>Speech speed</span><span>{speechRate.toFixed(2)}×</span></span><input className="mt-4 w-full" type="range" min="0.7" max="1.3" step="0.05" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} /></label></div>
              {progressInsights.sessions > 0 && <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex items-center gap-2"><History className="h-4 w-4 text-[var(--accent-strong)]" /><p className="text-xs font-black">Progress for {role}</p></div><div className="mt-3 grid gap-2 sm:grid-cols-4"><Metric label="First" value={String(progressInsights.first?.readinessAverage ?? '—')} /><Metric label="Latest" value={String(progressInsights.latest?.readinessAverage ?? '—')} /><Metric label="Best" value={String(progressInsights.best?.readinessAverage ?? '—')} /><Metric label="Change" value={`${progressInsights.readiness_delta >= 0 ? '+' : ''}${progressInsights.readiness_delta}`} /></div></div>}
              {error && <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>}
              <button type="button" onClick={startInterview} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white"><Play className="h-4 w-4" /> Start {MODES[practiceMode].label.toLowerCase()} session</button>
            </div>
          </section>
        )}

        {sessionState === 'active' && (
          <section className="grid gap-6 xl:grid-cols-[0.65fr_1.35fr]">
            <div className="space-y-4">
              <section className={`${panelClass} overflow-hidden`}><div className="relative flex min-h-[320px] flex-col items-center justify-center bg-[radial-gradient(circle_at_top,var(--accent-soft),transparent_58%),linear-gradient(145deg,#132238,#07111f)] p-7 text-white"><div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/20 px-3 py-2 text-[10px] font-black uppercase">{statusLabel}</div><div className={`flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl ${coachState === 'thinking' || coachState === 'speaking' ? 'animate-pulse' : ''}`}><BrainCircuit className="h-16 w-16" /></div><p className="mt-5 text-lg font-black">{activePersona.label}</p><p className="mt-2 max-w-sm text-center text-xs leading-6 text-white/70">{panelMode ? 'Panel interview' : 'Single interviewer'} · {MODES[practiceMode].label} · {config.label}</p><div className="mt-5 flex gap-2"><span className="rounded-full border border-white/20 px-3 py-1.5 text-[9px] font-black">{history.length}/{targetQuestions} turns</span>{isRecording && <span className="rounded-full border border-rose-300/50 bg-rose-500/20 px-3 py-1.5 text-[9px] font-black">● recording</span>}</div></div></section>
              <section className={`${panelClass} p-5`}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-strong)]" /><div><h2 className="text-sm font-black">Evidence guard</h2><p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">Content coaching uses only the answer, vacancy and available candidate evidence. Delivery analytics never create career claims.</p></div></div></section>
            </div>

            <div className="space-y-5">
              <section className={`${panelClass} p-5 md:p-7`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Current question</p><h2 className="mt-3 text-xl font-black leading-8 md:text-2xl">{currentQuestion}</h2></div><button type="button" onClick={() => speak(currentQuestion)} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2 text-[11px] font-black">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Repeat</button></div><div className="mt-5 flex gap-2"><input value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder="Practise another interview question…" className={`${inputClass} min-w-0 flex-1`} /><button type="button" onClick={() => setQuestion(questionDraft)} disabled={!questionDraft.trim()} className="rounded-xl bg-[var(--accent)] px-4 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{config.suggestions.map((question) => <button key={question} type="button" onClick={() => setQuestion(question)} className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-2 text-[10px] font-bold text-[var(--ink-soft)]">{question.slice(0, 55)}{question.length > 55 ? '…' : ''}</button>)}</div></section>

              {showGuidance && expected ? <section className={`${panelClass} p-5 md:p-7`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Expected response for this exact question</p><p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{expected.intent_summary}</p></div><div className="flex items-center gap-2">{expectedLoading && <RefreshCw className="h-4 w-4 animate-spin" />}<span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${expected.mode === 'ai' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{expected.mode === 'ai' ? 'Adaptive AI' : 'Fallback'}</span></div></div><div className="mt-4 flex flex-wrap gap-1.5">{expected.interviewer_testing.map((item) => <span key={item} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[9px] font-black">{item}</span>)}</div><div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">Best structure</p><p className="mt-2 text-xs leading-6">{expected.structure}</p><p className="mt-4 text-[9px] font-black uppercase text-[var(--ink-soft)]">Expected response</p><pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-6">{expected.expected_response}</pre></div></section> : practiceMode !== 'learn' ? <section className={`${panelClass} p-5`}><p className="text-xs font-black">Guidance hidden in {MODES[practiceMode].label} mode</p><p className="mt-1 text-[11px] leading-5 text-[var(--ink-soft)]">{practiceMode === 'practice' ? 'It unlocks after this answer is coached.' : 'It stays hidden throughout the assessment.'}</p></section> : null}

              <section className={`${panelClass} p-5 md:p-7`}><div className="flex items-center justify-between gap-3"><label htmlFor="interview-answer" className="text-xs font-black">Your answer</label><button type="button" onClick={() => setVoiceEnabled((value) => !value)} className="rounded-lg border border-[var(--surface-border)] p-2">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div><textarea id="interview-answer" value={answer} onChange={(event) => onTypedAnswer(event.target.value)} rows={8} className={`${inputClass} mt-2 resize-y leading-7`} placeholder="Speak or type your answer. CogniTwist scores content and delivery separately." /><div className="mt-3 flex flex-wrap gap-2">{isListening ? <button type="button" onClick={stopCapture} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-xs font-black text-rose-900"><Square className="h-4 w-4" /> Stop</button> : <button type="button" onClick={startCapture} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black"><Mic className="h-4 w-4" /> Speak & record</button>}<button type="button" onClick={submitAnswer} disabled={analysing || !answer.trim()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-xs font-black text-white disabled:opacity-45">{analysing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{analysing ? 'Analysing…' : 'Coach this answer'}</button></div>{!speechSupported && <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ink-soft)]"><MicOff className="h-3.5 w-3.5" /> Speech recognition unavailable; typed practice remains available.</div>}{notice && <div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6">{notice}</div>}{error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>}</section>

              {latest && <section className={`${panelClass} p-5 md:p-7`}><div className="grid gap-3 sm:grid-cols-3"><ScoreCard label="Content" score={latest.total} /><ScoreCard label="Delivery" score={latest.delivery.score} /><ScoreCard label="Readiness" score={latest.readiness} accent /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Pace" value={latest.delivery.wpm ? `${latest.delivery.wpm} WPM` : '—'} /><Metric label="Fillers" value={String(latest.delivery.filler_count)} /><Metric label="Long pauses" value={String(latest.delivery.long_pause_count)} /><Metric label="I / we ownership" value={`${latest.delivery.ownership.i_ratio_pct}%`} /></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><FeedbackBox title="Content strengths" items={latest.strengths} tone="good" /><FeedbackBox title="Delivery coaching" items={latest.delivery.coaching} tone="warn" /></div><div className="mt-5 grid gap-3 md:grid-cols-5">{latest.dimensions.map((dimension) => <div key={dimension.key} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-3"><div className="flex justify-between gap-2"><p className="text-[9px] font-black">{dimension.label}</p><span className="text-[10px] font-black">{dimension.score}/20</span></div><p className="mt-2 text-[9px] leading-4 text-[var(--ink-soft)]">{dimension.rationale}</p></div>)}</div>{latest.recording_url && <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-xs font-black">Answer replay</p><audio ref={audioRef} className="mt-3 w-full" controls src={latest.recording_url} /></div>}{latest.transcript_segments.length > 0 && <div className="mt-5 rounded-2xl border border-[var(--surface-border)] p-4"><p className="text-xs font-black">Timestamped transcript · click a timestamp to replay that moment</p><div className="mt-3 space-y-2">{latest.transcript_segments.map((segment, index) => <button type="button" key={`${segment.at_ms}-${index}`} onClick={() => seekRecording(segment.at_ms)} disabled={!latest.recording_url} className="block w-full rounded-xl border border-transparent p-2 text-left text-[10px] leading-5 hover:border-[var(--surface-border)] disabled:cursor-default"><span className="mr-2 font-black text-[var(--accent-strong)]">{formatTime(Math.round(segment.at_ms / 1000))}</span>{segment.text}</button>)}</div></div>}<div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex justify-between gap-3"><p className="text-xs font-black">Stronger response</p><button type="button" onClick={copyRevision} className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-[9px] font-black"><Clipboard className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}</button></div><pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-6 text-[var(--ink-soft)]">{latest.revised_answer}</pre></div><div className="mt-5 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4"><p className="text-xs font-black">Targeted micro-drills</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{microDrills.map((drill) => <div key={drill.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3"><div className="flex justify-between gap-2"><p className="text-[10px] font-black">{drill.title}</p><span className="text-[9px] font-black">{drill.duration_minutes} min</span></div><p className="mt-2 text-[9px] leading-4 text-[var(--ink-soft)]">{drill.instruction}</p><p className="mt-2 text-[9px] font-semibold">Target: {drill.success_criteria}</p></div>)}</div><button type="button" onClick={() => { setQuestion(latest.question, false); setNotice(`Retry targets: ${latest.retry_targets.join(' ')}`); }} className="mt-3 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-black text-white">Retry this question</button></div>{latest.evidence_findings.length > 0 && <div className="mt-5 grid gap-2">{latest.evidence_findings.map((finding, index) => <div key={`${finding.claim}-${index}`} className={`rounded-xl border p-3 ${evidenceTone(finding.status)}`}><div className="flex justify-between gap-2"><p className="text-[10px] font-black">{finding.claim}</p><span className="text-[8px] font-black uppercase">{finding.status}</span></div>{finding.evidence && <p className="mt-1 text-[9px] leading-4">{finding.evidence}</p>}</div>)}</div>}<div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setQuestion(latest.follow_up)} className="min-h-14 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-white"><span className="block text-[9px] uppercase opacity-75">Adaptive follow-up</span><span className="mt-1 block line-clamp-2">{latest.follow_up}</span></button><button type="button" onClick={() => setQuestion(latest.next_question)} className="min-h-14 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-sm font-black"><span className="block text-[9px] uppercase text-[var(--ink-soft)]">Next competency</span><span className="mt-1 block line-clamp-2">{latest.next_question}</span></button></div></section>}

              <section className={`${panelClass} p-5`}><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black">Session · {history.length}/{targetQuestions} coached answer{history.length === 1 ? '' : 's'}</p><p className="mt-1 text-xs text-[var(--ink-soft)]">Content {report.content_average} · Delivery {report.delivery_average} · Readiness {report.readiness_average}</p></div><div className="flex gap-2"><button type="button" onClick={finishSession} disabled={!history.length} className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-black disabled:opacity-40">Finish session</button><button type="button" onClick={resetInterview} className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-black"><RotateCcw className="h-4 w-4" /> Reset</button></div></div></section>
            </div>
          </section>
        )}

        {sessionState === 'complete' && (
          <section className={`${panelClass} p-6 md:p-8`}><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-emerald-600" /><div><h2 className="text-2xl font-black">Interview session report</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Saved locally to progress history. Readiness weights content 70% and delivery 30%.</p></div></div><button type="button" onClick={exportSession} className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-black">Export report JSON</button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><ScoreCard label="Content average" score={report.content_average} /><ScoreCard label="Delivery average" score={report.delivery_average} /><ScoreCard label="Readiness average" score={report.readiness_average} accent /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Evidence" value={String(report.evidence_score)} /><Metric label="Structure" value={report.structure_score == null ? '—' : String(report.structure_score)} /><Metric label="Technical depth" value={report.technical_depth_score == null ? '—' : String(report.technical_depth_score)} /><Metric label="Communication" value={String(report.communication_score)} /></div>{report.content_dimensions.length > 0 && <div className="mt-5"><p className="text-xs font-black">Content competency breakdown</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{report.content_dimensions.map((item) => <Metric key={item.key} label={item.label} value={String(item.score)} />)}</div></div>}{report.delivery_dimensions.length > 0 && <div className="mt-5"><p className="text-xs font-black">Delivery breakdown</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{report.delivery_dimensions.map((item) => <Metric key={item.key} label={item.label} value={String(item.score)} />)}</div></div>}{report.strongest_turn && <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black text-emerald-950">Strongest answer · {report.strongest_turn.score}</p><p className="mt-2 text-[11px] leading-5 text-emerald-900">{report.strongest_turn.question}</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-950">Priority answer · {report.weakest_turn?.score}</p><p className="mt-2 text-[11px] leading-5 text-amber-900">{report.weakest_turn?.question}</p></div></div>}<div className="mt-6 space-y-3">{history.map((item, index) => <div key={`${item.question}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase text-[var(--accent-strong)]">Question {index + 1}</p><p className="mt-1 text-xs font-black">{item.question}</p></div><div className="flex gap-3 text-[10px] font-black"><span>C {item.total}</span><span>D {item.delivery.score}</span><span>R {item.readiness}</span></div></div></div>)}</div><button type="button" onClick={resetInterview} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-black text-white"><RotateCcw className="h-4 w-4" /> Start another practice</button></section>
        )}
      </div>
    </main>
  );
}

function ScoreCard({ label, score, accent = false }: { label: string; score: number; accent?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${accent ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><p className={`text-[9px] font-black uppercase ${accent ? 'text-[var(--accent-strong)]' : 'text-[var(--ink-soft)]'}`}>{label}</p><p className="mt-1 text-3xl font-black">{score}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--surface-border)] p-3"><p className="text-[9px] font-black uppercase text-[var(--ink-soft)]">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}

function FeedbackBox({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' }) {
  const className = tone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950';
  return <div className={`rounded-2xl border p-4 ${className}`}><p className="text-xs font-black">{title}</p><ul className="mt-2 space-y-2 text-[11px] leading-5">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>;
}
