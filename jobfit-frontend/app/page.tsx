'use client';
import { useState } from 'react';
import { FileText, CheckCircle, Share2, Copy, Sparkles, RefreshCw } from 'lucide-react';

export default function Home() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [careerHistory, setCareerHistory] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !targetRole || !careerHistory) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('target_role', targetRole);
    formData.append('career_history', careerHistory);

    try {
      const response = await fetch('http://localhost:8000/build-resume', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Error processing building request profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(results.shareable_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold text-indigo-600 flex items-center justify-center gap-2">
            <Sparkles className="text-indigo-500 w-9 h-9" /> AI Resume Builder
          </h1>
          <p className="text-slate-500 mt-2">Generate a polished, recruiter-ready resume and share it instantly via the cloud</p>
        </header>

        {!results ? (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Full Name</label>
                <input type="text" required className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)}/>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Target Job Title</label>
                <input type="text" required className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Senior Software Engineer" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}/>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Your Career History & Notes</label>
              <textarea rows={8} required className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Paste your rough background notes, old resume bullet points, or list your past responsibilities here..." value={careerHistory} onChange={(e) => setCareerHistory(e.target.value)}/>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition flex items-center justify-center gap-2">
              {loading ? <><RefreshCw className="animate-spin w-5 h-5"/> Crafting Your Resume...</> : "Generate Resume"}
            </button>
          </form>
        ) : (
          <div className="bg-white p-8 rounded-xl shadow-sm space-y-8">
            {/* Share link Banner Component */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-lg text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Share2 className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold">Your AI Resume is Live!</h3>
                  <p className="text-xs text-indigo-100">Send this cloud hosted link straight to hiring managers.</p>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-2 bg-white/10 p-1 rounded-md border border-white/20">
                <input type="text" readOnly value={results.shareable_url} className="bg-transparent text-xs px-2 outline-none w-full sm:w-48 text-white select-all" />
                <button onClick={copyToClipboard} className="bg-white text-indigo-600 p-2 rounded text-xs font-bold hover:bg-indigo-50 flex items-center gap-1 transition">
                  {copied ? <CheckCircle className="w-3 h-3 text-green-600"/> : <Copy className="w-3 h-3"/>} {copied ? "Copied" : "Copy Link"}
                </button>
              </div>
            </div>

            {/* Generated Content Preview Area */}
            <div className="border border-slate-200 p-6 rounded-lg space-y-6 bg-slate-50/50">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-bold">{results.resume.full_name}</h2>
                <p className="text-indigo-600 font-medium">{targetRole}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-400 text-xs tracking-wider uppercase mb-1">Professional Summary</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{results.resume.professional_summary}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-400 text-xs tracking-wider uppercase mb-2">Core Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {results.resume.skills.map((skill: string, i: number) => (
                    <span key={i} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-md font-medium border border-indigo-100">{skill}</span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-400 text-xs tracking-wider uppercase mb-3">Professional Experience</h4>
                <div className="space-y-4">
                  {results.resume.experience.map((exp: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm font-bold">
                        <span>{exp.role} — <span className="text-slate-500 font-normal">{exp.company}</span></span>
                        <span className="text-slate-400 font-normal text-xs">{exp.duration}</span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 pl-1">
                        {exp.bullet_points.map((bullet: string, idx: number) => <li key={idx}>{bullet}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => setResults(null)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition">← Build another resume</button>
          </div>
        )}
      </div>
    </main>
  );
}

