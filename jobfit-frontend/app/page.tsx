'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Heart,
  HelpCircle,
  Link,
  ListOrdered,
  MessageSquarePlus,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
} from 'lucide-react';

type InterviewType = 'hr' | 'behavioural' | 'technical';
type StudioTab = 'builder' | 'validation' | 'resume' | 'prep' | 'jobs';

type ResumeExperience = {
  company: string;
  role: string;
  duration: string;
  bullet_points: string[];
};

type TailoredResume = {
  full_name: string;
  headline: string;
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
  professional_summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education?: Array<{ qualification: string; institution: string; duration: string }>;
  certifications?: string[];
  projects?: Array<{ name: string; description: string; impact?: string }>;
  achievements?: string[];
};

type ChangeItem = {
  section: string;
  original: string;
  revised: string;
  reason: string;
  evidence_status: 'verified' | 'needs_confirmation';
};

type CareerResults = {
  match_score: number;
  matched_requirements: string[];
  missing_skills: string[];
  evidence_warnings: string[];
  tailoring_tips: string[];
  change_log: ChangeItem[];
  tell_me_about_yourself: string;
  interview_questions: Array<{ question: string; response: string }>;
  follow_up_questions: string[];
  resume: TailoredResume;
  pdf_base64?: string;
  pdf_filename?: string;
  docx_base64?: string;
  docx_filename?: string;
};

type JobMatch = {
  title: string;
  company: string;
  location: string;
  salary: string;
  posted?: string;
  description?: string;
  skills: string[];
  link: string;
  match_score: number;
  matched_requirements: string[];
  missing_requirements: string[];
  recommendation: 'Apply' | 'Apply after tailoring' | 'Review carefully';
};

type JobResults = {
  jobs: JobMatch[];
  best_match_summary?: string;
};

const INTERVIEW_LABELS: Record<InterviewType, string> = {
  hr: 'Initial HR screening',
  behavioural: 'Behavioural interview',
  technical: 'Technical interview',
};

