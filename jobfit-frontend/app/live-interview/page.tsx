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
type InterviewType = 'hr' | 'behavioural' | 'technical';
type AvatarGender = 'female' | 'male';

type Assessment = {
  question: string;
  answer: string;
  total: number;
  rating: number;
  label: string;
  breakdown: Array<{ label: string; score: number }>;
  strengths: string[];
  improvements: string[];
  followUp: string;
  revisedAnswer: string;
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

const INTERVIEW_TYPES: Record<InterviewType, { label: string; description: string; questions: string[] }> = {
  hr: {
    label: 'Initial HR screening',
    description: 'Motivation, role fit, communication, expectations, availability and credibility.',
    questions: [
      'Please introduce yourself and explain why you are interested in this role.',
      'Why are you looking for a change at this point in your career?',
      'What do you understand about this role, and why are you a strong fit?',
      'Why do you want to join this organisation rather than another employer?',
      'What type of role and working environment helps you perform at your best?',
      'What are your salary expectations, notice period and location preferences?',
    ],
  },
  behavioural: {
    label: 'Behavioural interview',
    description: 'STAR structure, ownership, stakeholder leadership, measurable outcomes and learning.',
    questions: [
      'Tell me about a complex programme or product you led. What made it difficult, and what did you personally do?',
      'Describe a time when a major dependency or risk threatened delivery. How did you protect the outcome?',
      'Tell me about a stakeholder disagreement you resolved. How did you reach a decision and maintain trust?',
      'Describe a difficult decision you made with incomplete information. How did you manage the risk?',
      'Tell me about a delivery failure or setback. What did you learn and change afterwards?',
      'Give an example of how you used data, AI or automation to improve an outcome.',
    ],
  },
  technical: {
    label: 'Technical interview',
    description: 'Technical depth, architecture, trade-offs, controls, delivery risk and operational readiness.',
    questions: [
      'Walk me through the architecture of a complex platform or transformation you delivered.',
      'How would you design a secure, scalable implementation for this role’s core technology domain?',
      'Describe a serious technical risk you identified. How did you validate and mitigate it?',
      'How do you manage non-functional requirements such as security, resilience, performance and observability?',
      'Explain a technical trade-off you made between speed, cost, quality and risk.',
      'How do you move a complex solution from design through testing, deployment and service transition?',
    ],
  },
};

const ACTION_PATTERN = /\b(i led|i owned|i created|i established|i introduced|i decided|i negotiated|i coordinated|i analysed|i implemented|i proposed|i challenged|i escalated|i prioritised|i facilitated|i delivered|i designed|i reduced|i improved|i configured|i validated|i tested|i automated)\b/i;
const RESULT_PATTERN = /\b(result|outcome|achieved|delivered|reduced|increased|improved|saved|adoption|availability|incident|on time|under budget|benefit|revenue|cost|risk|latency|uptime|defect|performance)\b/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|percent|users?|weeks?|months?|days?|hours?|minutes?|million|billion|m|k|applications?|countries?|regions?|vendors?|ms|seconds?)?\b/i;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function clamp(value: number, min = 0, max = 20) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function splitSentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
}

