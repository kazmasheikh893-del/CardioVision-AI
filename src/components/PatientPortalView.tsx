import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Heart,
  History,
  Info,
  Lock,
  LogOut,
  Phone,
  Sparkles,
  Stethoscope,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  ClinicianReview,
  PatientAssessmentRecord,
  PatientProfile,
  Prediction,
} from '../lib/api';
import {
  api,
  getPatientToken,
  setPatientToken,
} from '../lib/api';
import CoronaryHeartViewer from './heart/CoronaryHeartViewer';

type Props = {
  prediction: Prediction | null;
  patientName?: string;
  assessmentId?: string | null;
  doctorReview?: ClinicianReview | null;
  authenticatedPatient: PatientProfile | null;
  onPatientAuthSuccess: (patient: PatientProfile) => void;
  onPatientLogout: () => void;
  onStartAssessment: () => void;
  onExploreHeart: () => void;
  onSelectSavedAssessment?: (record: PatientAssessmentRecord) => void;
};

export default function PatientPortalView({
  prediction,
  assessmentId,
  doctorReview,
  authenticatedPatient,
  onPatientAuthSuccess,
  onPatientLogout,
  onStartAssessment,
  onExploreHeart,
  onSelectSavedAssessment,
}: Props) {
  // Auth state
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [authPhone, setAuthPhone] = useState('+1 555 123 4567');
  const [authPassword, setAuthPassword] = useState('Patient2026!');
  const [regName, setRegName] = useState('Jane Doe');
  const [regAge, setRegAge] = useState(48);
  const [regEmail, setRegEmail] = useState('jane.doe@example.com');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Patient history state
  const [history, setHistory] = useState<PatientAssessmentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load history whenever patient is authenticated
  useEffect(() => {
    if (authenticatedPatient && getPatientToken()) {
      setHistoryLoading(true);
      api.listPatientAssessments()
        .then((records) => {
          setHistory(records);
        })
        .catch((err) => {
          console.warn('Failed to load patient history:', err);
        })
        .finally(() => {
          setHistoryLoading(false);
        });
    } else {
      setHistory([]);
    }
  }, [authenticatedPatient, assessmentId]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      const res = await api.loginPatient({ phone: authPhone, password: authPassword });
      setPatientToken(res.token);
      onPatientAuthSuccess(res.patient);
      setAuthSuccessMsg('Welcome back! You are now securely logged in.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid login credentials. Please verify your phone number and password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      const res = await api.registerPatient({
        full_name: regName,
        phone: authPhone,
        age: Number(regAge),
        password: authPassword,
        email: regEmail || null,
      });
      setPatientToken(res.token);
      onPatientAuthSuccess(res.patient);
      setAuthSuccessMsg('Account created successfully! Your patient portal is now active.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed. Please check the provided information.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await api.logoutPatient();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      setPatientToken(null);
      onPatientLogout();
    }
  };

  const prob = prediction ? Math.round(prediction.probability * 100) : 0;
  const isElevated = prediction ? prediction.prediction === 1 : false;

  return (
    <div className="space-y-6">
      {/* Patient Welcome Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-dark-border bg-gradient-to-br from-dark-card via-dark-surface to-dark-bg p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 px-3 py-1 text-xs font-semibold text-teal-300">
              <Sparkles size={14} /> Patient Health Companion
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink">
              Your Personal Cardiovascular Health Hub
            </h1>
            <p className="text-sm leading-6 text-subtext">
              CardioVision AI translates complex cardiac indicators into clear insights, empowering you to explore your heart anatomy in 3D and review doctor-approved guidance.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStartAssessment}
                className="inline-flex items-center gap-2 rounded-xl bg-clinical px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:bg-clinical-hover transition cursor-pointer"
              >
                <Activity size={16} /> Start Assessment
              </button>
              <button
                type="button"
                onClick={onExploreHeart}
                className="inline-flex items-center gap-2 rounded-xl border border-dark-border bg-dark-surface px-4 py-2.5 text-xs font-bold text-ink hover:bg-dark-elevated transition cursor-pointer"
              >
                <Heart size={16} className="text-rose-400" /> Explore Heart in 3D
              </button>
            </div>
          </div>

          {/* Patient Account Status / Auth Box */}
          <div className="w-full md:w-80 rounded-xl border border-dark-border bg-dark-surface/90 p-4 shadow-card">
            {authenticatedPatient ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-dark-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                      <UserCheck size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink">{authenticatedPatient.full_name}</p>
                      <p className="text-[10px] text-teal-400 font-mono">Patient Account Active</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    title="Sign out of patient session"
                  >
                    <LogOut size={12} />
                    <span>Sign Out</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-subtext">
                  <div className="rounded bg-dark-card p-2 border border-dark-border">
                    <span className="block text-[10px] text-subtext/70 uppercase">Age</span>
                    <span className="font-semibold text-ink">{authenticatedPatient.age} years</span>
                  </div>
                  <div className="rounded bg-dark-card p-2 border border-dark-border">
                    <span className="block text-[10px] text-subtext/70 uppercase">Phone</span>
                    <span className="font-semibold text-ink truncate">{authenticatedPatient.phone}</span>
                  </div>
                </div>

                <div className="text-[11px] text-subtext flex items-center gap-1.5 pt-1">
                  <CheckCircle2 size={12} className="text-teal-400 shrink-0" />
                  <span>Authenticated session protected by SHA-256 token.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-dark-border pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Lock size={14} className="text-teal-400" />
                    <span>Patient Access</span>
                  </div>
                  <div className="flex text-[11px] rounded bg-dark-card p-0.5 border border-dark-border">
                    <button
                      type="button"
                      onClick={() => setAuthMode('signin')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${authMode === 'signin' ? 'bg-clinical text-white font-bold' : 'text-subtext'}`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${authMode === 'register' ? 'bg-clinical text-white font-bold' : 'text-subtext'}`}
                    >
                      Register
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="rounded-lg bg-rose-950/60 border border-rose-800 p-2 text-[11px] text-rose-300 flex items-start gap-1.5">
                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-rose-400" />
                    <span>{authError}</span>
                  </div>
                )}
                {authSuccessMsg && (
                  <div className="rounded-lg bg-emerald-950/60 border border-emerald-800 p-2 text-[11px] text-emerald-300 flex items-start gap-1.5">
                    <CheckCircle2 size={13} className="shrink-0 mt-0.5 text-emerald-400" />
                    <span>{authSuccessMsg}</span>
                  </div>
                )}

                {authMode === 'signin' ? (
                  <form onSubmit={handleLoginSubmit} className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-subtext mb-0.5">Phone Number</label>
                      <input
                        type="text"
                        required
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        placeholder="+1 555 123 4567"
                        className="w-full rounded bg-dark-card border border-dark-border px-2.5 py-1.5 text-xs text-ink focus:border-clinical focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-subtext mb-0.5">Password</label>
                      <input
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded bg-dark-card border border-dark-border px-2.5 py-1.5 text-xs text-ink focus:border-clinical focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full mt-2 rounded-lg bg-clinical hover:bg-clinical-hover py-1.5 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer"
                    >
                      {authLoading ? 'Verifying...' : 'Sign In to My Records'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-subtext mb-0.5">Full Name</label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full rounded bg-dark-card border border-dark-border px-2.5 py-1 text-xs text-ink focus:border-clinical focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[10px] text-subtext mb-0.5">Phone (+Country)</label>
                        <input
                          type="text"
                          required
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          placeholder="+15551234567"
                          className="w-full rounded bg-dark-card border border-dark-border px-2 py-1 text-xs text-ink focus:border-clinical focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-subtext mb-0.5">Age (18-100)</label>
                        <input
                          type="number"
                          required
                          min={18}
                          max={100}
                          value={regAge}
                          onChange={(e) => setRegAge(Number(e.target.value))}
                          className="w-full rounded bg-dark-card border border-dark-border px-2 py-1 text-xs text-ink focus:border-clinical focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-subtext mb-0.5">Password (min 8 chars)</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded bg-dark-card border border-dark-border px-2.5 py-1 text-xs text-ink focus:border-clinical focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full mt-2 rounded-lg bg-clinical hover:bg-clinical-hover py-1.5 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer"
                    >
                      {authLoading ? 'Creating Account...' : 'Register Secure Account'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Patient Assessment History List (for logged-in patients) */}
      {authenticatedPatient && history.length > 0 && (
        <section className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-clinical" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink">My Past Health Assessments</h2>
              <span className="rounded-full bg-teal-500/10 text-teal-300 text-[10px] font-semibold px-2 py-0.5 border border-teal-500/30">
                {history.length} Record{history.length > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-[11px] text-subtext">Click any assessment to inspect details</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((record) => {
              const recProb = Math.round(record.prediction.probability * 100);
              const recElevated = recProb >= 50;
              const isSelected = record.id === assessmentId;

              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => onSelectSavedAssessment && onSelectSavedAssessment(record)}
                  className={`flex flex-col justify-between rounded-lg border p-3 text-left transition cursor-pointer ${
                    isSelected
                      ? 'border-clinical bg-teal-500/10 shadow-glow'
                      : 'border-dark-border bg-dark-surface hover:border-dark-muted hover:bg-dark-card'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-[10px] text-subtext">{record.id}</span>
                    <span className="text-[10px] text-subtext">
                      {new Date(record.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between my-1">
                    <span className="text-xs font-semibold text-ink">Risk Estimate:</span>
                    <span className={`text-base font-extrabold ${recElevated ? 'text-rose-400' : 'text-teal-400'}`}>
                      {recProb}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-dark-border/60 text-[10px]">
                    <span className="text-subtext truncate">{record.report_source}</span>
                    <span className={record.doctor_advice ? 'text-teal-400 font-bold' : 'text-amber-400'}>
                      {record.doctor_advice ? 'Doctor Reviewed' : 'Pending Review'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Patient 3D Heart Visualization (Anatomical Coronary Explorer) */}
      <section id="patient-heart-3d" className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-dark-border pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clinical">
              <Heart size={14} className="text-rose-400" /> Interactive 3D Heart Anatomy
            </div>
            <h2 className="text-lg font-bold text-ink">Your Coronary Arteries in 3D</h2>
            <p className="text-xs text-subtext mt-0.5">
              Derived from the Human Reference Atlas v1.3. Rotatable 3D model highlighting the LAD, LCX, and RCA coronary branches.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-subtext">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> &lt;30% (Lower)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> 30–69% (Intermediate)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> ≥70% (Higher)
            </span>
          </div>
        </div>

        {/* 3D Heart Viewer Component */}
        <CoronaryHeartViewer
          vessels={prediction?.vessels}
          variant="patient"
          heightClass="h-[440px]"
          vesselCaveat={
            <div className="text-[11px] text-subtext">
              Colors represent statistical estimates from your clinical indicators. This interactive model is for education and decision support.
            </div>
          }
        />

        {/* Patient-Friendly Vessel Explanations */}
        <div className="grid gap-3 sm:grid-cols-3 pt-2 text-xs">
          <div className="rounded-xl bg-dark-surface p-3 border border-dark-border">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-ink">LAD (Front Artery)</span>
              {prediction?.vessels?.lad && (
                <span className="font-mono text-teal-400 font-bold">
                  {Math.round(prediction.vessels.lad.probability * 100)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-subtext leading-relaxed">
              Travels down the front of the heart. Supplies about half of the main pumping chamber (left ventricle) and the tip (apex).
            </p>
          </div>

          <div className="rounded-xl bg-dark-surface p-3 border border-dark-border">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-ink">LCX (Side Artery)</span>
              {prediction?.vessels?.lcx && (
                <span className="font-mono text-teal-400 font-bold">
                  {Math.round(prediction.vessels.lcx.probability * 100)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-subtext leading-relaxed">
              Curves around the side and back of the heart. Supplies blood to the lateral wall and upper left chamber.
            </p>
          </div>

          <div className="rounded-xl bg-dark-surface p-3 border border-dark-border">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-ink">RCA (Right & Bottom)</span>
              {prediction?.vessels?.rca && (
                <span className="font-mono text-teal-400 font-bold">
                  {Math.round(prediction.vessels.rca.probability * 100)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-subtext leading-relaxed">
              Supplies blood to the right chamber, bottom (inferior) wall, and the heart's natural electrical rhythm pacemaker nodes.
            </p>
          </div>
        </div>
      </section>

      {/* Patient Results & Clinician Advice Hub */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* Card 1: AI Model Estimate Summary */}
        <div className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Activity size={16} className="text-clinical" /> AI Model Assessment Summary
              </h3>
              <span className="rounded bg-teal-500/10 text-teal-300 text-[10px] font-semibold px-2 py-0.5 border border-teal-500/30">
                AI Generated
              </span>
            </div>
            {assessmentId && (
              <span className="font-mono text-[11px] text-subtext">ID: {assessmentId}</span>
            )}
          </div>

          {prediction ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-subtext">Statistical CAD Probability</span>
                  <div className={`text-4xl font-extrabold ${isElevated ? 'text-rose-400' : 'text-teal-400'}`}>
                    {prob}%
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${
                      isElevated ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                    }`}
                  >
                    {isElevated ? 'Elevated Pattern Detected' : 'Lower Risk Pattern'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-dark-surface p-3.5 text-xs text-subtext leading-5 border border-dark-border">
                <p className="font-bold text-ink">What this means in plain English:</p>
                <p className="mt-1">
                  {isElevated
                    ? 'Your reported clinical markers align statistically with patient patterns that have significant coronary narrowing in the research cohort. We recommend discussing these numbers with your cardiologist.'
                    : 'Your reported clinical markers align with baseline lower-risk patterns. Continue healthy physical activity, balanced nutrition, and annual wellness monitoring.'}
                </p>
              </div>

              <div className="text-[11px] text-subtext flex items-center gap-1.5">
                <Info size={12} className="text-teal-400 shrink-0" />
                <span>This score is a statistical model estimate, not a medical diagnosis or coronary angiogram.</span>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-subtext">
              <Activity size={32} className="mx-auto text-dark-muted mb-2" />
              <p className="text-sm font-semibold text-ink">No Assessment Run Yet</p>
              <p className="text-xs text-subtext mt-1">
                Fill in your clinical indicators below or choose a synthetic demo profile to see your personalized summary.
              </p>
              <button
                type="button"
                onClick={onStartAssessment}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-clinical px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
              >
                <span>Go to Clinical Input</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Clinician Advice & Review */}
        <div className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                <Stethoscope size={16} className="text-blue-400" /> Doctor's Clinical Advice
              </h3>
              <span className="rounded bg-blue-500/10 text-blue-300 text-[10px] font-semibold px-2 py-0.5 border border-blue-500/30">
                Doctor Authored
              </span>
            </div>
            <span className="text-[11px] font-semibold text-subtext">
              {doctorReview ? 'Physician Approved' : 'Pending Review'}
            </span>
          </div>

          {doctorReview ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-dark-surface p-3 border border-dark-border">
                <div className="rounded-xl bg-blue-500/20 border border-blue-500/30 p-2 text-blue-400">
                  <Stethoscope size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">{doctorReview.doctor_name}</p>
                  <p className="text-[11px] text-blue-400">{doctorReview.doctor_title}</p>
                </div>
              </div>

              <div className="rounded-xl border border-dark-border bg-dark-surface p-3.5 text-xs text-subtext space-y-2">
                <div>
                  <span className="font-bold text-ink block">Physician Summary:</span>
                  <p className="leading-5 mt-0.5 text-ink/90">{doctorReview.summary}</p>
                </div>
                <div className="border-t border-dark-border pt-2">
                  <span className="font-bold text-ink block">Recommended Clinical Actions:</span>
                  <p className="leading-5 mt-0.5 text-ink/90">{doctorReview.advice}</p>
                </div>
                {doctorReview.follow_up && (
                  <div className="border-t border-dark-border pt-2 text-[11px] text-teal-400">
                    <span className="font-bold text-ink">Suggested Follow-Up: </span>
                    {doctorReview.follow_up}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-subtext">
              <Clock size={32} className="mx-auto text-amber-400 mb-2" />
              <p className="text-sm font-semibold text-ink">No physician review recorded yet.</p>
              <p className="text-xs text-subtext mt-1 max-w-xs mx-auto">
                Once an authorized clinician evaluates your record in the Doctor Workstation, their validated notes and lifestyle instructions will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
