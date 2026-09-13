'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Play, Target, Volume2 } from 'lucide-react';
import { buildExpectedInterviewResponse } from '../../lib/interview-expected-response.mjs';

type InterviewType = 'hr' | 'behavioural' | 'technical';

type StoredContext = {
  role?: string;
  company?: string;
  jobDescription?: string;
  interviewType?: InterviewType;
  candidateEvidence?: string[];
};

type TtsSettings = {
  voiceURI: string;
  rate: number;
};

type ExpectedResponse = {
  intent: string;
  title: string;
  interviewer_testing: string[];
  structure: string;
  expected_response: string;
  relevant_evidence: string[];
  missing_evidence: string[];
  evidence_safe: boolean;
};

const STORAGE_KEY = 'cognitwist-live-interview-tts';

const OPENINGS: Record<InterviewType, string> = {
  hr: 'Please introduce yourself and explain why you are interested in this role.',
  behavioural: 'Tell me about a complex programme or project you led. What made it difficult, and what did you personally do?',
  technical: 'Walk me through the architecture of a complex platform or transformation you delivered.',
};

function safeType(value: unknown): InterviewType {
  return value === 'hr' || value === 'technical' || value === 'behavioural' ? value : 'behavioural';
}

function readContext(): StoredContext {
  try {
    const raw = window.sessionStorage.getItem('cognitwist-live-interview-context');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredContext;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readSettings(): TtsSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { voiceURI: 'auto', rate: 0.94 };
    const parsed = JSON.parse(raw) as Partial<TtsSettings>;
    const rate = Number(parsed.rate);
    return {
      voiceURI: typeof parsed.voiceURI === 'string' && parsed.voiceURI ? parsed.voiceURI : 'auto',
      rate: Number.isFinite(rate) ? Math.max(0.7, Math.min(1.3, rate)) : 0.94,
    };
  } catch {
    return { voiceURI: 'auto', rate: 0.94 };
  }
}

function readCurrentQuestionFromPage() {
  const marker = Array.from(document.querySelectorAll('p')).find((node) => node.textContent?.trim() === 'Current question');
  const heading = marker?.parentElement?.querySelector('h2');
  return heading?.textContent?.trim() || '';
}

