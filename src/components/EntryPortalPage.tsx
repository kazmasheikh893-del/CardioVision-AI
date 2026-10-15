import {
  ArrowRight,
  CheckCircle2,
  Heart,
  Lock,
  ShieldCheck,
  Stethoscope,
  User,
  Sparkles,
  AlertCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { useState } from 'react';
import { api, setDoctorToken, type DoctorProfile } from '../lib/api';

type Props = {
  onSelectPatient: () => void;
  onSelectDoctor: (doctor: DoctorProfile) => void;
  onSelectResearchDashboard?: () => void;
};

export default function EntryPortalPage({
  onSelectPatient,
  onSelectDoctor,
}: Props) {
  const [showDoctorLogin, setShowDoctorLogin] = useState(false);
  const [email, setEmail] = useState('doctor@cardiovision.ai');
  const [password, setPassword] = useState('CardioVision2026!');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await api.loginDoctor({ email, password });
      setDoctorToken(res.token);
      onSelectDoctor(res.doctor);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Invalid login credentials. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      {/* Top Banner */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Heart className="h-5 w-5 fill-teal-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">CardioVision AI</span>
                <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-teal-300 border border-teal-500/30">
                  Track A | 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">Cardiovascular Risk Visualization & Multimodal Prediction</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>FastAPI Backend Active</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-5xl px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 border border-slate-700 px-3.5 py-1 text-xs font-medium text-teal-300">
            <Sparkles size={13} />
            <span>Empirical ML • Explainable AI • 3D Coronary Anatomy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            The Science of Seeing the Heart
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Predict overall coronary artery disease and vessel-specific stenosis (LAD, LCX, RCA) from patient physiological indicators, rendered in interactive 3D anatomical context.
          </p>
        </div>

        {/* EXACTLY TWO Primary Destination Options */}
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto w-full">
          {/* Option 1: Patient Portal */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-900/40 p-7 shadow-xl hover:border-teal-500/50 hover:shadow-teal-950/20 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 group-hover:scale-105 transition">
                <User size={24} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">Patient & Family Access</span>
                <h3 className="text-2xl font-bold text-white mt-0.5">Patient Portal</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Dedicated experience for patients. Enter health metrics, upload clinical lab reports, explore your heart in 3D, and read verified cardiologist recommendations.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800/80 pt-4">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>Secure patient account & private assessment history</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>Interactive 3D Heart with LAD, LCX & RCA vessels</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>Plain-English explanations & doctor-verified advice</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>PDF & lab report parameter extraction</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onSelectPatient}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 px-5 py-3 text-xs font-semibold text-slate-950 transition shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              <span>Enter Patient Experience</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Option 2: Doctor Workstation */}
          <div className="group relative flex flex-col justify-between rounded-2xl border border-teal-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-7 shadow-2xl hover:border-teal-400 hover:shadow-teal-900/30 transition-all duration-200">
            <div className="absolute -top-3 right-6 rounded-full bg-teal-500 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-950 shadow-sm">
              Clinical Auth
            </div>

            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-300 group-hover:scale-105 transition">
                <Stethoscope size={24} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">Authenticated Gateway</span>
                <h3 className="text-2xl font-bold text-white mt-0.5">Doctor Workstation</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Clinical decision support for cardiologists. Review patient queue, inspect log-odds feature contributions, author clinical advice, and access research benchmarks.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800/80 pt-4">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>Patient assessment queue & triage management</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>Clinician advice authoring & notification dispatch</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>Real-time log-odds feature attribution</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={14} className="text-teal-400 shrink-0" />
                  <span>Research benchmarks (ROC curves, confusion matrix)</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowDoctorLogin(true)}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 px-5 py-3 text-xs font-semibold text-slate-950 transition shadow-lg shadow-teal-500/25 cursor-pointer"
            >
              <Lock size={14} />
              <span>Sign In as Doctor</span>
            </button>
          </div>
        </div>

        {/* Scientific Integrity & Research Access Banner */}
        <div className="mt-12 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-teal-400 shrink-0" />
            <span>
              <strong>Zero-Leakage Empirical ML:</strong> Multi-target logistic regression models trained on UCI Cleveland and Z-Alizadeh Sani cohorts. Research benchmarks and full evaluation metrics are accessible in the Doctor Workstation.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono">
            <span className="text-slate-400">Holdout AUC: 0.958</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">5-Fold CV: 0.907</span>
          </div>
        </div>
      </main>

      {/* Doctor Login Modal */}
      {showDoctorLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
                  <Lock size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Doctor Workstation Sign In</h3>
                  <p className="text-[11px] text-slate-400">Secure clinical authentication</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDoctorLogin(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="mt-4 space-y-4">
              {loginError && (
                <div className="rounded-lg bg-rose-950/60 border border-rose-800 p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Clinician Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
                  placeholder="doctor@cardiovision.ai"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-teal-400 focus:outline-none"
                  placeholder="••••••••••••"
                />
              </div>

              <div className="rounded-lg bg-slate-800/50 border border-slate-800 p-2.5 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300 block mb-0.5">Demo Clinician Account:</span>
                Email: <code className="text-teal-300">doctor@cardiovision.ai</code> • Password:{' '}
                <code className="text-teal-300">CardioVision2026!</code>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDoctorLogin(false)}
                  className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 rounded-lg bg-teal-500 hover:bg-teal-400 px-3 py-2 text-xs font-semibold text-slate-950 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loginLoading ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <Lock size={12} />
                      <span>Authenticate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        CardioVision AI • Multimodal AI Hackathon 2026 — Track A • Educational & Clinical Decision Support Prototype
      </footer>
    </div>
  );
}
