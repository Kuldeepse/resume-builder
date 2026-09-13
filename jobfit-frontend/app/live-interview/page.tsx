'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Clock3,
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

type InterviewState = 'setup' | 'active' | 'complete';
type CoachState = 'ready' | 'speaking' | 'listening' | 'thinking';
type InterviewType = 'hr' | 'behavioural' | 'technical';
type CoachMode = 'ai' | 'fallback';
type EvidenceStatus = 'confirmed' | 'partial' | 'unsupported' | 'unknown';

type CoachDimension = {
  key: string;
  label: string;
  score: number;
  rationale: string;
};

type EvidenceFinding = {
  status: EvidenceStatus;
  claim: string;
  evidence: string;
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
};

type CoachResponse = {
  mode: CoachMode;
  degraded_reason?: string;
  agent?: {
    provider?: string;
    model?: string;
    version?: string;
    adaptive?: boolean;
    evidence_guard?: boolean;
  };
  assessment: Omit<Assessment, 'mode'>;
};

type StoredContext = {
  role?: string;
  company?: string;
  jobDescription?: string;
  interviewType?: InterviewType;
  candidateEvidence?: string[];
};

type SpeechRecognitionResultLike = { 0: { transcript: string } };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
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
    description: 'Adaptive STAR coaching, ownership, judgement, stakeholder leadership and measurable outcomes.',
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
    description: 'Architecture, technical depth, trade-offs, controls, delivery risk and operational readiness.',
    opening: 'Walk me through the architecture of a complex platform or transformation you delivered.',
    suggestions: [
      'Describe a serious technical risk you identified and how you validated the mitigation.',
      'How did you manage security, resilience, performance and observability requirements?',
      'Explain a technical trade-off you made between speed, cost, quality and risk.',
      'How did you move a complex solution from design through deployment and operational handover?',
    ],
  },
};

const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';
const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function safeInterviewType(value: unknown): InterviewType {
  return value === 'hr' || value === 'technical' || value === 'behavioural' ? value : 'behavioural';
}

function deriveCompany(jobDescription: string) {
  const firstLine = String(jobDescription || '').split(/\n+/)[0] || '';
  const marker = ' at ';
  return firstLine.includes(marker) ? firstLine.split(marker).slice(1).join(marker).trim().slice(0, 240) : '';
}

