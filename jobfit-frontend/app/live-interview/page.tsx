'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BrainCircuit,
  Check,
  Clipboard,
  Clock3,
  MessageSquareText,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import styles from './live-interview.module.css';

type InterviewState = 'setup' | 'active' | 'complete';
type AvatarState = 'ready' | 'speaking' | 'listening' | 'thinking';

type ScoreBreakdown = {
  relevance: number;
  structure: number;
  ownership: number;
  evidence: number;
  clarity: number;
};

type Assessment = {
  question: string;
  answer: string;
  total: number;
  rating: number;
  label: string;
  breakdown: ScoreBreakdown;
  strengths: string[];
  improvements: string[];
  followUp: string;
  revisedAnswer: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

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

const QUESTION_BANK = [
  'Please introduce yourself and explain why this opportunity is a strong fit for you.',
  'Tell me about a complex programme or product you led. What made it difficult, and what did you personally do?',
  'Describe a time when a major dependency or risk threatened delivery. How did you protect the outcome?',
  'Tell me about a stakeholder disagreement you resolved. How did you reach a decision and maintain trust?',
  'Give an example of how you used data, AI or automation to improve delivery performance or business outcomes.',
  'Describe a difficult decision you made with incomplete information. How did you manage the risk?',
  'Tell me about a delivery failure or setback. What did you learn and change afterwards?',
  'How do you prioritise competing initiatives when senior stakeholders all consider their request urgent?',
  'How do you manage dependencies and blockers across engineering, security, operations and external suppliers?',
  'What would your first 30, 60 and 90 days look like in this role?',
];

const ROLE_PRESETS = [
  'Technical Programme Manager',
  'Senior Project Manager',
  'AI Programme Coordination Lead',
  'Technical Delivery Manager',
  'Senior Product Manager',
  'IAM Programme Lead',
];

const ACTION_PATTERN = /\b(i led|i owned|i created|i established|i introduced|i decided|i negotiated|i coordinated|i analysed|i implemented|i proposed|i challenged|i escalated|i prioritised|i facilitated|i delivered|i designed|i reduced|i improved)\b/i;
const RESULT_PATTERN = /\b(result|outcome|achieved|delivered|reduced|increased|improved|saved|adoption|availability|incident|on time|under budget|benefit|revenue|cost|risk)\b/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|percent|users?|weeks?|months?|days?|hours?|minutes?|million|billion|m|k|applications?|countries?|regions?|vendors?)?\b/i;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function clamp(value: number, min = 0, max = 20) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function meaningfulKeywords(text: string) {
  const stop = new Set([
    'about', 'after', 'again', 'against', 'because', 'being', 'could', 'explain', 'from', 'have', 'into', 'opportunity',
    'please', 'role', 'should', 'that', 'their', 'there', 'these', 'they', 'this', 'through', 'what', 'when', 'where', 'which',
    'while', 'with', 'would', 'your', 'you', 'tell', 'describe', 'example', 'time', 'how', 'were', 'been', 'also', 'more', 'than',
  ]);
  return Array.from(new Set((text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).filter((word) => !stop.has(word))));
}

function roleFitPhrase(role: string) {
  const lower = role.toLowerCase();
  if (lower.includes('product')) return 'user outcomes, prioritisation, lifecycle ownership and measurable product value';
  if (lower.includes('ai')) return 'AI governance, cross-functional coordination, controls, adoption and measurable business outcomes';
  if (lower.includes('iam')) return 'identity risk, security controls, stakeholder alignment and safe enterprise adoption';
  if (lower.includes('delivery')) return 'delivery control, dependencies, operational readiness and accountable execution';
  return 'complex delivery, stakeholder leadership, risk control and measurable outcomes';
}

