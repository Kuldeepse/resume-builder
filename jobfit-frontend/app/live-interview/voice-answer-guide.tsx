'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Play, Volume2 } from 'lucide-react';

type InterviewType = 'hr' | 'behavioural' | 'technical';

type StoredContext = {
  role?: string;
  company?: string;
  interviewType?: InterviewType;
};

type TtsSettings = {
  voiceURI: string;
  rate: number;
};

const STORAGE_KEY = 'cognitwist-live-interview-tts';

const GUIDES: Record<InterviewType, { label: string; structure: string; template: string }> = {
  hr: {
    label: 'HR answer pattern',
    structure: 'Direct answer → relevant evidence → why this role/company → practical facts when asked.',
    template: 'I am interested in this opportunity because [verified reason]. My most relevant evidence is [specific experience]. I personally [verified contribution], which led to [verified outcome].',
  },
  behavioural: {
    label: 'Behavioural / STAR answer pattern',
    structure: 'Situation 10–15% → Task 10% → Action 50–60% → Result 20–25% → learning if relevant.',
    template: 'Situation: [verified context]. Task: I was accountable for [objective]. Action: I [2–3 specific decisions/actions]. Result: [verified metric/outcome].',
  },
  technical: {
    label: 'Technical answer pattern',
    structure: 'Context/constraints → architecture/options → decision and trade-off → controls/testing → verified outcome.',
    template: 'Context: [platform/scale/constraint]. I evaluated [options], chose [approach] because [trade-off], validated it through [controls/tests], and achieved [verified outcome].',
  },
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

export default function VoiceAnswerGuide() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('auto');
  const [rate, setRate] = useState(0.94);
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioural');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const originalSpeakRef = useRef<((utterance: SpeechSynthesisUtterance) => void) | null>(null);

  useEffect(() => {
    const stored = readSettings();
    setVoiceURI(stored.voiceURI);
    setRate(stored.rate);
    const context = readContext();
    const params = new URLSearchParams(window.location.search);
    setInterviewType(safeType(params.get('type') || context.interviewType));
    setRole(String(params.get('role') || context.role || '').slice(0, 240));
    setCompany(String(context.company || '').slice(0, 240));

    if (!('speechSynthesis' in window)) return;
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
      // Some browsers expose speechSynthesis.speak as non-writable. The page still works with its default voice.
    }

    return () => {
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
  const guide = GUIDES[interviewType];

  const preview = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`CogniTwist voice preview. This is your interview coach${role ? ` for the ${role} role` : ''}.`);
    utterance.lang = selectedVoice?.lang || 'en-GB';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className="mx-auto mt-4 max-w-7xl px-3 md:px-8" aria-label="Interview voice and expected answer settings">
      <div className="grid gap-3 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-lg)] lg:grid-cols-[1fr_1.25fr]">
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
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-[var(--accent-strong)]">What a strong answer should contain</p><select value={interviewType} onChange={(event) => setInterviewType(safeType(event.target.value))} className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-[10px] font-black"><option value="hr">HR</option><option value="behavioural">Behavioural</option><option value="technical">Technical</option></select></div>
          <p className="mt-2 text-[11px] font-black">{guide.label}{role ? ` · ${role}` : ''}{company ? ` · ${company}` : ''}</p>
          <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{guide.structure}</p>
          <div className="mt-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-xs leading-6"><span className="font-black">Expected response template:</span> {guide.template}</div>
          <p className="mt-2 text-[10px] leading-5 text-[var(--ink-soft)]">Use only facts you can verify. Bracketed fields are prompts, not claims CogniTwist should invent for you.</p>
        </div>
      </div>
    </section>
  );
}
