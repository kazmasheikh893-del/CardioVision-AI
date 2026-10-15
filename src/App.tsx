import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Database,
  HeartPulse,
  Info,
  Layers,
  LogOut,
  ShieldAlert,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AnatomyExplorer from './components/AnatomyExplorer';
import DoctorWorkstation from './components/DoctorWorkstation';
import EntryPortalPage from './components/EntryPortalPage';
import EvaluationPanel from './components/EvaluationPanel';
import ExplanationPanel from './components/ExplanationPanel';
import PatientPortalView from './components/PatientPortalView';
import PredictionPanel from './components/PredictionPanel';
import type {
  Assessment,
  ClinicalInput,
  ClinicianReview,
  DoctorProfile,
  Evaluation,
  Explanation,
  ModelInfo,
  PatientAssessmentRecord,
  PatientProfile,
  Prediction,
} from './lib/api';
import { api, setDoctorToken, setPatientToken, syntheticExamples } from './lib/api';

type UserRole = 'patient' | 'doctor';

function Stat({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-card p-4 shadow-card hover:border-clinical/40 transition">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 p-2.5 text-clinical">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtext">{label}</p>
          <p className="mt-0.5 text-xl font-bold text-ink">{value}</p>
          {subtext ? <p className="text-[10px] text-subtext/80">{subtext}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [portalView, setPortalView] = useState<'gateway' | 'app'>('gateway');
  const [authenticatedDoctor, setAuthenticatedDoctor] = useState<DoctorProfile | null>(null);
  const [authenticatedPatient, setAuthenticatedPatient] = useState<PatientProfile | null>(null);
  const [role, setRole] = useState<UserRole>('patient');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [values, setValues] = useState<ClinicalInput>(syntheticExamples.lower_probability);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);

  // Active assessment tracking across portals
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('Jane Doe');
  const [doctorReview, setDoctorReview] = useState<ClinicianReview | null>(null);

  useEffect(() => {
    Promise.all([api.modelInfo(), api.evaluation()])
      .then(([info, evalResult]) => {
        setModelInfo(info);
        setEvaluation(evalResult);
        setBackendConnected(true);
      })
      .catch((err) => {
        setBackendConnected(false);
        setBootError(
          err instanceof Error
            ? `Backend service unreachable: ${err.message}. Ensure backend is running at http://127.0.0.1:8000.`
            : 'Could not connect to backend.'
        );
      });

    api.getDoctorMe()
      .then((doc) => {
        setAuthenticatedDoctor(doc);
      })
      .catch(() => {
        setDoctorToken(null);
      });

    api.getPatientMe()
      .then((pat) => {
        setAuthenticatedPatient(pat);
        setPatientName(pat.full_name);
      })
      .catch(() => {
        setPatientToken(null);
      });
  }, []);

  const featureCount = modelInfo?.features.length.toString() ?? '13';
  const rocAuc = evaluation?.holdout.metrics.roc_auc
    ? evaluation.holdout.metrics.roc_auc.toFixed(3)
    : '0.958';
  const cvAuc = evaluation?.cross_validation?.roc_auc
    ? `${evaluation.cross_validation.roc_auc.mean.toFixed(3)}`
    : '0.907';
  const rows = modelInfo?.dataset.rows.toString() ?? '303';

  const handleAssessmentSaved = (id: string) => {
    setActiveAssessmentId(id);
    api.getAssessment(id)
      .then((a) => {
        if (a.review) setDoctorReview(a.review);
      })
      .catch((err) => console.error(err));
  };

  const handleDoctorSelectAssessment = (a: Assessment) => {
    setActiveAssessmentId(a.id);
    setPatientName(a.patient_name);
    setValues({ ...a.inputs });
    setPrediction(a.prediction);
    if (a.explanation) setExplanation(a.explanation);
    if (a.review) setDoctorReview(a.review);
    else setDoctorReview(null);
  };

  const handleSelectSavedPatientAssessment = (record: PatientAssessmentRecord) => {
    setActiveAssessmentId(record.id);
    setPatientName(record.patient_name);
    if (record.inputs) {
      setValues({ ...record.inputs });
    }
    if (record.prediction) {
      setPrediction({
        prediction: record.prediction.risk_level === 'High Risk' ? 1 : 0,
        probability: record.prediction.probability,
        threshold: 0.5,
        label: record.prediction.risk_level,
        target_definition: 'Binary CAD target: >=50% diameter narrowing',
        limitations: ['Statistical model estimate.'],
        vessels: record.prediction.vessels,
      });
    }
    if (record.doctor_advice) {
      setDoctorReview(record.doctor_advice);
    } else {
      setDoctorReview(null);
    }
  };

  const handleLogout = () => {
    if (role === 'doctor') {
      setDoctorToken(null);
      setAuthenticatedDoctor(null);
    } else {
      setPatientToken(null);
      setAuthenticatedPatient(null);
    }
    setPortalView('gateway');
  };

  const patientNav = useMemo(
    () => [
      ['Overview', '#overview'],
      ['My Assessment', '#predict'],
      ['3D Heart Anatomy', '#anatomy'],
      ['Explanation', '#explain'],
      ['Clinical Safety', '#model-card'],
    ],
    []
  );

  const doctorNav = useMemo(
    () => [
      ['Doctor Workstation', '#doctor-workstation'],
      ['Clinical Assessment', '#predict'],
      ['3D Coronary Anatomy', '#anatomy'],
      ['Explainable AI', '#explain'],
      ['Research Benchmarks', '#evaluation'],
      ['Model Governance', '#model-card'],
    ],
    []
  );

  const activeNav = role === 'doctor' ? doctorNav : patientNav;

  if (portalView === 'gateway') {
    return (
      <EntryPortalPage
        onSelectPatient={() => {
          setRole('patient');
          setPortalView('app');
        }}
        onSelectDoctor={(doc) => {
          setAuthenticatedDoctor(doc);
          setRole('doctor');
          setPortalView('app');
        }}
        onSelectResearchDashboard={() => {
          setRole('doctor');
          setPortalView('app');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-ink antialiased flex flex-col justify-between selection:bg-clinical selection:text-white">
      {/* Top Banner Clinical Safety Disclaimer */}
      <div className="bg-[#050811] px-4 py-2 text-center text-[11px] text-subtext border-b border-dark-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 mx-auto">
            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-bold uppercase tracking-wide text-rose-300 border border-rose-500/30 text-[10px]">
              Safety Disclaimer
            </span>
            <span>
              CardioVision AI is a research and educational prototype. Its predictions are model estimates, not a medical diagnosis, and must not replace professional assessment or formal diagnostic imaging.
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-teal-400 font-mono">
            <span>Track A 2026</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-20 border-b border-dark-border bg-dark-surface/90 backdrop-blur-md shadow-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between">
            <a href="#overview" className="flex items-center gap-3">
              <span className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-2 text-clinical shadow-glow">
                <HeartPulse size={24} aria-hidden="true" />
              </span>
              <div>
                <span className="block text-lg font-black tracking-tight text-ink">CardioVision AI</span>
                <span className="block text-xs text-subtext font-medium">Cardiovascular Risk Visualization & Multimodal Prediction</span>
              </div>
            </a>

            {/* Role indicator badge */}
            <div className="lg:hidden">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                role === 'doctor'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  : 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
              }`}>
                {role === 'doctor' ? <Stethoscope size={12} /> : <UserCheck size={12} />}
                {role === 'doctor' ? 'Doctor Workstation' : 'Patient Portal'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
            {/* Active User Indicator */}
            <div className="hidden lg:flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                role === 'doctor'
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                  : 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
              }`}>
                {role === 'doctor' ? <Stethoscope size={13} /> : <UserCheck size={13} />}
                <span>{role === 'doctor' ? (authenticatedDoctor?.name || 'Verified Clinician') : 'Patient Companion View'}</span>
              </span>
            </div>

            {/* API Connection Indicator */}
            <div className="flex items-center gap-2 rounded-full border border-dark-border bg-dark-card px-2.5 py-1 text-xs">
              <span className={`h-2 w-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : backendConnected === false ? 'bg-rose-500' : 'bg-amber-400'}`} />
              <span className="font-medium text-subtext text-[11px]">
                {backendConnected ? 'API Connected' : backendConnected === false ? 'API Offline' : 'Connecting...'}
              </span>
            </div>

            {/* Navigation links - Strictly scoped by role */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
              {activeNav.map(([label, href]) => (
                <a
                  key={href}
                  className="rounded-lg px-2.5 py-1 text-subtext hover:bg-dark-card hover:text-ink transition"
                  href={href}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* Exit / Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-2.5 py-1.5 text-xs font-semibold text-subtext hover:bg-dark-elevated hover:text-ink transition shadow-card cursor-pointer"
              title={role === 'doctor' ? 'Sign out of Clinician Workstation' : 'Return to Portal Gateway'}
            >
              <LogOut size={13} className="text-rose-400" />
              <span>{role === 'doctor' ? 'Clinician Logout' : 'Exit Portal'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 w-full flex-1">
        {/* Strictly separated main portal view */}
        {role === 'patient' ? (
          <PatientPortalView
            prediction={prediction}
            patientName={patientName}
            assessmentId={activeAssessmentId}
            doctorReview={doctorReview}
            authenticatedPatient={authenticatedPatient}
            onPatientAuthSuccess={(pat) => {
              setAuthenticatedPatient(pat);
              setPatientName(pat.full_name);
            }}
            onPatientLogout={() => {
              setAuthenticatedPatient(null);
              setPatientToken(null);
            }}
            onStartAssessment={() => {
              const el = document.getElementById('predict');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            onExploreHeart={() => {
              const el = document.getElementById('patient-heart-3d') || document.getElementById('anatomy');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            onSelectSavedAssessment={handleSelectSavedPatientAssessment}
          />
        ) : (
          <DoctorWorkstation
            currentAssessmentId={activeAssessmentId}
            onSelectAssessment={handleDoctorSelectAssessment}
            doctor={authenticatedDoctor}
            onLogout={handleLogout}
          />
        )}

        {/* Global Technical Overview Stats */}
        <section id="overview" className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-xl border border-dark-border bg-dark-card p-6 shadow-card flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/10 border border-teal-500/30 px-3 py-1 text-xs font-semibold text-clinical">
                <BrainCircuit size={15} aria-hidden="true" />
                <span>Multimodal Cardiovascular AI Dashboard</span>
              </div>
              <h1 className="mt-3.5 max-w-2xl text-2xl font-black leading-tight text-ink sm:text-3xl">
                Transparent Heart-Disease Risk Inference with 3D Anatomy Exploration.
              </h1>
              <p className="mt-3 text-sm leading-6 text-subtext">
                CardioVision AI unifies clinical predictive modeling on the UCI Heart Disease cohort and Z-Alizadeh Sani extension, mathematical prediction decomposition, empirical calibration curves, and an interactive 3D cardiovascular explorer into a production-grade full-stack architecture.
              </p>
            </div>

            {bootError ? (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                <strong>Notice:</strong> {bootError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-dark-border pt-4 text-xs text-subtext">
              <span className="flex items-center gap-1 font-medium text-ink">
                <CheckCircle2 size={14} className="text-clinical" /> Zero-leakage scikit-learn pipeline
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium text-ink">
                <CheckCircle2 size={14} className="text-clinical" /> Real-time logit decomposition
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium text-ink">
                <CheckCircle2 size={14} className="text-clinical" /> Interactive WebGL anatomy
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <Stat icon={Database} label="Cohort Registry" value={rows} subtext="Patient records evaluated" />
            <Stat icon={HeartPulse} label="Clinical Features" value={featureCount} subtext="Standardized in pipeline" />
            <Stat icon={BrainCircuit} label="Holdout ROC-AUC" value={rocAuc} subtext="Held-out test split" />
            <Stat icon={Activity} label="5-Fold CV ROC-AUC" value={cvAuc} subtext="Stratified train validation" />
          </div>
        </section>

        {/* Clinical Prediction & Form Section */}
        {modelInfo ? (
          <PredictionPanel
            features={modelInfo.features}
            values={values}
            setValues={setValues}
            prediction={prediction}
            setPrediction={setPrediction}
            explanation={explanation}
            setExplanation={setExplanation}
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            patientName={patientName}
            setPatientName={setPatientName}
            onAssessmentSaved={handleAssessmentSaved}
          />
        ) : (
          <div className="rounded-xl border border-dark-border bg-dark-card p-8 text-center text-subtext shadow-card">
            <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-clinical border-t-transparent mb-2" />
            <p className="text-sm font-medium">Loading model schema and clinical parameters...</p>
          </div>
        )}

        {/* 3D Anatomy & XAI Decomposition Side-by-Side */}
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <AnatomyExplorer vesselPredictions={prediction?.vessels} />
          <ExplanationPanel explanation={explanation} />
        </div>

        {/* Rigorous Empirical Evaluation Metrics (Visible to clinicians and researchers) */}
        <EvaluationPanel evaluation={evaluation} />

        {/* Governance & Model Card */}
        <section id="model-card" className="rounded-xl border border-dark-border bg-dark-card p-6 shadow-card space-y-4">
          <div className="border-b border-dark-border pb-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clinical">
              <Info size={14} /> Documentation & Governance
            </div>
            <h2 className="text-xl font-bold text-ink">Model Card & Clinical Governance</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-dark-surface p-4 border border-dark-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">Intended Use</h3>
              <p className="mt-2 text-xs leading-5 text-subtext">
                Educational research prototype illustrating tabular clinical ML, model interpretability, and 3D spatial correlation. It is <strong>not</strong> intended for primary diagnosis, triage, treatment planning, or commercial patient risk scoring.
              </p>
            </div>

            <div className="rounded-xl bg-dark-surface p-4 border border-dark-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">Target & Cohort</h3>
              <p className="mt-2 text-xs leading-5 text-subtext">
                Z-Alizadeh Sani & Cleveland cohorts (N=303). Multi-target outputs predict overall CAD and territory-specific stenosis in the LAD, LCX, and RCA coronary arteries without fluoroscopy leakage.
              </p>
            </div>

            <div className="rounded-xl bg-dark-surface p-4 border border-dark-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">Zero-Leakage Architecture</h3>
              <p className="mt-2 text-xs leading-5 text-subtext">
                Stratified train/test partition before fitting scalers or imputers. Cath, LAD, LCX, and RCA targets are completely excluded from predictive features.
              </p>
            </div>

            <div className="rounded-xl bg-dark-surface p-4 border border-dark-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">Known Limitations</h3>
              <p className="mt-2 text-xs leading-5 text-subtext">
                Small sample size (N=303) and absence of external randomized prospective validation. Feature contributions reflect statistical log-odds and do not establish medical causality.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Dark Themed Footer */}
      <footer className="mt-12 border-t border-dark-border bg-dark-surface py-6 text-center text-xs text-subtext">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 CardioVision AI Project. Built for Multimodal AI Hackathon 2026 — Track A.</p>
          <div className="flex items-center gap-4">
            <a href="#overview" className="hover:text-clinical transition">Overview</a>
            <a href="#predict" className="hover:text-clinical transition">Assessment</a>
            <a href="#anatomy" className="hover:text-clinical transition">3D Anatomy</a>
            <a href="#explain" className="hover:text-clinical transition">Explainability</a>
            <a href="#model-card" className="hover:text-clinical transition">Governance</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