function buildRevision(question: string, answer: string, role: string) {
  const parts = sentences(answer);
  const situation = parts.find((item) => /\b(context|challenge|problem|when|during|programme|project|organisation)\b/i.test(item)) || parts[0];
  const task = parts.find((item) => /\b(accountable|responsible|objective|goal|needed to|task|mandate)\b/i.test(item));
  const actions = parts.filter((item) => ACTION_PATTERN.test(item)).slice(0, 3);
  const result = parts.find((item) => RESULT_PATTERN.test(item) || METRIC_PATTERN.test(item));
  const questionLower = question.toLowerCase();
  const fit = roleFitPhrase(role);

  if (/introduce yourself|tell me about yourself/.test(questionLower)) {
    return `I am a ${role} professional with experience delivering complex technology and transformation outcomes. ${situation || '[Add a one-sentence summary of your most relevant experience.]'} My strongest contribution is ${actions.join(' ') || '[Add two examples of what you personally led or changed.]'} ${result || '[Add one quantified result that proves your impact.]'} I am particularly suited to this opportunity because my experience demonstrates ${fit}.`;
  }

  if (/why.*(role|company|join)|motivat|interested/.test(questionLower)) {
    return `I am interested in this ${role} opportunity because it closely matches my experience in ${fit}. ${situation || '[Explain the specific connection between your experience and the organisation’s need.]'} I would bring ${actions.join(' ') || '[State the two capabilities you would contribute immediately.]'} ${result || '[Add a quantified example showing the value you have delivered before.]'} This combination means I can contribute quickly while continuing to grow with the organisation.`;
  }

  if (/30.*60.*90|first .*days/.test(questionLower)) {
    return `In the first 30 days, I would listen, map stakeholders, confirm objectives, understand the operating model and establish a fact-based baseline. In days 31–60, I would validate priorities, dependencies, risks, governance and delivery capacity, then agree an executable roadmap with measurable outcomes. In days 61–90, I would stabilise delivery cadence, remove priority blockers, demonstrate early value and present a forward plan. I would apply my experience in ${fit}, while adapting the plan to the evidence I gather.`;
  }

  return `The situation was ${situation || '[briefly describe the business context and why it mattered]'}. I was accountable for ${task || '[state your specific objective, scope and decision rights]'}. I personally ${actions.length ? actions.join(' ') : '[describe the two or three most important actions you took, using strong “I” language]'}. This resulted in ${result || '[add the measurable result: scale, adoption, time, cost, quality or risk reduction]'}. The example is relevant to the ${role} role because it demonstrates ${fit}.`;
}

function assessAnswer(question: string, answer: string, role: string, jobDescription: string): Assessment {
  const clean = answer.trim();
  const lower = clean.toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);
  const answerSentences = sentences(clean);

  const hasSituation = /\b(situation|context|challenge|problem|when i|during|at the time)\b/.test(lower);
  const hasTask = /\b(task|objective|goal|responsible|accountable|needed to|mandate)\b/.test(lower);
  const hasAction = ACTION_PATTERN.test(clean);
  const hasResult = RESULT_PATTERN.test(clean);
  const hasMetric = METRIC_PATTERN.test(clean);
  const iCount = (lower.match(/\bi\b/g) || []).length;
  const weCount = (lower.match(/\bwe\b/g) || []).length;
  const fillerCount = (lower.match(/\b(um|uh|basically|actually|obviously|you know|sort of|kind of)\b/g) || []).length;

  const targetKeywords = meaningfulKeywords(`${question} ${role} ${jobDescription}`).slice(0, 35);
  const matchedKeywords = targetKeywords.filter((keyword) => lower.includes(keyword));
  const relevance = clamp(8 + Math.min(12, matchedKeywords.length * 2));

  let structure = 2;
  if (hasSituation) structure += 4;
  if (hasTask) structure += 4;
  if (hasAction) structure += 6;
  if (hasResult) structure += 4;
  structure = clamp(structure);

  let ownership = 4 + Math.min(8, iCount * 2);
  if (hasAction) ownership += 6;
  if (weCount > iCount) ownership -= 5;
  ownership = clamp(ownership);

  let evidence = 3;
  if (hasResult) evidence += 7;
  if (hasMetric) evidence += 8;
  if (/\b(user|customer|business|risk|cost|quality|revenue|adoption|availability)\b/.test(lower)) evidence += 2;
  evidence = clamp(evidence);

  let clarity = words.length >= 70 && words.length <= 230 ? 18 : words.length >= 45 && words.length <= 300 ? 14 : 9;
  if (answerSentences.length >= 3) clarity += 2;
  clarity -= Math.min(6, fillerCount * 2);
  clarity = clamp(clarity);

  const breakdown = { relevance, structure, ownership, evidence, clarity };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const rating = Math.max(1, Math.min(5, Math.ceil(total / 20)));
  const label = total >= 90 ? 'Outstanding' : total >= 80 ? 'Strong' : total >= 70 ? 'Good' : total >= 60 ? 'Developing' : 'Needs stronger evidence';

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (relevance >= 15) strengths.push('The answer is relevant to the question and target role.');
  else improvements.push('Connect the example more directly to the question and role requirements.');
  if (structure >= 15) strengths.push('The response has a recognisable STAR flow.');
  else improvements.push('Use a clearer Situation–Task–Action–Result sequence.');
  if (ownership >= 15) strengths.push('Personal ownership is clear.');
  else improvements.push('Explain exactly what you personally decided, changed or delivered.');
  if (evidence >= 15) strengths.push('The answer includes outcome evidence.');
  else improvements.push('Add scale and a measurable result such as adoption, time, cost, quality or risk reduction.');
  if (clarity < 14) improvements.push('Keep the answer focused: approximately 90–180 words for most behavioural questions.');

  let followUp = 'What was the most difficult trade-off you made, and what did you learn from it?';
  if (!hasSituation) followUp = 'What was the business context, and why did this situation matter?';
  else if (!hasTask) followUp = 'What were you personally accountable for, and what decision rights did you have?';
  else if (!hasAction || ownership < 15) followUp = 'What did you personally do that changed the outcome?';
  else if (!hasMetric || evidence < 15) followUp = 'What measurable result did your actions produce?';
  else if (relevance < 15) followUp = `How does this example demonstrate the capabilities required of a ${role}?`;

  return {
    question,
    answer: clean,
    total,
    rating,
    label,
    breakdown,
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
    followUp,
    revisedAnswer: buildRevision(question, clean, role),
  };
}