function keywords(text: string) {
  const stop = new Set(['about', 'after', 'again', 'because', 'being', 'could', 'explain', 'from', 'have', 'into', 'please', 'role', 'should', 'that', 'their', 'there', 'these', 'they', 'this', 'through', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your', 'you', 'tell', 'describe', 'example', 'time', 'how', 'were', 'been', 'also', 'more', 'than']);
  return Array.from(new Set((text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).filter((word) => !stop.has(word))));
}

function roleFitPhrase(role: string, type: InterviewType) {
  if (type === 'hr') return `clear motivation, relevant experience, realistic expectations and credible fit for the ${role} position`;
  if (type === 'technical') return `technical judgement, architecture, controls, delivery trade-offs and operational readiness expected of a ${role}`;
  return `leadership, personal ownership, stakeholder management and measurable outcomes expected of a ${role}`;
}

function buildRevision(type: InterviewType, question: string, answer: string, role: string) {
  const parts = splitSentences(answer);
  const situation = parts.find((item) => /\b(context|challenge|problem|when|during|programme|project|organisation|platform|system)\b/i.test(item)) || parts[0];
  const task = parts.find((item) => /\b(accountable|responsible|objective|goal|needed to|task|mandate)\b/i.test(item));
  const actions = parts.filter((item) => ACTION_PATTERN.test(item)).slice(0, 3);
  const result = parts.find((item) => RESULT_PATTERN.test(item) || METRIC_PATTERN.test(item));
  const lowerQuestion = question.toLowerCase();

  if (type === 'hr') {
    if (/salary|notice|location|availability/.test(lowerQuestion)) {
      return `I am available ${answer || '[state your verified availability or notice period]'}. For compensation, I am looking for a package aligned with the scope and market level of the ${role} position, while remaining open to discussing the overall opportunity. My location and working-pattern preferences are [state your verified requirements], and I can be flexible where the role requires it.`;
    }
    return `I am a ${role} professional with experience in ${situation || '[summarise the most relevant part of your background]'}. I am interested in this opportunity because it aligns strongly with ${roleFitPhrase(role, type)}. My strongest evidence is that I personally ${actions.join(' ') || '[add two relevant contributions using “I” statements]'}. ${result || '[add one verified measurable result]'} I am now looking for a role where I can apply that experience, contribute quickly and continue developing with the organisation.`;
  }

  if (type === 'technical') {
    return `The technical context was ${situation || '[describe the platform, users, scale and constraints]'}. I was accountable for ${task || '[state your technical delivery responsibility and decision scope]'}. I assessed the architecture, dependencies and non-functional requirements, then I personally ${actions.length ? actions.join(' ') : '[describe the design, validation, control and delivery actions you took]'}. The key trade-off was [state the trade-off between speed, cost, quality and risk], which I managed through [state the evidence, control or decision mechanism]. This resulted in ${result || '[add a verified metric covering performance, resilience, security, adoption or delivery]'}, demonstrating the technical judgement required of a ${role}.`;
  }

  if (/30.*60.*90|first .*days/.test(lowerQuestion)) {
    return `In the first 30 days, I would listen, map stakeholders, confirm objectives and establish a fact-based baseline. In days 31–60, I would validate priorities, dependencies, risks, governance and delivery capacity, then agree an executable roadmap with measurable outcomes. In days 61–90, I would stabilise delivery cadence, remove priority blockers, demonstrate early value and present the forward plan for the ${role} function.`;
  }

  return `The situation was ${situation || '[briefly describe the business context and why it mattered]'}. I was accountable for ${task || '[state your specific objective, scope and decision rights]'}. I personally ${actions.length ? actions.join(' ') : '[describe the two or three most important actions you took using strong “I” language]'}. This resulted in ${result || '[add a verified metric covering scale, adoption, time, cost, quality or risk reduction]'}. The example demonstrates the leadership and delivery capability required of a ${role}.`;
}

function assessAnswer(type: InterviewType, question: string, answer: string, role: string, jobDescription: string): Assessment {
  const clean = answer.trim();
  const lower = clean.toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);
  const matched = keywords(`${question} ${role} ${jobDescription}`).slice(0, 35).filter((word) => lower.includes(word));
  const hasAction = ACTION_PATTERN.test(clean);
  const hasResult = RESULT_PATTERN.test(clean);
  const hasMetric = METRIC_PATTERN.test(clean);
  const iCount = (lower.match(/\bi\b/g) || []).length;
  const weCount = (lower.match(/\bwe\b/g) || []).length;
  const fillerCount = (lower.match(/\b(um|uh|basically|actually|obviously|you know|sort of|kind of)\b/g) || []).length;
  const relevance = clamp(8 + Math.min(12, matched.length * 2));
  const clarity = clamp((words.length >= 55 && words.length <= 230 ? 17 : words.length >= 35 && words.length <= 300 ? 13 : 8) + (splitSentences(clean).length >= 3 ? 2 : 0) - Math.min(6, fillerCount * 2));
  let breakdown: Array<{ label: string; score: number }>;

  if (type === 'hr') {
    const motivation = clamp(5 + (/\b(interested|motivated|join|opportunity|purpose|values|growth|contribute)\b/.test(lower) ? 8 : 0) + (matched.length >= 2 ? 5 : 0));
    const credibility = clamp(4 + (hasAction ? 6 : 0) + (hasResult ? 5 : 0) + (hasMetric ? 5 : 0));
    const readiness = clamp(6 + (/\b(available|notice|salary|location|hybrid|travel|flexible|immediate)\b/.test(lower) ? 8 : 0) + (words.length >= 45 ? 4 : 0));
    breakdown = [
      { label: 'Role relevance', score: relevance },
      { label: 'Motivation and fit', score: motivation },
      { label: 'Credibility', score: credibility },
      { label: 'Communication', score: clarity },
      { label: 'Readiness and expectations', score: readiness },
    ];
  } else if (type === 'technical') {
    const depth = clamp(4 + (/\b(architecture|api|integration|security|data|cloud|network|identity|database|service|platform|design|protocol|encryption)\b/.test(lower) ? 8 : 0) + (hasAction ? 5 : 0) + (words.length >= 80 ? 3 : 0));
    const tradeOffs = clamp(4 + (/\b(trade-off|option|decision|constraint|latency|cost|performance|scalability|resilience|availability)\b/.test(lower) ? 10 : 0) + (hasResult ? 4 : 0));
    const controls = clamp(4 + (/\b(control|test|monitor|rollback|security|risk|compliance|observability|logging|alert|gate|review)\b/.test(lower) ? 10 : 0) + (hasMetric ? 4 : 0));
    const evidence = clamp(3 + (hasResult ? 7 : 0) + (hasMetric ? 8 : 0) + (hasAction ? 2 : 0));
    breakdown = [
      { label: 'Role relevance', score: relevance },
      { label: 'Technical depth', score: depth },
      { label: 'Design and trade-offs', score: tradeOffs },
      { label: 'Controls and readiness', score: controls },
      { label: 'Evidence and outcomes', score: evidence },
    ];
  } else {
    const situation = /\b(situation|context|challenge|problem|when i|during|at the time)\b/.test(lower);
    const task = /\b(task|objective|goal|responsible|accountable|needed to|mandate)\b/.test(lower);
    const structure = clamp(2 + (situation ? 4 : 0) + (task ? 4 : 0) + (hasAction ? 6 : 0) + (hasResult ? 4 : 0));
    const ownership = clamp(4 + Math.min(8, iCount * 2) + (hasAction ? 6 : 0) - (weCount > iCount ? 5 : 0));
    const evidence = clamp(3 + (hasResult ? 7 : 0) + (hasMetric ? 8 : 0) + (/\b(user|customer|business|risk|cost|quality|revenue|adoption|availability)\b/.test(lower) ? 2 : 0));
    breakdown = [
      { label: 'Role relevance', score: relevance },
      { label: 'STAR structure', score: structure },
      { label: 'Personal ownership', score: ownership },
      { label: 'Evidence and metrics', score: evidence },
      { label: 'Clarity and focus', score: clarity },
    ];
  }

  const total = breakdown.reduce((sum, item) => sum + item.score, 0);
  const rating = Math.max(1, Math.min(5, Math.ceil(total / 20)));
  const label = total >= 90 ? 'Outstanding' : total >= 80 ? 'Strong' : total >= 70 ? 'Good' : total >= 60 ? 'Developing' : 'Needs stronger evidence';
  const strongest = [...breakdown].sort((a, b) => b.score - a.score)[0];
  const weakest = [...breakdown].sort((a, b) => a.score - b.score)[0];
  const strengths = [`${strongest.label} is the strongest part of the answer.`];
  const improvements = [`Strengthen ${weakest.label.toLowerCase()} with a more direct and evidenced response.`];
  if (!hasAction) improvements.push('Use stronger “I” statements and describe exactly what you did.');
  if (!hasMetric) improvements.push('Add a verified metric covering scale, time, cost, quality, performance or risk.');
  if (clarity < 14) improvements.push('Reduce filler and keep the answer focused.');

  let followUp = `Can you add more evidence for ${weakest.label.toLowerCase()}?`;
  if (type === 'hr' && weakest.label.includes('Motivation')) followUp = `Why does this specific ${role} opportunity matter to you now?`;
  if (type === 'behavioural' && !hasAction) followUp = 'What did you personally do that changed the outcome?';
  if (type === 'technical' && weakest.label.includes('trade-offs')) followUp = 'What options did you evaluate, and why did you choose that technical approach?';
  if (!hasMetric) followUp = 'What measurable result did your actions produce?';

  return {
    question,
    answer: clean,
    total,
    rating,
    label,
    breakdown,
    strengths,
    improvements: improvements.slice(0, 4),
    followUp,
    revisedAnswer: buildRevision(type, question, clean, role),
  };
}

function HumanInterviewer({ state, gender }: { state: AvatarState; gender: AvatarGender }) {
  const female = gender === 'female';
  const name = female ? 'Asha' : 'Arjun';
  const avatarClass = [styles.avatar, state === 'speaking' ? styles.avatarSpeaking : '', state === 'listening' ? styles.avatarListening : '', state === 'thinking' ? styles.avatarThinking : ''].filter(Boolean).join(' ');

  return (
    <div className={styles.avatarWrap} aria-label={`${name}, virtual interviewer, is ${state}`}>
      <svg className={avatarClass} viewBox="0 0 420 520" role="img" aria-labelledby="avatarTitle avatarDesc">
        <title id="avatarTitle">{name}, CogniTwist virtual interviewer</title>
        <desc id="avatarDesc">A realistic synthetic human-style animated interviewer.</desc>
        <defs>
          <radialGradient id="skinReal" cx="42%" cy="27%" r="74%"><stop offset="0" stopColor={female ? '#f0c8a8' : '#e2b08c'} /><stop offset="0.58" stopColor={female ? '#c98964' : '#bd7b58'} /><stop offset="1" stopColor={female ? '#8a4f38' : '#7d4532'} /></radialGradient>
          <linearGradient id="jacketReal" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={female ? '#263d59' : '#26354b'} /><stop offset="1" stopColor="#080f1c" /></linearGradient>
          <linearGradient id="hairReal" x1="0" x2="1"><stop offset="0" stopColor={female ? '#17141a' : '#17191f'} /><stop offset="0.5" stopColor={female ? '#34242a' : '#30333b'} /><stop offset="1" stopColor="#0a0b0f" /></linearGradient>
          <filter id="portraitShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="16" stdDeviation="15" floodColor="#020617" floodOpacity="0.38" /></filter>
          <filter id="skinTexture" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={female ? 7 : 12} result="noise" /><feColorMatrix in="noise" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .035 0" /><feBlend in="SourceGraphic" mode="multiply" /></filter>
        </defs>

        <circle className={styles.voiceGlow} cx="210" cy="205" r="155" fill="none" stroke="rgba(255,255,255,.32)" strokeWidth="8" />
        <circle className={styles.earGlow} cx="210" cy="215" r="139" fill="none" stroke="rgba(110,231,183,.58)" strokeWidth="6" />
        <circle className={styles.thoughtGlow} cx="210" cy="198" r="146" fill="none" stroke="rgba(196,181,253,.6)" strokeWidth="6" strokeDasharray="13 16" />

        <path d="M45 520c10-112 73-174 165-174s155 62 165 174H45Z" fill="url(#jacketReal)" />
        <path d="M158 360h104l-15 160h-74l-15-160Z" fill={female ? '#f4f3f0' : '#edf2f7'} />
        <path d="M157 361l53 72-40 39-48-92 35-19Zm106 0-53 72 40 39 48-92-35-19Z" fill={female ? '#314d6c' : '#263a55'} opacity="0.95" />
        <path d="M176 316h68v65c-16 16-52 16-68 0v-65Z" fill="url(#skinReal)" />

        <g className={styles.faceGroup} filter="url(#portraitShadow)">
          {female ? <path d="M104 209c-8-112 35-172 106-176 77-4 124 57 108 189-16-34-24-70-24-104-36 31-91 45-163 32-1 34-10 63-27 59Z" fill="url(#hairReal)" /> : <path d="M117 160c3-86 43-127 99-127 62 0 99 39 102 124-30-25-65-36-105-33-38 3-70 15-96 36Z" fill="url(#hairReal)" />}
          {female && <><path d="M112 145c-23 47-25 113-9 197 12 38 34 55 50 63l-20-125-21-135Z" fill="#17141a" /><path d="M307 144c25 57 25 125 8 198-11 37-31 55-50 64l20-128 22-134Z" fill="#17141a" /></>}
          <ellipse cx="210" cy="226" rx={female ? 102 : 98} ry={female ? 132 : 126} fill="url(#skinReal)" filter="url(#skinTexture)" />
          <ellipse cx="111" cy="229" rx="16" ry="32" fill={female ? '#aa6b4f' : '#9e6046'} />
          <ellipse cx="309" cy="229" rx="16" ry="32" fill={female ? '#aa6b4f' : '#9e6046'} />

          <path d="M140 195c18-14 38-18 60-10" fill="none" stroke="#4a2c25" strokeWidth={female ? 6 : 8} strokeLinecap="round" />
          <path d="M220 185c22-8 42-4 60 10" fill="none" stroke="#4a2c25" strokeWidth={female ? 6 : 8} strokeLinecap="round" />
          <g className={styles.eye}><ellipse cx="171" cy="217" rx="23" ry="13" fill="#fffaf5" /><ellipse cx="174" cy="218" rx="9" ry="10" fill={female ? '#47362f' : '#3c332d'} /><circle cx="177" cy="214" r="2.5" fill="white" /></g>
          <g className={styles.eye}><ellipse cx="249" cy="217" rx="23" ry="13" fill="#fffaf5" /><ellipse cx="246" cy="218" rx="9" ry="10" fill={female ? '#47362f' : '#3c332d'} /><circle cx="249" cy="214" r="2.5" fill="white" /></g>
          {female && <><path d="M149 211c16-9 32-10 47-3" fill="none" stroke="#2b2020" strokeWidth="3" strokeLinecap="round" /><path d="M224 208c15-7 31-6 47 3" fill="none" stroke="#2b2020" strokeWidth="3" strokeLinecap="round" /></>}

          <path d="M209 224c-3 26-9 48-15 64 9 8 23 9 34 1" fill="none" stroke="#905844" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="164" cy="264" rx="28" ry="14" fill="#cf806d" opacity="0.16" /><ellipse cx="256" cy="264" rx="28" ry="14" fill="#cf806d" opacity="0.16" />
          {!female && <path d="M139 289c16 45 47 67 72 67 28 0 59-23 72-67-19 23-44 33-73 33-29 0-52-10-71-33Z" fill="#2b2526" opacity="0.25" />}
          <path className={styles.mouth} d={female ? 'M165 303c27 19 62 19 90 0-28 9-62 9-90 0Z' : 'M169 303c25 14 56 14 82 0-25 8-56 8-82 0Z'} fill={female ? '#7d3540' : '#663b36'} />
          <path d="M174 303c23 7 48 7 72 0" stroke="#f2d8d2" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
          <path d="M137 249c10 9 19 12 30 11M253 260c12 1 22-2 31-11" fill="none" stroke="#a96751" strokeWidth="3" strokeLinecap="round" opacity="0.38" />
        </g>
      </svg>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-1.5 flex items-center justify-between text-[11px] font-black"><span>{label}</span><span>{value}/20</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-border)]"><div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--highlight))]" style={{ width: `${value * 5}%` }} /></div></div>;
}