export default function VoiceAnswerGuide() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('auto');
  const [rate, setRate] = useState(0.94);
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioural');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [candidateEvidence, setCandidateEvidence] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const originalSpeakRef = useRef<((utterance: SpeechSynthesisUtterance) => void) | null>(null);

  useEffect(() => {
    const stored = readSettings();
    setVoiceURI(stored.voiceURI);
    setRate(stored.rate);
    const context = readContext();
    const params = new URLSearchParams(window.location.search);
    const nextType = safeType(params.get('type') || context.interviewType);
    setInterviewType(nextType);
    setRole(String(params.get('role') || context.role || '').slice(0, 240));
    setCompany(String(context.company || '').slice(0, 240));
    setJobDescription(String(context.jobDescription || '').slice(0, 12000));
    setCandidateEvidence(Array.isArray(context.candidateEvidence)
      ? context.candidateEvidence.map((item) => String(item).slice(0, 1200)).filter(Boolean).slice(0, 30)
      : []);
    setCurrentQuestion(readCurrentQuestionFromPage() || OPENINGS[nextType]);

    const syncQuestion = () => {
      const visibleQuestion = readCurrentQuestionFromPage();
      if (visibleQuestion) setCurrentQuestion((previous) => previous === visibleQuestion ? previous : visibleQuestion);
    };
    const observer = new MutationObserver(syncQuestion);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    if (!('speechSynthesis' in window)) {
      return () => observer.disconnect();
    }

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const list = synth.getVoices()
        .filter((voice) => voice.lang?.toLowerCase().startsWith('en'))
        .sort((a, b) => `${a.lang}-${a.name}`.localeCompare(`${b.lang}-${b.name}`));
      setVoices(list);
    };
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);

    const original = synth.speak.bind(synth);
    originalSpeakRef.current = original;
    const wrapped = (utterance: SpeechSynthesisUtterance) => {
      const settings = readSettings();
      const available = synth.getVoices();
      const chosen = settings.voiceURI === 'auto'
        ? available.find((voice) => voice.lang === 'en-GB') || available.find((voice) => voice.lang?.toLowerCase().startsWith('en'))
        : available.find((voice) => voice.voiceURI === settings.voiceURI);
      if (chosen) {
        utterance.voice = chosen;
        utterance.lang = chosen.lang || utterance.lang || 'en-GB';
      }
      utterance.rate = settings.rate;
      original(utterance);
    };

    try {
      synth.speak = wrapped;
    } catch {
      // Some browsers expose speechSynthesis.speak as non-writable. The page keeps its default voice in that case.
    }

    return () => {
      observer.disconnect();
      synth.removeEventListener?.('voiceschanged', loadVoices);
      if (originalSpeakRef.current) {
        try { synth.speak = originalSpeakRef.current; } catch { /* no-op */ }
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ voiceURI, rate }));
    } catch {
      // Storage can be unavailable in privacy-restricted browser modes.
    }
  }, [voiceURI, rate]);

  const selectedVoice = useMemo(() => voices.find((voice) => voice.voiceURI === voiceURI), [voices, voiceURI]);
  const expected = useMemo(() => buildExpectedInterviewResponse({
    role,
    company,
    job_description: jobDescription,
    interview_type: interviewType,
    question: currentQuestion || OPENINGS[interviewType],
    candidate_evidence: candidateEvidence,
  }) as ExpectedResponse, [role, company, jobDescription, interviewType, currentQuestion, candidateEvidence]);

  const preview = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`CogniTwist voice preview. This is your interview coach${role ? ` for the ${role} role` : ''}.`);
    utterance.lang = selectedVoice?.lang || 'en-GB';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className="mx-auto mt-4 max-w-7xl px-3 md:px-8" aria-label="Interview voice and expected answer settings">
      <div className="grid gap-3 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-lg)] lg:grid-cols-[0.8fr_1.4fr]">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
          <div className="flex items-center gap-2 text-xs font-black"><Volume2 className="h-4 w-4 text-[var(--accent-strong)]" /> Voice / TTS</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Coach voice
              <select value={voiceURI} onChange={(event) => setVoiceURI(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--foreground)]">
                <option value="auto">Auto · best available English voice</option>
                {voices.map((voice) => <option key={`${voice.voiceURI}-${voice.lang}`} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? ' · local' : ''}</option>)}
              </select>
            </label>
            <button type="button" onClick={preview} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 text-xs font-black"><Play className="h-3.5 w-3.5" /> Preview</button>
          </div>
          <label className="mt-3 block text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]"><span className="flex items-center justify-between"><span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> Speech speed</span><span>{rate.toFixed(2)}×</span></span>
            <input type="range" min="0.7" max="1.3" step="0.05" value={rate} onChange={(event) => setRate(Number(event.target.value))} className="mt-2 w-full" />
          </label>
          <p className="mt-2 text-[10px] leading-5 text-[var(--ink-soft)]">Voice choices come from the browser/operating system. If a selected voice disappears, CogniTwist falls back to the best available English voice.</p>
        </div>

        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4">
          <div className="flex items-start gap-3"><Target className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" /><div className="min-w-0 flex-1"><p className="text-xs font-black text-[var(--accent-strong)]">Expected response for the current question</p><p className="mt-1 text-sm font-black leading-6">{currentQuestion || OPENINGS[interviewType]}</p></div></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{expected.interviewer_testing.map((item) => <span key={item} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1 text-[9px] font-black">{item}</span>)}</div>
          <div className="mt-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Best structure</p>
            <p className="mt-1 text-xs leading-6">{expected.structure}</p>
          </div>
          <div className="mt-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Expected response</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-6 text-[var(--foreground)]">{expected.expected_response}</pre>
          </div>
          {expected.relevant_evidence.length ? <div className="mt-3"><p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Relevant evidence already available</p><ul className="mt-2 space-y-1.5 text-[10px] leading-5 text-[var(--ink-soft)]">{expected.relevant_evidence.map((item) => <li key={item}>• {item}</li>)}</ul></div> : <p className="mt-3 text-[10px] leading-5 text-[var(--ink-soft)]">No candidate evidence was carried into this session, so the response keeps evidence fields as visible placeholders rather than inventing them.</p>}
          <p className="mt-3 text-[10px] leading-5 text-[var(--ink-soft)]">This updates automatically when the interview coach changes the question. Bracketed fields are prompts for verified facts, not generated claims.</p>
        </div>
      </div>
    </section>
  );
}