function evidenceTone(status: EvidenceStatus) {
  if (status === 'confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-950';
  if (status === 'unsupported') return 'border-rose-200 bg-rose-50 text-rose-950';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

function readStoredContext(): StoredContext {
  try {
    const raw = window.sessionStorage.getItem('cognitwist-live-interview-context');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredContext;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function LiveInterviewPage() {
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioural');
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseAnswerRef = useRef('');

  const config = INTERVIEW_TYPES[interviewType];
  const latest = history[history.length - 1];
  const averageScore = history.length ? Math.round(history.reduce((sum, item) => sum + item.total, 0) / history.length) : 0;

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
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
  }, []);

  useEffect(() => {
    if (sessionState !== 'active') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionState]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) {
      setCoachState('ready');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.94;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang === 'en-GB') || voices.find((voice) => voice.lang.startsWith('en')) || null;
    utterance.onstart = () => setCoachState('speaking');
    utterance.onend = () => setCoachState('ready');
    utterance.onerror = () => setCoachState('ready');
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setCoachState('ready');
  }, []);

  const startListening = () => {
    if (!speechSupported) {
      setNotice('Speech recognition is unavailable in this browser. Type your practice answer instead.');
      return;
    }
    window.speechSynthesis?.cancel();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';
    recognitionRef.current = recognition;
    baseAnswerRef.current = answer.trim();
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) transcript += `${event.results[index][0].transcript} `;
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
      setNotice('Listening. Press Stop when you finish your practice answer.');
    } catch {
      setNotice('The microphone is already active or unavailable.');
    }
  };

  const setQuestion = (question: string) => {
    const clean = question.trim();
    if (!clean) return;
    stopListening();
    setCurrentQuestion(clean);
    setQuestionDraft('');
    setAnswer('');
    setError('');
    setNotice('Question ready. Answer naturally; the coach will adapt after your response.');
    window.setTimeout(() => speak(clean), 80);
  };

  const startInterview = () => {
    if (!role.trim()) {
      setError('Enter the exact target role before starting practice.');
      return;
    }
    const opening = INTERVIEW_TYPES[interviewType].opening;
    setHistory([]);
    setElapsed(0);
    setCurrentQuestion(opening);
    setAnswer('');
    setError('');
    setNotice('Mock interview started. Coaching is based only on the evidence you provide.');
    setSessionState('active');
    window.setTimeout(() => speak(`Welcome to your ${INTERVIEW_TYPES[interviewType].label.toLowerCase()} practice for the ${role.trim()} role. ${opening}`), 160);
  };

  const submitAnswer = async () => {
    if (!answer.trim() || analysing) {
      if (!answer.trim()) setError('Speak or type an answer before requesting coaching.');
      return;
    }
    stopListening();
    window.speechSynthesis?.cancel();
    setAnalysing(true);
    setCoachState('thinking');
    setError('');
    setNotice('The coach is assessing intent, evidence, role relevance and the best adaptive follow-up.');

    try {
      const response = await fetch('/api/interview-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role.trim(),
          company: company.trim(),
          job_description: jobDescription.trim(),
          interview_type: interviewType,
          question: currentQuestion,
          answer: answer.trim(),
          candidate_evidence: candidateEvidence,
          history: history.map((item) => ({ question: item.question, answer: item.answer, score: item.total })).slice(-8),
        }),
      });
      const data = await response.json().catch(() => null) as CoachResponse | { detail?: string } | null;
      if (!response.ok || !data || !('assessment' in data)) {
        throw new Error(data && 'detail' in data && data.detail ? data.detail : 'Interview coaching could not complete this turn.');
      }
      const item: Assessment = { ...data.assessment, mode: data.mode };
      setHistory((items) => [...items, item]);
      setNotice(data.mode === 'ai'
        ? `Adaptive AI coaching complete · ${item.total}/100 · ${item.rating}/5.`
        : `AI provider unavailable; evidence-safe fallback coaching returned ${item.total}/100.`);
      speak(`${item.coaching_message} ${item.follow_up}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Interview coaching could not complete this turn.');
      setNotice('');
    } finally {
      setAnalysing(false);
      setCoachState('ready');
    }
  };

  const resetInterview = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setSessionState('setup');
    setCoachState('ready');
    setHistory([]);
    setElapsed(0);
    setAnswer('');
    setNotice('');
    setError('');
  };

  const copyRevision = async () => {
    if (!latest?.revised_answer) return;
    await navigator.clipboard?.writeText(latest.revised_answer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const scoreSummary = useMemo(() => {
    if (!history.length) return 'Complete an answer to receive adaptive coaching.';
    if (averageScore >= 85) return 'Interview-ready foundation: maintain evidence quality and test remaining competencies.';
    if (averageScore >= 70) return 'Good foundation: use adaptive follow-ups to strengthen the weakest evidence.';
    return 'Developing: focus on personal ownership, evidence and the interviewer’s actual intent.';
  }, [history.length, averageScore]);

  const statusLabel = coachState === 'speaking' ? 'Speaking' : coachState === 'listening' ? 'Listening' : coachState === 'thinking' ? 'Analysing' : 'Ready';

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2.2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-9">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><BrainCircuit className="h-3.5 w-3.5" /> Adaptive Interview Coach</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Practise. Get challenged. Improve with evidence.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">The coach evaluates each mock-interview answer against the exact question and role context, then chooses a targeted follow-up and the next competency to test. It will not invent experience or metrics for you.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-xs font-black"><Clock3 className="h-4 w-4 text-[var(--accent-strong)]" /> {formatTime(elapsed)}</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-4">
            <section className={`${panelClass} overflow-hidden`}>
              <div className="relative flex min-h-[360px] flex-col items-center justify-center bg-[radial-gradient(circle_at_top,var(--accent-soft),transparent_58%),linear-gradient(145deg,#132238,#07111f)] p-7 text-white">
                <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider">{statusLabel}</div>
                <div className={`flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl ${coachState === 'thinking' || coachState === 'speaking' ? 'animate-pulse' : ''}`}><BrainCircuit className="h-20 w-20" /></div>
                <p className="mt-5 text-lg font-black">CogniTwist Interview Coach</p>
                <p className="mt-2 max-w-sm text-center text-xs leading-6 text-white/70">Mock interview practice · adaptive reasoning · evidence guard enabled</p>
                <div className="mt-5 flex gap-2"><span className="rounded-full border border-white/20 px-3 py-1.5 text-[9px] font-black">{config.label}</span><span className="rounded-full border border-white/20 px-3 py-1.5 text-[9px] font-black">{history.length} coached turns</span></div>
              </div>
            </section>

            <section className={`${panelClass} p-5`}>
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-strong)]" /><div><h2 className="text-sm font-black">Evidence guard</h2><p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">Revised answers may restructure your evidence, but missing facts remain visible placeholders. Unknown is kept separate from unsupported.</p></div></div>
            </section>
          </div>

          <div className="space-y-5">
            {sessionState === 'setup' ? (
              <section className={`${panelClass} p-5 md:p-7`}>
                <div className="flex items-center gap-3"><Target className="h-5 w-5 text-[var(--accent-strong)]" /><div><h2 className="text-xl font-black">Set the mock interview context</h2><p className="text-xs text-[var(--ink-soft)]">Job Scout and Job Intelligence context is loaded automatically when available.</p></div></div>
                <div className="mt-6 space-y-5">
                  <fieldset><legend className="text-xs font-black">Interview stage</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{(Object.keys(INTERVIEW_TYPES) as InterviewType[]).map((type) => <button key={type} type="button" onClick={() => { setInterviewType(type); setCurrentQuestion(INTERVIEW_TYPES[type].opening); }} className={`rounded-2xl border p-4 text-left ${interviewType === type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-xs">{INTERVIEW_TYPES[type].label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--ink-soft)]">{INTERVIEW_TYPES[type].description}</span></button>)}</div></fieldset>
                  <div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-black">Target role<input value={role} onChange={(event) => setRole(event.target.value)} className={`${inputClass} mt-2`} placeholder="Exact job title" /></label><label className="text-xs font-black">Company <span className="font-normal text-[var(--ink-soft)]">(optional)</span><input value={company} onChange={(event) => setCompany(event.target.value)} className={`${inputClass} mt-2`} placeholder="Employer" /></label></div>
                  <label className="text-xs font-black">Job description / role context <span className="font-normal text-[var(--ink-soft)]">(recommended)</span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={6} className={`${inputClass} mt-2 resize-y text-xs leading-6`} placeholder="Loaded automatically from the selected vacancy, or paste the key requirements." /></label>
                  {error && <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>}
                  <button type="button" onClick={startInterview} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)]"><Play className="h-4 w-4" /> Start adaptive mock interview</button>
                </div>
              </section>
            ) : (
              <>
                <section className={`${panelClass} p-5 md:p-7`}>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Current question</p><h2 className="mt-3 text-xl font-black leading-8 md:text-2xl">{currentQuestion}</h2></div><button type="button" onClick={() => speak(currentQuestion)} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2 text-[11px] font-black">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Repeat</button></div>
                  <div className="mt-5 flex gap-2"><input value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder="Practise another interview question…" className={`${inputClass} min-w-0 flex-1`} /><button type="button" onClick={() => setQuestion(questionDraft)} disabled={!questionDraft.trim()} className="rounded-xl bg-[var(--accent)] px-4 text-xs font-black text-white disabled:opacity-40"><Send className="h-4 w-4" /></button></div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{config.suggestions.map((question) => <button key={question} type="button" onClick={() => setQuestion(question)} className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-2 text-[10px] font-bold text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]">{question.slice(0, 55)}{question.length > 55 ? '…' : ''}</button>)}</div>
                </section>

                <section className={`${panelClass} p-5 md:p-7`}>
                  <div className="flex items-center justify-between gap-3"><label htmlFor="interview-answer" className="text-xs font-black">Your practice answer</label><button type="button" onClick={() => setVoiceEnabled((value) => !value)} className="rounded-lg border border-[var(--surface-border)] p-2" aria-label="Toggle coach voice">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div>
                  <textarea id="interview-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={8} className={`${inputClass} mt-2 resize-y leading-7`} placeholder="Speak or type your answer. The coach evaluates only what you actually provide." />
                  <div className="mt-3 flex flex-wrap gap-2">{isListening ? <button type="button" onClick={stopListening} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 text-xs font-black text-rose-900"><Square className="h-4 w-4" /> Stop listening</button> : <button type="button" onClick={startListening} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black"><Mic className="h-4 w-4" /> Speak answer</button>}<button type="button" onClick={submitAnswer} disabled={analysing || !answer.trim()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-xs font-black text-white disabled:opacity-45">{analysing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{analysing ? 'Adaptive coach is analysing…' : 'Coach this answer'}</button></div>
                  {!speechSupported && <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--ink-soft)]"><MicOff className="h-3.5 w-3.5" /> Browser speech recognition is unavailable; typed practice remains available.</div>}
                  {notice && <div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6">{notice}</div>}
                  {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>}
                </section>

                {latest && (
                  <section className={`${panelClass} p-5 md:p-7`}>
                    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${latest.mode === 'ai' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{latest.mode === 'ai' ? 'Adaptive AI' : 'Safe fallback'}</span><span className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">{latest.label}</span></div><p className="mt-2 text-4xl font-black">{latest.total}<span className="text-base text-[var(--ink-soft)]">/100</span></p></div><div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-center"><p className="text-[9px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Rating</p><p className="mt-1 text-xl font-black">{latest.rating}/5</p></div></div>

                    <div className="mt-5 grid gap-3 md:grid-cols-5">{latest.dimensions.map((dimension) => <div key={dimension.key} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black">{dimension.label}</p><span className="text-xs font-black">{dimension.score}/20</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-border)]"><div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--highlight))]" style={{ width: `${Math.max(0, Math.min(100, dimension.score * 5))}%` }} /></div><p className="mt-3 text-[10px] leading-5 text-[var(--ink-soft)]">{dimension.rationale}</p></div>)}</div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><p className="text-xs font-black">What worked</p><ul className="mt-2 space-y-2 text-[11px] leading-5">{latest.strengths.map((item) => <li key={item}>• {item}</li>)}</ul></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="text-xs font-black">What to strengthen</p><ul className="mt-2 space-y-2 text-[11px] leading-5">{latest.improvements.map((item) => <li key={item}>• {item}</li>)}</ul></div></div>

                    {latest.evidence_findings.length ? <div className="mt-5"><p className="text-xs font-black">Evidence check</p><div className="mt-2 grid gap-2">{latest.evidence_findings.map((finding, index) => <div key={`${finding.claim}-${index}`} className={`rounded-2xl border p-3 ${evidenceTone(finding.status)}`}><div className="flex items-start justify-between gap-3"><p className="text-[11px] font-black">{finding.claim}</p><span className="rounded-full border border-current/20 px-2 py-0.5 text-[8px] font-black uppercase">{finding.status}</span></div>{finding.evidence ? <p className="mt-2 text-[10px] leading-5 opacity-80">Evidence: {finding.evidence}</p> : null}</div>)}</div></div> : null}

                    {latest.credibility_flags.length ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-black">Credibility checks</p><ul className="mt-2 space-y-1 text-[11px]">{latest.credibility_flags.map((flag) => <li key={flag}>• {flag}</li>)}</ul></div></div></div> : null}

                    <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black">Evidence-safe stronger structure</p><button type="button" onClick={copyRevision} className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-[9px] font-black"><Clipboard className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}</button></div><pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-6 text-[var(--ink-soft)]">{latest.revised_answer}</pre></div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setQuestion(latest.follow_up)} className="min-h-14 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-white"><span className="block text-[9px] uppercase tracking-wide opacity-75">Adaptive follow-up</span><span className="mt-1 block line-clamp-2">{latest.follow_up}</span></button><button type="button" onClick={() => setQuestion(latest.next_question)} className="min-h-14 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-sm font-black"><span className="block text-[9px] uppercase tracking-wide text-[var(--ink-soft)]">Next competency</span><span className="mt-1 block line-clamp-2">{latest.next_question}</span></button></div>
                  </section>
                )}

                <section className={`${panelClass} p-5`}><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black">Session score · {history.length} coached answer{history.length === 1 ? '' : 's'}</p><p className="mt-1 text-xs text-[var(--ink-soft)]">{scoreSummary}</p></div><div className="flex gap-2"><button type="button" onClick={() => setSessionState('complete')} disabled={!history.length} className="rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-black disabled:opacity-40">Finish session</button><button type="button" onClick={resetInterview} className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-black"><RotateCcw className="h-4 w-4" /> Reset</button></div></div></section>
              </>
            )}

            {sessionState === 'complete' && (
              <section className={`${panelClass} p-6 md:p-8`}><CheckCircle2 className="h-8 w-8 text-emerald-600" /><h2 className="mt-4 text-2xl font-black">Mock interview complete</h2><p className="mt-2 text-sm text-[var(--ink-soft)]">Average score: <strong>{averageScore}/100</strong> across {history.length} coached answers.</p><div className="mt-5 space-y-3">{history.map((item, index) => <div key={`${item.question}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wide text-[var(--accent-strong)]">Question {index + 1} · {item.mode === 'ai' ? 'AI' : 'fallback'}</p><p className="mt-1 text-xs font-black">{item.question}</p></div><span className="text-sm font-black">{item.total}/100</span></div></div>)}</div><button type="button" onClick={resetInterview} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-black text-white"><RotateCcw className="h-4 w-4" /> Start another practice</button></section>
            )}
          </div>
        </section>

        <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 text-[11px] leading-5 text-[var(--ink-soft)]"><ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" /> This feature is for mock interview preparation. It is designed to strengthen truthful evidence before an interview, not to provide covert answers during a live employer assessment.</div>
      </div>
    </main>
  );
}