function HumanInterviewer({ state }: { state: AvatarState }) {
  const avatarClass = [
    styles.avatar,
    state === 'speaking' ? styles.avatarSpeaking : '',
    state === 'listening' ? styles.avatarListening : '',
    state === 'thinking' ? styles.avatarThinking : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.avatarWrap} aria-label={`Asha, virtual interviewer, is ${state}`}>
      <svg className={avatarClass} viewBox="0 0 360 430" role="img" aria-labelledby="avatarTitle avatarDesc">
        <title id="avatarTitle">Asha, CogniTwist virtual interviewer</title>
        <desc id="avatarDesc">A human-style animated AI interviewer.</desc>
        <defs>
          <linearGradient id="jacket" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#203451" /><stop offset="1" stopColor="#0b1323" /></linearGradient>
          <radialGradient id="skin" cx="46%" cy="32%" r="72%"><stop offset="0" stopColor="#e0aa82" /><stop offset="0.72" stopColor="#bb7d5a" /><stop offset="1" stopColor="#92553b" /></radialGradient>
        </defs>
        <circle className={styles.voiceGlow} cx="180" cy="170" r="122" fill="none" stroke="rgba(255,255,255,.36)" strokeWidth="7" />
        <circle className={styles.earGlow} cx="180" cy="178" r="108" fill="none" stroke="rgba(110,231,183,.62)" strokeWidth="5" />
        <circle className={styles.thoughtGlow} cx="180" cy="157" r="112" fill="none" stroke="rgba(196,181,253,.62)" strokeWidth="5" strokeDasharray="11 14" />
        <path d="M62 430c8-83 53-126 118-126s110 43 118 126H62Z" fill="url(#jacket)" />
        <path d="M142 309h76l-9 121h-58l-9-121Z" fill="#edf2f7" />
        <path d="M151 278h58v51c-13 13-45 13-58 0v-51Z" fill="url(#skin)" />
        <g className={styles.faceGroup}>
          <ellipse cx="180" cy="185" rx="86" ry="110" fill="url(#skin)" />
          <path d="M96 170c-6-68 22-116 80-122 64-7 99 36 91 118-12-16-20-39-25-67-29 23-76 34-130 24-2 20-7 36-16 47Z" fill="#171a23" />
          <path d="M117 139c13-14 29-20 48-18M195 121c19-2 35 4 48 18" fill="none" stroke="#4c2c22" strokeWidth="5" strokeLinecap="round" />
          <g className={styles.eye}><ellipse cx="143" cy="164" rx="18" ry="11" fill="#fffaf5" /><circle cx="146" cy="164" r="6" fill="#2b211e" /></g>
          <g className={styles.eye}><ellipse cx="217" cy="164" rx="18" ry="11" fill="#fffaf5" /><circle cx="214" cy="164" r="6" fill="#2b211e" /></g>
          <path d="M179 171c-2 19-7 36-11 48 7 6 17 7 26 1" fill="none" stroke="#8f543f" strokeWidth="4" strokeLinecap="round" />
          <path className={styles.mouth} d="M148 237c20 16 44 16 64 0-18 7-45 7-64 0Z" fill="#672f35" />
        </g>
      </svg>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-black">
        <span>{label}</span><span>{value}/20</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-border)]">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--highlight))]" style={{ width: `${value * 5}%` }} />
      </div>
    </div>
  );
}

