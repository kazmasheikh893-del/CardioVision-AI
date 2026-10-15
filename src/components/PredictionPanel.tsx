import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  FlaskConical,
  RotateCcw,
  User,
} from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import type { ClinicalInput, Explanation, FeatureDefinition, Prediction } from '../lib/api';
import { api, getDoctorToken, getPatientToken, syntheticExamples } from '../lib/api';
import ReportUploadModal from './ReportUploadModal';

type Props = {
  features: FeatureDefinition[];
  values: ClinicalInput;
  setValues: (values: ClinicalInput) => void;
  prediction: Prediction | null;
  setPrediction: (prediction: Prediction | null) => void;
  explanation: Explanation | null;
  setExplanation: (explanation: Explanation | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  patientName?: string;
  setPatientName?: (name: string) => void;
  onAssessmentSaved?: (id: string) => void;
};

export default function PredictionPanel(props: Props) {
  const [patientName, setPatientName] = useState(props.patientName || 'Anonymous Patient');
  const [reportSource, setReportSource] = useState<string | null>(null);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (feature: FeatureDefinition, event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = event.target.value;
    props.setValues({ ...props.values, [feature.name]: Number(raw) });
  };

  const handleReset = () => {
    props.setValues(syntheticExamples.lower_probability);
    props.setPrediction(null);
    props.setExplanation(null);
    props.setError(null);
    setSaveSuccessId(null);
    setReportSource(null);
  };

  const handleApplyReport = (extracted: Partial<ClinicalInput>, filename: string) => {
    props.setValues({ ...props.values, ...extracted });
    setReportSource(filename);
  };

  const submit = async () => {
    props.setLoading(true);
    props.setError(null);
    setSaveSuccessId(null);
    try {
      const [prediction, explanation] = await Promise.all([
        api.predict(props.values),
        api.explain(props.values),
      ]);
      props.setPrediction(prediction);
      props.setExplanation(explanation);

      // Auto-save to persistent doctor-patient registry if user is authenticated
      if (getDoctorToken() || getPatientToken()) {
        try {
          setSaving(true);
          const res = await api.createAssessment(patientName, props.values, reportSource || 'Manual Entry');
          setSaveSuccessId(res.assessment_id);
          if (props.onAssessmentSaved) {
            props.onAssessmentSaved(res.assessment_id);
          }
        } catch (saveErr) {
          console.warn('Auto-save skipped or not authorized:', saveErr);
        } finally {
          setSaving(false);
        }
      }
    } catch (error) {
      props.setPrediction(null);
      props.setExplanation(null);
      props.setError(error instanceof Error ? error.message : 'Prediction failed. Check backend connection.');
    } finally {
      props.setLoading(false);
      setSaving(false);
    }
  };

  // Group features logically
  const demographicFeatures = props.features.filter((f) => ['age', 'sex'].includes(f.name));
  const vitalsLabFeatures = props.features.filter((f) => ['trestbps', 'chol', 'fbs'].includes(f.name));
  const cardiacTestFeatures = props.features.filter((f) =>
    ['cp', 'restecg', 'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal'].includes(f.name)
  );

  const prob = props.prediction ? Math.round(props.prediction.probability * 100) : 0;
  const isElevated = props.prediction ? props.prediction.prediction === 1 : false;

  return (
    <section id="predict" className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card">
      <div className="flex flex-col gap-3 border-b border-dark-border pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clinical">
            <Activity size={14} /> Clinical Diagnostic Interface
          </div>
          <h2 className="text-xl font-bold text-ink">Clinical Input & Risk Prediction</h2>
          <p className="mt-0.5 text-xs text-subtext">
            Validated against the Cleveland cohort and Z-Alizadeh Sani extension. Zero target leakage guarantees scientific integrity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportUploadModal currentValues={props.values} onApplyExtracted={handleApplyReport} />

          <button
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-xs font-medium text-teal-300 hover:bg-teal-500/20 transition cursor-pointer"
            type="button"
            onClick={() => props.setValues(syntheticExamples.lower_probability)}
          >
            <FlaskConical size={14} aria-hidden="true" />
            Low-risk demo
          </button>
          <button
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
            type="button"
            onClick={() => props.setValues(syntheticExamples.higher_probability)}
          >
            <FlaskConical size={14} aria-hidden="true" />
            High-risk demo
          </button>
          <button
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-surface px-2.5 py-1.5 text-xs font-medium text-subtext hover:bg-dark-elevated hover:text-ink transition cursor-pointer"
            type="button"
            onClick={handleReset}
            title="Reset form"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      {reportSource && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-2 text-xs text-teal-200">
          <span className="flex items-center gap-1.5 font-medium">
            <FileText size={14} className="text-clinical" /> Populated from confirmed report: <strong>{reportSource}</strong>
          </span>
          <button
            type="button"
            onClick={() => setReportSource(null)}
            className="text-[11px] text-teal-400 hover:underline cursor-pointer"
          >
            Clear source badge
          </button>
        </div>
      )}

      <div className="grid gap-6 pt-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          {/* Patient Details */}
          <div className="flex items-center gap-3 rounded-xl border border-dark-border bg-dark-surface p-3">
            <User size={16} className="text-teal-400" />
            <div className="flex-1">
              <label htmlFor="patient-name-input" className="block text-[11px] font-semibold uppercase text-subtext">
                Patient Identifier / Name (Optional for Registry)
              </label>
              <input
                id="patient-name-input"
                type="text"
                value={patientName}
                onChange={(e) => {
                  setPatientName(e.target.value);
                  if (props.setPatientName) props.setPatientName(e.target.value);
                }}
                placeholder="e.g. Patient #4029"
                className="mt-0.5 w-full rounded-lg border border-dark-border bg-dark-card px-2.5 py-1 text-xs text-ink placeholder-subtext/60 focus:border-clinical focus:outline-none"
              />
            </div>
          </div>

          {/* Group 1: Demographics & History */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">
              1. Demographics & Patient Background
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {demographicFeatures.map((feature) => (
                <FeatureField
                  key={feature.name}
                  feature={feature}
                  value={props.values[feature.name]}
                  onChange={update}
                />
              ))}
            </div>
          </div>

          {/* Group 2: Baseline Vitals & Labs */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">
              2. Baseline Vitals & Blood Chemistry
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {vitalsLabFeatures.map((feature) => (
                <FeatureField
                  key={feature.name}
                  feature={feature}
                  value={props.values[feature.name]}
                  onChange={update}
                />
              ))}
            </div>
          </div>

          {/* Group 3: Cardiac Stress & Diagnostics */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">
              3. Exercise Testing & Cardiac Diagnostics
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cardiacTestFeatures.map((feature) => (
                <FeatureField
                  key={feature.name}
                  feature={feature}
                  value={props.values[feature.name]}
                  onChange={update}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Prediction Execution & Summary Card */}
        <div className="space-y-4">
          <button
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clinical px-4 py-3.5 font-bold text-white shadow-glow hover:bg-clinical-hover transition cursor-pointer disabled:cursor-wait disabled:opacity-60"
            type="button"
            onClick={submit}
            disabled={props.loading || saving}
          >
            <Activity size={18} aria-hidden="true" className={props.loading ? 'animate-spin' : ''} />
            {props.loading ? 'Computing Pipeline Prediction...' : 'Evaluate Patient Risk Profile'}
          </button>

          {saveSuccessId && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-clinical" />
                Assessment persisted to Clinical Registry: <strong>{saveSuccessId}</strong>
              </span>
            </div>
          )}

          {props.error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs leading-5 text-rose-200 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{props.error}</span>
            </div>
          ) : null}

          <div className="rounded-xl border border-dark-border bg-dark-surface p-5 space-y-4 shadow-card">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">Model Inference Output</h3>
              <span className="text-[11px] font-medium text-subtext">Decision Threshold: 50.0%</span>
            </div>

            {props.prediction ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-subtext uppercase tracking-wide">Predicted Probability</span>
                    <div className={`text-4xl font-extrabold tracking-tight ${isElevated ? 'text-vessel' : 'text-clinical'}`}>
                      {prob}%
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                        isElevated
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                      }`}
                    >
                      {isElevated ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                      {props.prediction.label}
                    </span>
                  </div>
                </div>

                {/* Visual Probability Meter */}
                <div className="space-y-1">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-dark-bg border border-dark-border">
                    <div
                      className={`h-full transition-all duration-500 ${isElevated ? 'bg-vessel' : 'bg-clinical'}`}
                      style={{ width: `${Math.min(100, Math.max(2, prob))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-subtext">
                    <span>0% (Absence)</span>
                    <span className="font-semibold text-ink">Decision boundary: 50%</span>
                    <span>100% (Presence)</span>
                  </div>
                </div>

                {/* Vessel-Specific Stenosis Breakdown */}
                {props.prediction.vessels && Object.keys(props.prediction.vessels).length > 0 && (
                  <div className="rounded-xl border border-dark-border bg-dark-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">Coronary Vessel Stenosis Likelihood</span>
                      <span className="text-[10px] font-medium text-clinical">Track A Multi-Target</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(props.prediction.vessels).map(([key, v]) => {
                        const isHigh = v.probability >= 0.7;
                        const isMod = v.probability >= 0.3 && v.probability < 0.7;
                        return (
                          <div
                            key={key}
                            className={`rounded-lg p-2 border text-center ${
                              isHigh
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                : isMod
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                            }`}
                          >
                            <span className="text-[11px] font-bold block">{v.vessel}</span>
                            <span className="text-sm font-mono font-extrabold block">
                              {(v.probability * 100).toFixed(1)}%
                            </span>
                            <span className="text-[9px] uppercase font-semibold opacity-80 block mt-0.5">
                              {v.risk_level.split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-subtext leading-3.5">
                      Separate vessel stenosis probabilities for LAD (anterior), RCA (inferior), and LCX (lateral) derived from physiological territory mapping with zero target leakage.
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-dark-border bg-dark-card p-3 text-xs text-subtext space-y-1">
                  <p className="font-semibold text-ink">Target Definition:</p>
                  <p className="leading-5">{props.prediction.target_definition}</p>
                </div>

                <div className="text-[11px] leading-4 text-subtext/80">
                  {props.prediction.limitations[0]}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-subtext">
                <Activity size={32} className="mx-auto text-dark-muted mb-2" />
                <p className="text-sm font-semibold text-ink">No Assessment Generated</p>
                <p className="mt-1 text-xs text-subtext max-w-xs mx-auto">
                  Click 'Evaluate Patient Risk Profile' or load one of the synthetic reference profiles above.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureField({
  feature,
  value,
  onChange,
}: {
  feature: FeatureDefinition;
  value: number;
  onChange: (f: FeatureDefinition, e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) {
  return (
    <label className="flex flex-col justify-between rounded-xl border border-dark-border bg-dark-surface p-2.5 shadow-card hover:border-dark-muted transition text-xs">
      <div className="flex items-center justify-between font-semibold text-ink">
        <span>{feature.label}</span>
        {feature.unit ? <span className="text-[10px] text-teal-400 font-mono">{feature.unit}</span> : null}
      </div>

      <div className="my-1.5">
        {feature.type === 'categorical' ? (
          <select
            className="focus-ring w-full rounded-lg border border-dark-border bg-dark-card px-2.5 py-1.5 text-xs text-ink focus:border-clinical"
            value={value}
            onChange={(e) => onChange(feature, e)}
          >
            {feature.options?.map((option) => (
              <option key={option.value} value={option.value} className="bg-dark-card text-ink">
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="focus-ring w-full rounded-lg border border-dark-border bg-dark-card px-2.5 py-1.5 text-xs font-mono text-ink focus:border-clinical"
            type="number"
            min={feature.min}
            max={feature.max}
            step={feature.step ?? 1}
            value={value}
            onChange={(e) => onChange(feature, e)}
          />
        )}
      </div>

      <span className="text-[10px] leading-3.5 text-subtext">{feature.description}</span>
    </label>
  );
}