export default function LiveInterviewPage() {
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioural');
  const [role, setRole] = useState('Technical Programme Manager');
  const [jobDescription, setJobDescription] = useState('');
  const [avatarGender, setAvatarGender] = useState<AvatarGender>('female');
  const [openingQuestion, setOpeningQuestion] = useState(INTERVIEW_TYPES.behavioural.questions[0]);
  const [currentQuestion, setCurrentQuestion] = useState(INTERVIEW_TYPES.behavioural.questions[0]);
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

  const config = INTERVIEW_TYPES[interviewType];
  const interviewerName = avatarGender === 'female' ? 'Asha' : 'Arjun';
  const latest = history[history.length - 1];
  const averageScore = history.length ? Math.round(history.reduce((sum, item) => sum + item.total, 0) / history.length) : 0;

  useEffect(() => setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)), []);
  useEffect(() => {
    if (sessionState !== 'active') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionState]);
  useEffect(() => () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  const selectInterviewType = (type: InterviewType) => {
    setInterviewType(type);
    const first = INTERVIEW_TYPES[type].questions[0];
    setOpeningQuestion(first);
    setCurrentQuestion(first);
  };

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) { setAvatarState('ready'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = avatarGender === 'female' ? 0.94 : 0.91;
    utterance.pitch = avatarGender === 'female' ? 1.04 : 0.88;
    const voices = window.speechSynthesis.getVoices();
    const femalePattern = /female|samantha|serena|sonia|libby|victoria|karen|moira/i;
    const malePattern = /male|daniel|george|oliver|arthur|aaron|alex/i;
    const preferred = avatarGender === 'female' ? femalePattern : malePattern;
    utterance.voice = voices.find((voice) => voice.lang === 'en-GB' && preferred.test(voice.name)) || voices.find((voice) => voice.lang === 'en-GB') || voices.find((voice) => voice.lang.startsWith('en')) || null;
    utterance.onstart = () => setAvatarState('speaking');
    utterance.onend = () => setAvatarState('ready');
    utterance.onerror = () => setAvatarState('ready');
    window.speechSynthesis.speak(utterance);
  }, [avatarGender, voiceEnabled]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setIsListening(false); setAvatarState('ready'); }, []);
  const startListening = () => {
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
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) transcript += `${event.results[index][0].transcript} `;
      setAnswer(`${baseAnswerRef.current} ${transcript}`.replace(/\s+/g, ' ').trim());
    };
    recognition.onerror = () => { setNotice('The microphone could not capture your answer. Check permission or type your response.'); setIsListening(false); setAvatarState('ready'); };
    recognition.onend = () => { setIsListening(false); setAvatarState('ready'); };
    try { recognition.start(); setIsListening(true); setAvatarState('listening'); setNotice('Listening in real time. Press Stop when you finish.'); } catch { setNotice('The microphone is already active or unavailable.'); }
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
    const cleanRole = role.trim();
    if (!cleanRole) { setNotice('Enter the target role before starting.'); return; }
    const question = openingQuestion.trim() || config.questions[0];
    setHistory([]);
    setElapsed(0);
    setSessionState('active');
    setCurrentQuestion(question);
    setAnswer('');
    setNotice(`${config.label} started. You can replace the question at any time.`);
    window.setTimeout(() => speak(`Welcome. I am ${interviewerName}, your CogniTwist interviewer. We are practising an ${config.label.toLowerCase()} for the ${cleanRole} role. ${question}`), 250);
  };

  const submitAnswer = () => {
    if (!answer.trim()) { setNotice('Speak or type an answer before requesting a score.'); return; }
    stopListening();
    window.speechSynthesis?.cancel();
    setAvatarState('thinking');
    setNotice(`Analysing the answer against ${config.label.toLowerCase()} criteria.`);
    window.setTimeout(() => {
      const assessment = assessAnswer(interviewType, currentQuestion, answer, role.trim(), jobDescription);
      setHistory((items) => [...items, assessment]);
      setAvatarState('ready');
      setNotice(`Answer rated ${assessment.rating}/5 and scored ${assessment.total}/100.`);
      speak(`Your answer scored ${assessment.total} out of 100 and received ${assessment.rating} out of 5 stars. ${assessment.improvements[0]}`);
    }, 650);
  };

  const resetInterview = () => {
    stopListening(); window.speechSynthesis?.cancel(); setSessionState('setup'); setAvatarState('ready'); setHistory([]); setElapsed(0); setAnswer(''); setNotice(''); setCopied(false);
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
    if (averageScore >= 85) return 'Interview-ready: strong evidence, clarity and role fit.';
    if (averageScore >= 70) return 'Good foundation: strengthen the lowest-scoring dimension.';
    return 'Developing: use the revised response and answer the targeted follow-up.';
  }, [history.length, averageScore]);

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] backdrop-blur-xl md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-strong)]"><Sparkles className="h-3.5 w-3.5" /> Zero-cost real-time interview coach</div><h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Practise each interview stage with a human-style coach.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Choose HR, behavioural or technical practice. The selected interviewer asks questions, listens, scores the right competencies and creates a stronger response without paid APIs.</p></div>
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-xs font-black"><Clock3 className="h-4 w-4 text-[var(--accent-strong)]" />{formatTime(elapsed)}</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.3fr]">
          <div className={styles.stage}>
            <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-[11px] font-black text-white backdrop-blur-lg"><span className={`${styles.statusDot} h-2.5 w-2.5 rounded-full bg-current`} />{statusLabel}</div>
            <div className="absolute right-5 top-5 z-10 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-lg">{interviewerName} · AI interviewer</div>
            <HumanInterviewer state={avatarState} gender={avatarGender} />
            <div className="absolute inset-x-5 bottom-5 z-10 rounded-[1.4rem] border border-white/20 bg-black/20 px-4 py-3 text-white backdrop-blur-xl"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">{interviewerName}</p><p className="text-[11px] text-white/75">Synthetic human-style interviewer · voice and processing remain zero-cost</p></div><div className="flex h-8 items-end gap-1" aria-hidden="true">{[13, 22, 17, 26, 14].map((height, index) => <span key={`${height}-${index}`} className={`${styles.waveBar} w-1 rounded-full bg-white/80 ${avatarState === 'ready' ? 'opacity-35' : ''}`} style={{ height }} />)}</div></div></div>
          </div>

          <div className="space-y-5">
            {sessionState === 'setup' ? (
              <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><BrainCircuit className="h-6 w-6" /></div><div><h2 className="text-xl font-black">Set the interview context</h2><p className="text-xs text-[var(--ink-soft)]">Every field below changes the questions, scoring and coaching.</p></div></div>
                <div className="mt-6 grid gap-5">
                  <fieldset><legend className="text-xs font-black">Interview stage</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{(Object.keys(INTERVIEW_TYPES) as InterviewType[]).map((type) => <button key={type} type="button" onClick={() => selectInterviewType(type)} className={`rounded-2xl border p-4 text-left ${interviewType === type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-xs">{INTERVIEW_TYPES[type].label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--ink-soft)]">{INTERVIEW_TYPES[type].description}</span></button>)}</div></fieldset>
                  <label className="text-xs font-black">Target role<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Enter the exact job title…" className="mt-2 min-h-12 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-sm font-normal text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]" /></label>
                  <label className="text-xs font-black">Job description or key requirements <span className="font-normal text-[var(--ink-soft)]">(optional)</span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={4} placeholder="Paste the role requirements for precise relevance scoring…" className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-sm font-normal text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]" /></label>
                  <fieldset><legend className="text-xs font-black">Interviewer and voice</legend><div className="mt-2 grid grid-cols-2 gap-3">{(['female', 'male'] as AvatarGender[]).map((gender) => { const selected = avatarGender === gender; const name = gender === 'female' ? 'Asha' : 'Arjun'; return <button key={gender} type="button" onClick={() => setAvatarGender(gender)} className={`rounded-2xl border p-4 text-left ${selected ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}><strong className="text-sm">{name}</strong><span className="mt-1 block text-[10px] text-[var(--ink-soft)]">{gender === 'female' ? 'Female avatar and voice preference' : 'Male avatar and voice preference'}</span></button>; })}</div></fieldset>
                  <label className="text-xs font-black">Opening question<textarea value={openingQuestion} onChange={(event) => setOpeningQuestion(event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-sm font-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]" /></label>
                  <div className="flex flex-wrap gap-2">{config.questions.slice(0, 5).map((question, index) => <button key={question} type="button" onClick={() => setOpeningQuestion(question)} className="rounded-full border border-[var(--surface-border)] px-3 py-2 text-[11px] font-bold text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]">Question {index + 1}</button>)}</div>
                  {notice && <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-xs leading-5">{notice}</p>}
                  <button type="button" onClick={startInterview} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)]"><Play className="h-4 w-4" />Start {config.label.toLowerCase()}</button>
                </div>
              </section>
            ) : (
              <>
                <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">{config.label} question</p><button type="button" onClick={() => speak(currentQuestion)} className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-2 text-[11px] font-black hover:bg-[var(--accent-soft)]">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}Repeat question</button></div><h2 className="mt-3 text-xl font-black leading-8 md:text-2xl">{currentQuestion}</h2><div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-3"><div className="flex gap-2"><input value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} placeholder="Enter any other interview question…" className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[var(--ink-soft)]" /><button type="button" onClick={() => askQuestion(questionDraft)} disabled={!questionDraft.trim()} className="rounded-xl bg-[var(--accent)] px-4 text-xs font-black text-white disabled:opacity-40">Ask</button></div></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{config.questions.map((question, index) => <button key={question} type="button" onClick={() => askQuestion(question)} className="shrink-0 rounded-full border border-[var(--surface-border)] px-3 py-2 text-[10px] font-bold text-[var(--ink-soft)] hover:bg-[var(--accent-soft)]">Suggested {index + 1}</button>)}</div></section>
                <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7"><div className="flex items-center justify-between gap-3"><label htmlFor="interview-answer" className="text-xs font-black">Your answer</label><button type="button" onClick={() => setVoiceEnabled((value) => !value)} className="rounded-full border border-[var(--surface-border)] p-2 text-[var(--ink-soft)]" aria-label="Toggle interviewer voice">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div><textarea id="interview-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={8} placeholder="Speak naturally or type your answer here…" className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-sm leading-7 text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]" /><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={isListening ? stopListening : startListening} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-black ${isListening ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}>{isListening ? <Square className="h-4 w-4" /> : speechSupported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{isListening ? 'Stop listening' : 'Start listening'}</button><button type="button" onClick={submitAnswer} disabled={!answer.trim() || avatarState === 'thinking'} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-xs font-black text-white disabled:opacity-40"><Send className="h-4 w-4" />Score and improve answer</button></div>{notice && <p className="mt-4 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-xs leading-5">{notice}</p>}</section>
              </>
            )}
          </div>
        </section>

        {latest && sessionState !== 'setup' && <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">{config.label} rating</p><div className="mt-2 flex items-end gap-2"><strong className="text-5xl font-black">{latest.total}</strong><span className="pb-1 text-sm text-[var(--ink-soft)]">/100</span></div><p className="mt-2 text-sm font-black">{latest.label}</p></div><div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-center"><div className="flex gap-0.5 text-[var(--highlight)]">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= latest.rating ? 'fill-current' : ''}`} />)}</div><p className="mt-1 text-[10px] font-black">{latest.rating}/5</p></div></div><div className="mt-6 space-y-4">{latest.breakdown.map((item) => <ScoreBar key={item.label} label={item.label} value={item.score} />)}</div><p className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-xs leading-6 text-[var(--ink-soft)]">{scoreSummary}</p></article>
          <div className="space-y-6"><article className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[var(--accent-strong)]" /><h2 className="text-lg font-black">Coaching feedback</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-[var(--accent-soft)] p-4"><p className="text-xs font-black">What worked</p><ul className="mt-3 space-y-2 text-xs leading-5">{latest.strengths.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />{item}</li>)}</ul></div><div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><p className="text-xs font-black">What will improve the score</p><ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--ink-soft)]">{latest.improvements.map((item) => <li key={item}>• {item}</li>)}</ul></div></div><div className="mt-4 rounded-2xl border border-[var(--surface-border)] p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent-strong)]">Targeted follow-up</p><p className="mt-2 text-sm font-bold leading-6">{latest.followUp}</p><button type="button" onClick={() => askQuestion(latest.followUp)} className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-black text-white"><MessageSquareText className="h-4 w-4" />Answer this follow-up</button></div></article>
          <article className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Interview-ready revision</p><h2 className="mt-1 text-lg font-black">Stronger answer for the {role} role</h2></div><div className="flex gap-2"><button type="button" onClick={() => speak(latest.revisedAnswer)} className="rounded-xl border border-[var(--surface-border)] p-3" aria-label="Read revised answer"><Volume2 className="h-4 w-4" /></button><button type="button" onClick={copyRevision} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</button></div></div><div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5 text-sm leading-7">{latest.revisedAnswer}</div><p className="mt-3 text-[11px] leading-5 text-[var(--ink-soft)]">Replace bracketed prompts with verified facts. CogniTwist does not invent employers, responsibilities or metrics.</p></article></div>
        </section>}

        {sessionState !== 'setup' && <section className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)]"><div><p className="text-xs font-black">Session score: {averageScore || '—'}/100</p><p className="mt-1 text-[11px] text-[var(--ink-soft)]">{history.length} answer{history.length === 1 ? '' : 's'} assessed · no paid service and no server-side recording</p></div><div className="flex gap-2"><button type="button" onClick={() => setSessionState('complete')} className="rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black">Finish session</button><button type="button" onClick={resetInterview} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black"><RotateCcw className="h-4 w-4" />Start again</button></div></section>}
      </div>
    </main>
  );
}