export default function LiveInterviewPage() {
  const [role, setRole] = useState(ROLE_PRESETS[0]);
  const [jobDescription, setJobDescription] = useState('');
  const [openingQuestion, setOpeningQuestion] = useState(QUESTION_BANK[0]);
  const [currentQuestion, setCurrentQuestion] = useState(QUESTION_BANK[0]);
  const [questionDraft, setQuestionDraft] = useState('');
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState<Assessment[]>([]);
  const [sessionState, setSessionState] = useState<InterviewState>('setup');
  const [avatarState, setAvatarState] = useState<AvatarState>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseAnswerRef = useRef('');

  const latest = history.at(-1);
  const averageScore = history.length ? Math.round(history.reduce((sum, item) => sum + item.total, 0) / history.length) : 0;

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
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
      setAvatarState('ready');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.94;
    utterance.pitch = 1.02;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang === 'en-GB' && /female|samantha|serena|sonia|libby/i.test(voice.name))
      || voices.find((voice) => voice.lang === 'en-GB')
      || voices.find((voice) => voice.lang.startsWith('en'))
      || null;
    utterance.onstart = () => setAvatarState('speaking');
    utterance.onend = () => setAvatarState('ready');
    utterance.onerror = () => setAvatarState('ready');
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setAvatarState('ready');
  }, []);

  const startListening = () => {
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
      setAvatarState('ready');
    };
    recognition.onend = () => {
      setIsListening(false);
      setAvatarState('ready');
    };
    try {
      recognition.start();
      setIsListening(true);
      setAvatarState('listening');
      setNotice('Listening in real time. Press Stop when you finish.');
    } catch {
      setNotice('The microphone is already active or unavailable.');
    }
  };

  const askQuestion = (question: string) => {
    const clean = question.trim();
    if (!clean) return;
    stopListening();
    setCurrentQuestion(clean);
    setAnswer('');
    setQuestionDraft('');
    setNotice('New question ready. Answer naturally, then request coaching.');
    window.setTimeout(() => speak(clean), 120);
  };

  const startInterview = () => {
    setHistory([]);
    setElapsed(0);
    setSessionState('active');
    setCurrentQuestion(openingQuestion.trim() || QUESTION_BANK[0]);
    setAnswer('');
    setNotice('Interview started. You can replace the question at any time.');
    window.setTimeout(() => speak(`Welcome. I am Asha, your CogniTwist interviewer. We are practising for the ${role} role. ${openingQuestion.trim() || QUESTION_BANK[0]}`), 250);
  };

  const submitAnswer = () => {
    if (!answer.trim()) {
      setNotice('Speak or type an answer before requesting a score.');
      return;
    }
    stopListening();
    window.speechSynthesis?.cancel();
    setAvatarState('thinking');
    setNotice('Analysing relevance, STAR structure, ownership, evidence and clarity.');
    window.setTimeout(() => {
      const assessment = assessAnswer(currentQuestion, answer, role, jobDescription);
      setHistory((items) => [...items, assessment]);
      setAvatarState('ready');
      setNotice(`Answer rated ${assessment.rating}/5 and scored ${assessment.total}/100.`);
      speak(`Your answer scored ${assessment.total} out of 100 and received ${assessment.rating} out of 5 stars. ${assessment.improvements[0] || 'This is a strong response.'}`);
    }, 650);
  };

  const resetInterview = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setSessionState('setup');
    setAvatarState('ready');
    setHistory([]);
    setElapsed(0);
    setAnswer('');
    setNotice('');
    setCopied(false);
  };

  const copyRevision = async () => {
    if (!latest?.revisedAnswer) return;
    await navigator.clipboard?.writeText(latest.revisedAnswer);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const statusLabel = avatarState === 'speaking' ? 'Speaking' : avatarState === 'listening' ? 'Listening' : avatarState === 'thinking' ? 'Analysing' : 'Ready';
  const scoreSummary = useMemo(() => {
    if (!history.length) return 'Complete an answer to receive a score and revised response.';
    if (averageScore >= 85) return 'Interview-ready: strong evidence, ownership and role fit.';
    if (averageScore >= 70) return 'Good foundation: strengthen the lowest-scoring dimension.';
    return 'Developing: use the revised response and answer the targeted follow-up.';
  }, [history.length, averageScore]);

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] backdrop-blur-xl md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-strong)]"><Sparkles className="h-3.5 w-3.5" /> Real-time interview coach</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Answer any question. Improve it immediately.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Asha listens in real time, scores five interview dimensions, asks a targeted follow-up and creates a stronger role-aligned response without inventing your evidence.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-xs font-black"><Clock3 className="h-4 w-4 text-[var(--accent-strong)]" />{formatTime(elapsed)}</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.3fr]">
          <div className={styles.stage}>
            <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-[11px] font-black text-white backdrop-blur-lg"><span className={`${styles.statusDot} h-2.5 w-2.5 rounded-full bg-current`} />{statusLabel}</div>
            <div className="absolute right-5 top-5 z-10 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-lg">Asha · AI interviewer</div>
            <HumanInterviewer state={avatarState} />
            <div className="absolute inset-x-5 bottom-5 z-10 rounded-[1.4rem] border border-white/20 bg-black/20 px-4 py-3 text-white backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Asha</p><p className="text-[11px] text-white/75">Human-like virtual interviewer · clearly identified as AI</p></div><div className="flex h-8 items-end gap-1" aria-hidden="true">{[13, 22, 17, 26, 14].map((height, index) => <span key={`${height}-${index}`} className={`${styles.waveBar} w-1 rounded-full bg-white/80 ${avatarState === 'ready' ? 'opacity-35' : ''}`} style={{ height }} />)}</div></div>
            </div>
          </div>

          <div className="space-y-5">
            {sessionState === 'setup' ? (
              <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><BrainCircuit className="h-6 w-6" /></div><div><h2 className="text-xl font-black">Set the interview context</h2><p className="text-xs text-[var(--ink-soft)]">The context improves role-fit scoring and the revised response.</p></div></div>
                <div className="mt-6 grid gap-5">
                  <label className="text-xs font-black">Target role<select value={role} onChange={(event) => setRole(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]">{ROLE_PRESETS.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="text-xs font-black">Job description or key requirements <span className="font-normal text-[var(--ink-soft)]">(optional)</span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={4} placeholder="Paste the role requirements for more precise relevance scoring…" className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-sm font-normal text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]" /></label>
                  <label className="text-xs font-black">Opening question<textarea value={openingQuestion} onChange={(event) => setOpeningQuestion(event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-sm font-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]" /></label>
                  <div className="flex flex-wrap gap-2">{QUESTION_BANK.slice(0, 5).map((question, index) => <button key={question} type="button" onClick={() => setOpeningQuestion(question)} className="rounded-full border border-[var(--surface-border)] px-3 py-2 text-[11px] font-bold text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]">Question {index + 1}</button>)}</div>
                  <button type="button" onClick={startInterview} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)]"><Play className="h-4 w-4" />Start real-time interview</button>
                </div>
              </section>
            ) : (
              <>
                <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Current interviewer question</p><button type="button" onClick={() => speak(currentQuestion)} className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-2 text-[11px] font-black hover:bg-[var(--accent-soft)]">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}Repeat question</button></div>
                  <h2 className="mt-3 text-xl font-black leading-8 md:text-2xl">{currentQuestion}</h2>
                  <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-3"><div className="flex gap-2"><input value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder="Enter any other interview question…" className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[var(--ink-soft)]" /><button type="button" onClick={() => askQuestion(questionDraft)} disabled={!questionDraft.trim()} className="rounded-xl bg-[var(--accent)] px-4 text-xs font-black text-white disabled:opacity-40">Ask</button></div></div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{QUESTION_BANK.slice(5).map((question, index) => <button key={question} type="button" onClick={() => askQuestion(question)} className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-2 text-[10px] font-bold text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]">Suggested {index + 1}</button>)}</div>
                </section>

                <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                  <div className="flex items-center justify-between gap-3"><label htmlFor="interview-answer" className="text-xs font-black">Your answer</label><button type="button" onClick={() => setVoiceEnabled((value) => !value)} className="rounded-full border border-[var(--surface-border)] p-2 text-[var(--ink-soft)]" aria-label="Toggle interviewer voice">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div>
                  <textarea id="interview-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={8} placeholder="Speak naturally or type your answer here…" className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-sm leading-7 text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={isListening ? stopListening : startListening} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-black ${isListening ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}>{isListening ? <Square className="h-4 w-4" /> : speechSupported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{isListening ? 'Stop listening' : 'Start listening'}</button>
                    <button type="button" onClick={submitAnswer} disabled={!answer.trim() || avatarState === 'thinking'} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-xs font-black text-white disabled:opacity-40"><Send className="h-4 w-4" />Score and improve answer</button>
                  </div>
                  {notice && <p className="mt-4 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-xs leading-5 text-[var(--foreground)]">{notice}</p>}
                </section>
              </>
            )}
          </div>
        </section>

        {latest && sessionState !== 'setup' && (
          <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
              <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Answer rating</p><div className="mt-2 flex items-end gap-2"><strong className="text-5xl font-black">{latest.total}</strong><span className="pb-1 text-sm text-[var(--ink-soft)]">/100</span></div><p className="mt-2 text-sm font-black">{latest.label}</p></div><div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-center"><div className="flex gap-0.5 text-[var(--highlight)]">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= latest.rating ? 'fill-current' : ''}`} />)}</div><p className="mt-1 text-[10px] font-black">{latest.rating}/5</p></div></div>
              <div className="mt-6 space-y-4"><ScoreBar label="Role relevance" value={latest.breakdown.relevance} /><ScoreBar label="STAR structure" value={latest.breakdown.structure} /><ScoreBar label="Personal ownership" value={latest.breakdown.ownership} /><ScoreBar label="Evidence and metrics" value={latest.breakdown.evidence} /><ScoreBar label="Clarity and focus" value={latest.breakdown.clarity} /></div>
              <p className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-xs leading-6 text-[var(--ink-soft)]">{scoreSummary}</p>
            </article>

            <div className="space-y-6">
              <article className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[var(--accent-strong)]" /><h2 className="text-lg font-black">Coaching feedback</h2></div>
                <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-[var(--accent-soft)] p-4"><p className="text-xs font-black">What worked</p><ul className="mt-3 space-y-2 text-xs leading-5">{latest.strengths.length ? latest.strengths.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />{item}</li>) : <li>Add more evidence to create identifiable strengths.</li>}</ul></div><div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-xs font-black">What will improve the score</p><ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--ink-soft)]">{latest.improvements.map((item) => <li key={item}>• {item}</li>)}</ul></div></div>
                <div className="mt-4 rounded-2xl border border-[var(--surface-border)] p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Targeted follow-up</p><p className="mt-2 text-sm font-bold leading-6">{latest.followUp}</p><button type="button" onClick={() => askQuestion(latest.followUp)} className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-black text-white"><MessageSquareText className="h-4 w-4" />Answer this follow-up</button></div>
              </article>

              <article className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Interview-ready revision</p><h2 className="mt-1 text-lg font-black">Stronger answer for the {role} role</h2></div><div className="flex gap-2"><button type="button" onClick={() => speak(latest.revisedAnswer)} className="rounded-xl border border-[var(--surface-border)] p-3" aria-label="Read revised answer"><Volume2 className="h-4 w-4" /></button><button type="button" onClick={copyRevision} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</button></div></div>
                <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5 text-sm leading-7">{latest.revisedAnswer}</div>
                <p className="mt-3 text-[11px] leading-5 text-[var(--ink-soft)]">Replace bracketed prompts with verified facts. CogniTwist does not invent employers, responsibilities or metrics.</p>
              </article>
            </div>
          </section>
        )}

        {sessionState !== 'setup' && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)]"><div><p className="text-xs font-black">Session score: {averageScore || '—'}/100</p><p className="mt-1 text-[11px] text-[var(--ink-soft)]">{history.length} answer{history.length === 1 ? '' : 's'} assessed · responses remain in this browser session</p></div><div className="flex gap-2"><button type="button" onClick={() => setSessionState('complete')} className="rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black">Finish session</button><button type="button" onClick={resetInterview} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black"><RotateCcw className="h-4 w-4" />Start again</button></div></section>
        )}
      </div>
    </main>
  );
}
