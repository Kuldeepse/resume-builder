'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Headphones,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import styles from './live-interview.module.css';

type InterviewState = 'setup' | 'active' | 'complete';
type AvatarState = 'ready' | 'speaking' | 'listening' | 'thinking';

type AnswerAssessment = {
  answer: string;
  score: number;
  strengths: string[];
  improvements: string[];
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
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

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function assessAnswer(answer: string): AnswerAssessment {
  const normalised = answer.trim();
  const lower = normalised.toLowerCase();
  const words = normalised.split(/\s+/).filter(Boolean);

  let score = 22;
  const strengths: string[] = [];
  const improvements: string[] = [];

  const hasSituation = /\b(situation|context|challenge|problem|when i|at the time)\b/.test(lower);
  const hasTask = /\b(task|objective|goal|responsible|accountable|needed to)\b/.test(lower);
  const hasAction = /\b(i led|i created|i established|i introduced|i decided|i negotiated|i coordinated|i analysed|i implemented|i proposed)\b/.test(lower);
  const hasResult = /\b(result|outcome|achieved|delivered|reduced|increased|improved|saved|adoption|zero p1|on time)\b/.test(lower);
  const hasMetric = /\b\d+(?:\.\d+)?\s*(?:%|percent|users?|weeks?|months?|days?|hours?|minutes?|million|m|k)?\b/i.test(normalised);
  const hasOwnership = /\b(i|my)\b/.test(lower) && !/\bwe\b/.test(lower.slice(0, 80));

  if (words.length >= 80) {
    score += 12;
    strengths.push('Sufficient detail to demonstrate substance.');
  } else if (words.length >= 45) {
    score += 7;
    strengths.push('Concise answer with a workable level of detail.');
  } else {
    improvements.push('Add more context, actions and evidence; the answer is currently too brief.');
  }

  if (hasSituation) score += 9;
  else improvements.push('Open with a clear situation or business context.');

  if (hasTask) score += 9;
  else improvements.push('Clarify your responsibility, objective or decision rights.');

  if (hasAction) {
    score += 18;
    strengths.push('Uses direct ownership language and describes personal actions.');
  } else {
    improvements.push('Use stronger “I” statements and explain the specific actions you took.');
  }

  if (hasResult) {
    score += 14;
    strengths.push('Closes with an outcome or benefit.');
  } else {
    improvements.push('Finish with a clear result, benefit or lesson.');
  }

  if (hasMetric) {
    score += 12;
    strengths.push('Includes measurable evidence.');
  } else {
    improvements.push('Add a metric such as scale, time saved, adoption, cost, quality or risk reduction.');
  }

  if (hasOwnership) score += 6;
  else improvements.push('Separate your contribution from the wider team contribution.');

  return {
    answer: normalised,
    score: Math.min(100, Math.max(0, score)),
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
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
        <desc id="avatarDesc">A human-style animated interviewer avatar with listening, thinking and speaking states.</desc>
        <defs>
          <linearGradient id="jacket" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#16263d" />
            <stop offset="1" stopColor="#0b1323" />
          </linearGradient>
          <linearGradient id="shirt" x1="0" x2="1">
            <stop offset="0" stopColor="#f3f6fb" />
            <stop offset="1" stopColor="#d7e0ed" />
          </linearGradient>
          <radialGradient id="skin" cx="46%" cy="32%" r="72%">
            <stop offset="0" stopColor="#dca57d" />
            <stop offset="0.72" stopColor="#b97855" />
            <stop offset="1" stopColor="#92553b" />
          </radialGradient>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#020617" floodOpacity="0.26" />
          </filter>
        </defs>

        <circle className={styles.voiceGlow} cx="180" cy="170" r="122" fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="7" />
        <circle className={styles.earGlow} cx="180" cy="178" r="108" fill="none" stroke="rgba(110,231,183,.55)" strokeWidth="5" />
        <circle className={styles.thoughtGlow} cx="180" cy="157" r="112" fill="none" stroke="rgba(196,181,253,.55)" strokeWidth="5" strokeDasharray="11 14" />

        <path d="M62 430c8-83 53-126 118-126s110 43 118 126H62Z" fill="url(#jacket)" />
        <path d="M137 309h86l-12 121h-62l-12-121Z" fill="url(#shirt)" />
        <path d="M139 310l41 56-32 31-35-72 26-15Zm82 0-41 56 32 31 35-72-26-15Z" fill="#203451" />
        <path d="M151 278h58v51c-13 13-45 13-58 0v-51Z" fill="url(#skin)" />

        <g className={styles.faceGroup} filter="url(#softShadow)">
          <ellipse cx="180" cy="185" rx="86" ry="110" fill="url(#skin)" />
          <ellipse cx="96" cy="190" rx="13" ry="27" fill="#a96849" />
          <ellipse cx="264" cy="190" rx="13" ry="27" fill="#a96849" />

          <path d="M96 170c-6-68 22-116 80-122 64-7 99 36 91 118-12-16-20-39-25-67-29 23-76 34-130 24-2 20-7 36-16 47Z" fill="#171a23" />
          <path d="M113 121c28 6 83 2 126-31" fill="none" stroke="#292d39" strokeWidth="17" strokeLinecap="round" />
          <path d="M117 139c13-14 29-20 48-18" fill="none" stroke="#4c2c22" strokeWidth="5" strokeLinecap="round" />
          <path d="M195 121c19-2 35 4 48 18" fill="none" stroke="#4c2c22" strokeWidth="5" strokeLinecap="round" />

          <g className={styles.eye}>
            <ellipse cx="143" cy="164" rx="18" ry="11" fill="#fffaf5" />
            <circle cx="146" cy="164" r="6" fill="#2b211e" />
            <circle cx="148" cy="162" r="1.8" fill="white" />
          </g>
          <g className={styles.eye}>
            <ellipse cx="217" cy="164" rx="18" ry="11" fill="#fffaf5" />
            <circle cx="214" cy="164" r="6" fill="#2b211e" />
            <circle cx="216" cy="162" r="1.8" fill="white" />
          </g>

          <path d="M179 171c-2 19-7 36-11 48 7 6 17 7 26 1" fill="none" stroke="#8f543f" strokeWidth="4" strokeLinecap="round" />
          <path d="M145 238c23 13 48 13 70 0" fill="#8f3f46" opacity="0.45" />
          <path className={styles.mouth} d="M148 237c20 16 44 16 64 0-18 7-45 7-64 0Z" fill="#672f35" />
          <path d="M153 238c18 7 36 7 54 0" stroke="#f7d9d6" strokeWidth="3" strokeLinecap="round" opacity="0.75" />

          <path d="M119 203c7 7 14 9 23 8M218 211c9 1 17-1 23-8" fill="none" stroke="#a4614a" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
        </g>
      </svg>
    </div>
  );
}

export default function LiveInterviewPage() {
  const [role, setRole] = useState(ROLE_PRESETS[0]);
  const [sessionState, setSessionState] = useState<InterviewState>('setup');
  const [avatarState, setAvatarState] = useState<AvatarState>('ready');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [assessments, setAssessments] = useState<AnswerAssessment[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [notice, setNotice] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const currentQuestion = QUESTION_BANK[questionIndex];
  const progress = sessionState === 'complete' ? 100 : ((questionIndex + 1) / QUESTION_BANK.length) * 100;
  const averageScore = assessments.length
    ? Math.round(assessments.reduce((total, item) => total + item.score, 0) / assessments.length)
    : 0;

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (sessionState !== 'active') return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [sessionState]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
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

  const startInterview = () => {
    setAssessments([]);
    setQuestionIndex(0);
    setAnswer('');
    setElapsed(0);
    setSessionState('active');
    setNotice('Interview started. Asha will ask six structured questions.');
    window.setTimeout(() => speak(`Welcome. I am Asha, your CogniTwist interviewer. We will practise for the ${role} role. ${QUESTION_BANK[0]}`), 250);
  };

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setAvatarState('ready');
  }, []);

  const startListening = () => {
    if (!speechSupported) {
      setNotice('Speech recognition is not available in this browser. You can type your answer instead.');
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

    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setAnswer((current) => `${current}${current && transcript ? ' ' : ''}${transcript}`.replace(/\s+/g, ' ').trim());
    };
    recognition.onerror = () => {
      setNotice('The microphone could not capture your answer. Check browser permission or type your answer.');
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
      setNotice('Listening. Speak naturally and press Stop when you finish.');
    } catch {
      setNotice('The microphone is already active or unavailable.');
    }
  };

  const submitAnswer = () => {
    if (!answer.trim()) {
      setNotice('Add or speak an answer before continuing.');
      return;
    }

    stopListening();
    window.speechSynthesis?.cancel();
    const assessment = assessAnswer(answer);
    const nextAssessments = [...assessments, assessment];
    setAssessments(nextAssessments);
    setAnswer('');
    setAvatarState('thinking');
    setNotice(`Answer scored ${assessment.score}/100. Asha is preparing the next question.`);

    window.setTimeout(() => {
      if (questionIndex >= QUESTION_BANK.length - 1) {
        setSessionState('complete');
        setAvatarState('ready');
        const finalAverage = Math.round(nextAssessments.reduce((total, item) => total + item.score, 0) / nextAssessments.length);
        speak(`The interview is complete. Your current average score is ${finalAverage} out of 100. Review the coaching points and practise the weaker answers again.`);
        return;
      }

      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      setAvatarState('ready');
      speak(QUESTION_BANK[nextIndex]);
    }, 850);
  };

  const resetInterview = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setSessionState('setup');
    setAvatarState('ready');
    setQuestionIndex(0);
    setAnswer('');
    setAssessments([]);
    setElapsed(0);
    setNotice('');
  };

  const latestAssessment = assessments.at(-1);
  const statusLabel = avatarState === 'speaking'
    ? 'Speaking'
    : avatarState === 'listening'
      ? 'Listening'
      : avatarState === 'thinking'
        ? 'Thinking'
        : sessionState === 'active'
          ? 'Ready for your answer'
          : 'Ready';

  const statusColour = avatarState === 'listening'
    ? 'text-emerald-300'
    : avatarState === 'thinking'
      ? 'text-violet-200'
      : 'text-white';

  const scoreSummary = useMemo(() => {
    if (!assessments.length) return 'Complete an answer to see coaching.';
    if (averageScore >= 80) return 'Strong interview performance with clear evidence.';
    if (averageScore >= 65) return 'Good foundation; strengthen metrics and personal ownership.';
    return 'Build fuller STAR answers and make outcomes measurable.';
  }, [assessments.length, averageScore]);

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] backdrop-blur-xl md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Live interview practice
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Practise with a human-like AI interviewer</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
                Asha asks structured interview questions, listens to your answer, speaks naturally and provides immediate STAR, ownership and evidence coaching. Audio is not stored by this MVP.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-xs font-black text-[var(--foreground)]">
              <Clock3 className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
              {formatTime(elapsed)}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
          <div className={styles.stage}>
            <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-[11px] font-black text-white backdrop-blur-lg">
              <span className={`${styles.statusDot} h-2.5 w-2.5 rounded-full bg-current ${statusColour}`} />
              {statusLabel}
            </div>

            <div className="absolute right-5 top-5 z-10 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-lg">
              Asha · Interviewer
            </div>

            <HumanInterviewer state={avatarState} />

            <div className="absolute inset-x-5 bottom-5 z-10 rounded-[1.4rem] border border-white/20 bg-black/20 px-4 py-3 text-white backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">Asha</p>
                  <p className="text-[11px] text-white/75">CogniTwist virtual interviewer · clearly identified as AI</p>
                </div>
                <div className="flex h-8 items-end gap-1" aria-hidden="true">
                  {[13, 22, 17, 26, 14].map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className={`${styles.waveBar} w-1 rounded-full bg-white/80 ${avatarState === 'ready' ? 'opacity-35' : ''}`}
                      style={{ height }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {sessionState === 'setup' && (
              <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <BrainCircuit className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Session setup</p>
                    <h2 className="text-xl font-black">Choose your target role</h2>
                  </div>
                </div>

                <label className="mt-6 block text-xs font-black text-[var(--foreground)]" htmlFor="interview-role">
                  Interview role
                </label>
                <select
                  id="interview-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="mt-2 min-h-14 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-sm font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                >
                  {ROLE_PRESETS.map((preset) => <option key={preset}>{preset}</option>)}
                </select>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Feature icon={<Headphones className="h-4 w-4" />} label="Spoken questions" />
                  <Feature icon={<Mic className="h-4 w-4" />} label="Voice or text answers" />
                  <Feature icon={<BarChart3 className="h-4 w-4" />} label="Instant coaching" />
                </div>

                <button
                  type="button"
                  onClick={startInterview}
                  className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)]"
                >
                  <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" /> Start live interview
                </button>
              </section>
            )}

            {sessionState === 'active' && (
              <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Question {questionIndex + 1} of {QUESTION_BANK.length}</p>
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">{role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceEnabled((value) => !value);
                      window.speechSynthesis?.cancel();
                      setAvatarState('ready');
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                    aria-label={voiceEnabled ? 'Mute interviewer voice' : 'Enable interviewer voice'}
                  >
                    {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </button>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--highlight))] transition-all" style={{ width: `${progress}%` }} />
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--accent-soft)] p-5">
                  <p className="text-lg font-black leading-7 text-[var(--foreground)]">{currentQuestion}</p>
                  <button
                    type="button"
                    onClick={() => speak(currentQuestion)}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs font-black text-[var(--accent-strong)]"
                  >
                    <Volume2 className="h-4 w-4" /> Repeat question
                  </button>
                </div>

                <label htmlFor="interview-answer" className="mt-5 block text-xs font-black text-[var(--foreground)]">
                  Your answer
                </label>
                <textarea
                  id="interview-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  rows={8}
                  placeholder="Speak or type your answer. Use Situation, Task, Action and Result, with clear ownership and metrics."
                  className="mt-2 w-full resize-y rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black ${
                      isListening
                        ? 'border-rose-300 bg-rose-50 text-rose-800'
                        : 'border-[var(--surface-border)] bg-[var(--surface-strong)] text-[var(--foreground)] hover:bg-[var(--accent-soft)]'
                    }`}
                  >
                    {isListening ? <Square className="h-4 w-4" fill="currentColor" /> : speechSupported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    {isListening ? 'Stop listening' : speechSupported ? 'Start listening' : 'Microphone unavailable'}
                  </button>
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={!answer.trim()}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Send className="h-4 w-4" /> Submit answer
                  </button>
                </div>
              </section>
            )}

            {sessionState === 'complete' && (
              <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Interview complete</p>
                    <h2 className="mt-2 text-3xl font-black">Your coaching report</h2>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">{scoreSummary}</p>
                  </div>
                  <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-8 border-[var(--accent-soft)] bg-[var(--surface-strong)]">
                    <strong className="text-2xl font-black text-[var(--accent-strong)]">{averageScore}</strong>
                    <span className="text-[9px] font-black uppercase text-[var(--ink-soft)]">/100</span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {assessments.map((item, index) => (
                    <details key={`${index}-${item.score}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                      <summary className="cursor-pointer text-sm font-black text-[var(--foreground)]">
                        Question {index + 1} · {item.score}/100
                      </summary>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Strengths</p>
                          <ul className="mt-2 space-y-2 text-xs leading-5 text-[var(--ink-soft)]">
                            {(item.strengths.length ? item.strengths : ['The answer was captured successfully.']).map((point) => <li key={point}>• {point}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Improve next time</p>
                          <ul className="mt-2 space-y-2 text-xs leading-5 text-[var(--ink-soft)]">
                            {(item.improvements.length ? item.improvements : ['Keep the same structure and evidence level.']).map((point) => <li key={point}>• {point}</li>)}
                          </ul>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={resetInterview}
                  className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] text-sm font-black text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
                >
                  <RotateCcw className="h-4 w-4" /> Start another interview
                </button>
              </section>
            )}

            {notice && (
              <div role="status" className="rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--foreground)]">
                {notice}
              </div>
            )}

            {latestAssessment && sessionState === 'active' && (
              <section className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[var(--accent-strong)]" />
                    <p className="text-sm font-black">Previous answer feedback</p>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--accent-strong)]">{latestAssessment.score}/100</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--ink-soft)]">
                  {latestAssessment.improvements[0] || latestAssessment.strengths[0] || 'Answer captured.'}
                </p>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-3 text-xs font-bold text-[var(--foreground)]">
      <span className="text-[var(--accent-strong)]">{icon}</span>
      {label}
    </div>
  );
}