function downloadBase64(base64Value: string | undefined, mimeType: string, filename: string | undefined) {
  if (!base64Value || !filename) return;
  const binary = window.atob(base64Value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black text-[var(--accent-strong)]">
      {children}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-xs leading-6 text-[var(--ink-soft)]">{text}</p>;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<StudioTab>('builder');

  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [duration, setDuration] = useState('30 minutes');
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [interviewType, setInterviewType] = useState<InterviewType>('behavioural');
  const [careerHistory, setCareerHistory] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CareerResults | null>(null);
  const [error, setError] = useState('');

  const [searchCity, setSearchCity] = useState('');
  const [searchRoleSkills, setSearchRoleSkills] = useState('');
  const [searchFile, setSearchFile] = useState<File | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [jobResults, setJobResults] = useState<JobResults | null>(null);
  const [jobError, setJobError] = useState('');

  useEffect(() => setMounted(true), []);

  const inputClass =
    'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';
  const panelClass =
    'rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)] md:p-7';

  const canGenerate = Boolean(
    fullName.trim() &&
      targetRole.trim() &&
      jobDescription.trim() &&
      (resumeFile || careerHistory.trim()),
  );

  const interviewSummary = useMemo(() => {
    if (!results) return '';
    return `${results.interview_questions.length} ${INTERVIEW_LABELS[interviewType].toLowerCase()} questions generated from the entered JD and candidate profile.`;
  }, [results, interviewType]);

  const handleGenerate = async () => {
    if (!canGenerate) {
      setError('Enter your name, target role and job description, then upload a CV or paste your career profile.');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    const formData = new FormData();
    formData.append('full_name', fullName.trim());
    formData.append('target_role', targetRole.trim());
    formData.append('linkedin_profile', linkedin.trim());
    formData.append('interview_duration', duration);
    formData.append('total_questions_requested', String(totalQuestions));
    formData.append('interview_type', interviewType);
    formData.append('career_history', careerHistory.trim());
    formData.append('job_description', jobDescription.trim());
    if (resumeFile) formData.append('resume_file', resumeFile);

    try {
      const response = await fetch('https://resume-builder-backend-ph7b.onrender.com/build-resume', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || 'CV tailoring failed.');
      setResults(data as CareerResults);
      setTab('validation');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'CV tailoring failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchJobs = async () => {
    const roleQuery = searchRoleSkills.trim() || targetRole.trim();
    const candidateFile = searchFile || resumeFile;
    const candidateText = searchRoleSkills.trim() || careerHistory.trim();

    if (!searchCity.trim() || !roleQuery) {
      setJobError('Enter the target role and location.');
      return;
    }
    if (!candidateFile && !candidateText) {
      setJobError('Upload a CV or enter a role and skills summary for matching.');
      return;
    }

    setSearchLoading(true);
    setJobError('');
    setJobResults(null);

    const formData = new FormData();
    formData.append('target_role', roleQuery);
    formData.append('location_city', searchCity.trim());
    formData.append('resume_skills', candidateText);
    if (candidateFile) formData.append('resume_file', candidateFile);

    try {
      const response = await fetch('https://resume-builder-backend-ph7b.onrender.com/search-jobs', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || 'Job discovery failed.');
      setJobResults(data as JobResults);
    } catch (requestError) {
      setJobError(requestError instanceof Error ? requestError.message : 'Job discovery failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  const tailorForJob = (job: JobMatch) => {
    setTargetRole(job.title);
    setJobDescription(
      [
        `${job.title} at ${job.company}`,
        job.location ? `Location: ${job.location}` : '',
        job.description || '',
        job.skills?.length ? `Required skills: ${job.skills.join(', ')}` : '',
        job.missing_requirements?.length
          ? `Requirements to validate: ${job.missing_requirements.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
    setTab('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLiveInterview = (job?: JobMatch) => {
    const role = job?.title || targetRole;
    const description = job
      ? [
          job.description,
          job.skills?.length ? `Required skills: ${job.skills.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      : jobDescription;

    window.sessionStorage.setItem(
      'cognitwist-live-interview-context',
      JSON.stringify({ role, jobDescription: description, interviewType }),
    );
    window.location.href = `/live-interview?role=${encodeURIComponent(role)}&type=${encodeURIComponent(interviewType)}`;
  };

  const resetStudio = () => {
    setFullName('');
    setTargetRole('');
    setLinkedin('');
    setDuration('30 minutes');
    setTotalQuestions(8);
    setInterviewType('behavioural');
    setCareerHistory('');
    setResumeFile(null);
    setJobDescription('');
    setResults(null);
    setError('');
    setTab('builder');
  };

  if (!mounted) return <main className="min-h-screen" />;

  const navItems: Array<{ id: StudioTab; label: string; icon: typeof Sparkles }> = [
    { id: 'builder', label: 'Tailor CV', icon: Sparkles },
    { id: 'jobs', label: 'Discover Jobs', icon: Search },
  ];
  if (results) {
    navItems.push(
      { id: 'validation', label: 'Match Review', icon: BarChart3 },
      { id: 'resume', label: 'Tailored CV', icon: FileText },
      { id: 'prep', label: 'Interview Prep', icon: UserCheck },
    );
  }

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-[2.2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                <Sparkles className="h-3.5 w-3.5" /> Career Studio
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                Discover a role, tailor the CV, and prepare for the interview.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
                One connected workflow using the entered CV, job description and selected interview type. Unsupported claims are surfaced rather than added to the application.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ['Resume tailoring', 'Evidence-preserving CV rewrite'],
                ['Interview preparation', 'HR, behavioural or technical'],
                ['Job discovery', 'Ranked roles with fit evidence'],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                  <p className="text-xs font-black">{title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--ink-soft)]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-[1.6rem] border border-[var(--surface-border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-lg)]" aria-label="Career Studio sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]'
                }`}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </button>
            );
          })}
        </nav>

        {tab === 'builder' && (
          <section className={panelClass}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--surface-border)] pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Create CV from JD</p>
                <h2 className="mt-2 text-2xl font-black">Candidate evidence and target role</h2>
                <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">Upload an existing CV or paste the profile. Both are accepted together.</p>
              </div>
              {(results || resumeFile || careerHistory || jobDescription) && (
                <button type="button" onClick={resetStudio} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black">
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-xs font-black">
                Applicant full name
                <input className={`${inputClass} mt-2`} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Alex Mercer" />
              </label>
              <label className="text-xs font-black">
                Target role
                <input className={`${inputClass} mt-2`} value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Senior Technical Programme Manager" />
              </label>
              <label className="text-xs font-black md:col-span-2">
                LinkedIn profile <span className="font-normal text-[var(--ink-soft)]">(optional)</span>
                <div className="relative mt-2">
                  <Link className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
                  <input className={`${inputClass} pl-11`} value={linkedin} onChange={(event) => setLinkedin(event.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
              </label>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black">Existing CV</p>
                    <p className="mt-1 text-[11px] text-[var(--ink-soft)]">PDF or DOCX, maximum 5 MB</p>
                  </div>
                  <Upload className="h-5 w-5 text-[var(--accent-strong)]" />
                </div>
                <input id="career-cv-upload" type="file" accept=".pdf,.docx" className="hidden" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} />
                <label htmlFor="career-cv-upload" className="mt-4 flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[var(--surface-border)] px-4 text-center text-xs font-bold hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                  {resumeFile ? `Attached: ${resumeFile.name}` : 'Choose CV file'}
                </label>
                {resumeFile && (
                  <button type="button" onClick={() => setResumeFile(null)} className="mt-3 text-[11px] font-black text-rose-700">Remove CV</button>
                )}
              </div>

              <label className="rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-xs font-black">
                Career profile or CV text <span className="font-normal text-[var(--ink-soft)]">(optional when a file is uploaded)</span>
                <textarea className={`${inputClass} mt-3 min-h-36 font-mono text-xs leading-6`} value={careerHistory} onChange={(event) => setCareerHistory(event.target.value)} placeholder="Paste experience, achievements, education and certifications…" />
              </label>
            </div>

            <label className="mt-5 block text-xs font-black">
              Target job description
              <textarea className={`${inputClass} mt-2 min-h-48 font-mono text-xs leading-6`} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the complete job description here…" />
            </label>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="text-xs font-black">
                Interview type
                <select className={`${inputClass} mt-2`} value={interviewType} onChange={(event) => setInterviewType(event.target.value as InterviewType)}>
                  <option value="hr">Initial HR screening</option>
                  <option value="behavioural">Behavioural interview</option>
                  <option value="technical">Technical interview</option>
                </select>
              </label>
              <label className="text-xs font-black">
                Interview duration
                <select className={`${inputClass} mt-2`} value={duration} onChange={(event) => setDuration(event.target.value)}>
                  <option>30 minutes</option>
                  <option>45 minutes</option>
                  <option>60 minutes</option>
                </select>
              </label>
              <label className="text-xs font-black">
                Questions: {totalQuestions}
                <div className="mt-4">
                  <input type="range" min="5" max="25" value={totalQuestions} onChange={(event) => setTotalQuestions(Number(event.target.value))} className="w-full accent-[var(--accent)]" />
                </div>
              </label>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
              Questions and proposed answers are generated from the entered JD, uploaded or pasted profile, and selected interview type. Unsupported experience is shown as a gap rather than inserted into the CV.
            </div>

            {error && <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>}

            <button type="button" onClick={handleGenerate} disabled={loading || !canGenerate} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)] disabled:cursor-not-allowed disabled:opacity-45">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Analysing CV against JD…' : 'Tailor CV and create interview preparation'}
            </button>
          </section>
        )}

        {tab === 'validation' && results && (
          <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
            <article className={panelClass}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">CV–JD match</p>
              <div className="mt-3 flex items-end gap-2"><strong className="text-6xl font-black">{results.match_score}</strong><span className="pb-2 text-sm text-[var(--ink-soft)]">/100</span></div>
              <p className="mt-3 text-xs leading-6 text-[var(--ink-soft)]">The score reflects available evidence, not keyword stuffing.</p>
              <div className="mt-6">
                <p className="text-xs font-black">Verified matches</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {results.matched_requirements?.length
                    ? results.matched_requirements.map((item) => <Badge key={item}>{item}</Badge>)
                    : <EmptyState text="No verified matches returned." />}
                </div>
              </div>
            </article>

            <div className="space-y-6">
              <article className={panelClass}>
                <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-black">Gaps and evidence checks</h2></div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                    <p className="text-xs font-black">Missing or unsupported requirements</p>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--ink-soft)]">
                      {results.missing_skills?.length ? results.missing_skills.map((item) => <li key={item}>• {item}</li>) : <li>No critical gaps identified.</li>}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                    <p className="text-xs font-black">Needs candidate confirmation</p>
                    <ul className="mt-3 space-y-2 text-xs leading-5">
                      {results.evidence_warnings?.length ? results.evidence_warnings.map((item) => <li key={item}>• {item}</li>) : <li>No evidence warnings returned.</li>}
                    </ul>
                  </div>
                </div>
              </article>

              <article className={panelClass}>
                <div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[var(--accent-strong)]" /><h2 className="text-lg font-black">Proposed CV changes</h2></div>
                <div className="mt-5 space-y-4">
                  {results.change_log?.length ? results.change_log.map((change, index) => (
                    <div key={`${change.section}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black">{change.section}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${change.evidence_status === 'verified' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                          {change.evidence_status === 'verified' ? 'Verified evidence' : 'Confirm evidence'}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div><p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Original</p><p className="mt-1 text-xs leading-6">{change.original || 'No direct source extract returned.'}</p></div>
                        <div><p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Proposed</p><p className="mt-1 text-xs leading-6">{change.revised}</p></div>
                      </div>
                      <p className="mt-3 text-[11px] leading-5 text-[var(--ink-soft)]">{change.reason}</p>
                    </div>
                  )) : <EmptyState text="No detailed change log was returned." />}
                </div>
              </article>
            </div>
          </section>
        )}

        {tab === 'resume' && results && (
          <section className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-5">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Tailored CV</p><h2 className="mt-2 text-2xl font-black">ATS-ready application version</h2></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => downloadBase64(results.pdf_base64, 'application/pdf', results.pdf_filename)} disabled={!results.pdf_base64} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"><Download className="h-4 w-4" /> PDF</button>
                <button type="button" onClick={() => downloadBase64(results.docx_base64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', results.docx_filename)} disabled={!results.docx_base64} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black disabled:opacity-40"><Download className="h-4 w-4" /> DOCX</button>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5 md:p-8">
              <h1 className="text-3xl font-black">{results.resume.full_name}</h1>
              <p className="mt-1 text-sm font-bold text-[var(--accent-strong)]">{results.resume.headline || targetRole}</p>
              {results.resume.contact && (
                <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">
                  {[results.resume.contact.email, results.resume.contact.phone, results.resume.contact.location, results.resume.contact.linkedin].filter(Boolean).join(' • ')}
                </p>
              )}

              <div className="mt-7 space-y-7">
                <section><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Professional summary</h2><p className="mt-3 text-sm leading-7">{results.resume.professional_summary}</p></section>
                <section><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Core skills</h2><div className="mt-3 flex flex-wrap gap-2">{results.resume.skills?.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div></section>
                <section>
                  <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Professional experience</h2>
                  <div className="mt-4 space-y-6">
                    {results.resume.experience?.map((experience, index) => (
                      <article key={`${experience.company}-${index}`} className="border-l-2 border-[var(--accent)] pl-4">
                        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-black">{experience.role}</h3><p className="text-xs font-bold text-[var(--ink-soft)]">{experience.company}</p></div><p className="text-[11px] text-[var(--ink-soft)]">{experience.duration}</p></div>
                        <ul className="mt-3 space-y-2 text-xs leading-6">{experience.bullet_points?.map((bullet) => <li key={bullet}>• {bullet}</li>)}</ul>
                      </article>
                    ))}
                  </div>
                </section>

                {results.resume.education?.length ? <section><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Education</h2><div className="mt-3 space-y-2">{results.resume.education.map((item, index) => <p key={`${item.qualification}-${index}`} className="text-xs leading-6"><strong>{item.qualification}</strong> — {item.institution} {item.duration ? `(${item.duration})` : ''}</p>)}</div></section> : null}
                {results.resume.certifications?.length ? <section><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Certifications</h2><ul className="mt-3 space-y-2 text-xs leading-6">{results.resume.certifications.map((item) => <li key={item}>• {item}</li>)}</ul></section> : null}
                {results.resume.projects?.length ? <section><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Selected projects</h2><div className="mt-3 space-y-3">{results.resume.projects.map((project, index) => <article key={`${project.name}-${index}`} className="rounded-xl border border-[var(--surface-border)] p-4"><h3 className="text-xs font-black">{project.name}</h3><p className="mt-2 text-xs leading-6">{project.description}</p>{project.impact && <p className="mt-2 text-xs font-bold">Impact: {project.impact}</p>}</article>)}</div></section> : null}
                {results.resume.achievements?.length ? <section><h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent-strong)]">Achievements</h2><ul className="mt-3 space-y-2 text-xs leading-6">{results.resume.achievements.map((item) => <li key={item}>• {item}</li>)}</ul></section> : null}
              </div>
            </div>
          </section>
        )}

        {tab === 'prep' && results && (
          <section className={panelClass}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--surface-border)] pb-5">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">{INTERVIEW_LABELS[interviewType]}</p><h2 className="mt-2 text-2xl font-black">JD- and profile-specific preparation</h2><p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{interviewSummary}</p></div>
              <button type="button" onClick={() => openLiveInterview()} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-black text-white"><Play className="h-4 w-4" /> Practise live</button>
            </div>

            {results.tell_me_about_yourself && (
              <article className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-5">
                <div className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-[var(--accent-strong)]" /><h3 className="text-sm font-black">Tell me about yourself</h3></div>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-7">{results.tell_me_about_yourself}</p>
              </article>
            )}

            <div className="mt-6 space-y-4">
              {results.interview_questions?.map((item, index) => (
                <article key={`${item.question}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
                  <div className="flex items-start gap-3"><HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-strong)]" /><div><h3 className="text-sm font-black">Q{index + 1}. {item.question}</h3><p className="mt-3 whitespace-pre-wrap text-xs leading-7 text-[var(--ink-soft)]">{item.response}</p></div></div>
                </article>
              ))}
            </div>

            {results.follow_up_questions?.length ? (
              <div className="mt-7"><div className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5 text-[var(--accent-strong)]" /><h3 className="text-sm font-black">Questions to ask the interviewer</h3></div><div className="mt-4 grid gap-3 md:grid-cols-2">{results.follow_up_questions.map((question, index) => <div key={question} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-xs leading-6"><strong>#{index + 1}</strong> {question}</div>)}</div></div>
            ) : null}
          </section>
        )}

        {tab === 'jobs' && (
          <section className={panelClass}>
            <div className="border-b border-[var(--surface-border)] pb-5"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Job discovery</p><h2 className="mt-2 text-2xl font-black">Search and rank current opportunities</h2><p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">The uploaded Career Studio CV is reused automatically unless a different search CV is attached.</p></div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-xs font-black">Target location<input className={`${inputClass} mt-2`} value={searchCity} onChange={(event) => setSearchCity(event.target.value)} placeholder="e.g. London, Southampton or Remote" /></label>
              <label className="text-xs font-black">Target role and skills<input className={`${inputClass} mt-2`} value={searchRoleSkills} onChange={(event) => setSearchRoleSkills(event.target.value)} placeholder={targetRole || 'e.g. Technical Programme Manager, AI, cloud, IAM'} /></label>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
              <input id="job-cv-upload" type="file" accept=".pdf,.docx" className="hidden" onChange={(event) => setSearchFile(event.target.files?.[0] || null)} />
              <label htmlFor="job-cv-upload" className="flex cursor-pointer items-center justify-between gap-4">
                <div><p className="text-xs font-black">Job-matching CV</p><p className="mt-1 text-[11px] text-[var(--ink-soft)]">{searchFile ? searchFile.name : resumeFile ? `Using Career Studio CV: ${resumeFile.name}` : 'Attach PDF or DOCX, or use the pasted profile'}</p></div>
                <Upload className="h-5 w-5 text-[var(--accent-strong)]" />
              </label>
              {searchFile && <button type="button" onClick={() => setSearchFile(null)} className="mt-3 text-[11px] font-black text-rose-700">Use main Career Studio CV instead</button>}
            </div>

            {jobError && <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{jobError}</div>}

            <button type="button" onClick={handleSearchJobs} disabled={searchLoading} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-black text-white disabled:opacity-45">
              {searchLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searchLoading ? 'Searching and ranking jobs…' : 'Find current matching jobs'}
            </button>

            {jobResults && (
              <div className="mt-7 space-y-5 border-t border-[var(--surface-border)] pt-6">
                {jobResults.best_match_summary && <div className="flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" />{jobResults.best_match_summary}</div>}

                <div className="grid gap-4 lg:grid-cols-2">
                  {jobResults.jobs?.map((job, index) => (
                    <article key={`${job.company}-${job.title}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div><p className="text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{job.company}</p><h3 className="mt-1 text-lg font-black">{job.title}</h3><p className="mt-1 text-xs text-[var(--ink-soft)]">{job.location} {job.posted ? `• ${job.posted}` : ''}</p></div>
                        <div className="rounded-2xl bg-[var(--accent-soft)] px-3 py-2 text-center"><div className="text-xl font-black text-[var(--accent-strong)]">{job.match_score}%</div><div className="text-[9px] font-black uppercase">Fit</div></div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2"><Badge>{job.recommendation}</Badge>{job.salary && <Badge>{job.salary}</Badge>}</div>
                      {job.description && <p className="mt-4 text-xs leading-6 text-[var(--ink-soft)]">{job.description}</p>}
                      {job.skills?.length ? <div className="mt-4 flex flex-wrap gap-2">{job.skills.slice(0, 10).map((skill) => <Badge key={skill}>{skill}</Badge>)}</div> : null}

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950"><p className="text-[10px] font-black uppercase">Matched</p><ul className="mt-2 space-y-1 text-[11px] leading-5">{job.matched_requirements?.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul></div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950"><p className="text-[10px] font-black uppercase">Validate</p><ul className="mt-2 space-y-1 text-[11px] leading-5">{job.missing_requirements?.slice(0, 5).map((item) => <li key={item}>• {item}</li>)}</ul></div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => tailorForJob(job)} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-[11px] font-black text-white"><FileText className="h-3.5 w-3.5" /> Tailor CV</button>
                        <button type="button" onClick={() => openLiveInterview(job)} className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2.5 text-[11px] font-black"><Play className="h-3.5 w-3.5" /> Interview prep</button>
                        {job.link?.startsWith('http') ? <a href={job.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2.5 text-[11px] font-black"><ArrowRight className="h-3.5 w-3.5" /> Open job</a> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <footer className="mt-12 border-t border-dashed border-[var(--surface-border)] py-6 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--ink-soft)]">
          Crafted with <Heart className="h-3.5 w-3.5 fill-rose-600 text-rose-600" /> & Developed by <span className="font-mono font-extrabold text-[var(--accent-strong)]">Kuldeep Sharma</span>
        </p>
      </footer>
    </main>
  );
}
