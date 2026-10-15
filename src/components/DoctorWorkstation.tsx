import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type Assessment, type DoctorProfile } from '../lib/api';

type Props = {
  currentAssessmentId?: string | null;
  onSelectAssessment?: (assessment: Assessment) => void;
  doctor?: DoctorProfile | null;
  onLogout?: () => void;
};

export default function DoctorWorkstation({
  currentAssessmentId,
  onSelectAssessment,
  doctor,
  onLogout,
}: Props) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentAssessmentId || null);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [doctorName, setDoctorName] = useState(doctor?.name || 'Dr. Sarah Chen, MD');
  const [doctorTitle, setDoctorTitle] = useState(doctor?.title || 'Senior Interventional Cardiologist');
  const [summary, setSummary] = useState('');
  const [advice, setAdvice] = useState('');
  const [followUp, setFollowUp] = useState('Annual cardiovascular wellness follow-up');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email Notification States
  const [patientEmail, setPatientEmail] = useState('');
  const [patientConsent, setPatientConsent] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const data = await api.listAssessments();
      setAssessments(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [currentAssessmentId]);

  useEffect(() => {
    if (selectedId) {
      api.getAssessment(selectedId)
        .then((ass) => {
          setSelectedAssessment(ass);
          if (ass.review) {
            setDoctorName(ass.review.doctor_name);
            setDoctorTitle(ass.review.doctor_title);
            setSummary(ass.review.summary);
            setAdvice(ass.review.advice);
            setFollowUp(ass.review.follow_up);
          } else {
            const isHigh = ass.prediction.prediction === 1;
            setSummary(
              isHigh
                ? `Patient exhibits elevated probability (${Math.round(ass.prediction.probability * 100)}%) of significant coronary narrowing based on Cleveland & Z-Alizadeh features.`
                : `Patient profile aligns with low probability (${Math.round(ass.prediction.probability * 100)}%) of significant coronary stenosis.`
            );
            setAdvice(
              isHigh
                ? 'Recommend confirmatory stress echocardiography or CT coronary angiography. Optimize blood pressure and lipid targets.'
                : 'Recommend routine primary prevention: regular physical activity, balanced Mediterranean diet, and annual monitoring.'
            );
            setFollowUp(isHigh ? '3 to 6 months cardiology clinic follow-up' : '12 months routine wellness check');
          }
        })
        .catch((err) => console.error('Failed to get assessment detail:', err));

      api.getNotifications(selectedId)
        .then((notifs) => setNotificationsList(notifs))
        .catch(() => setNotificationsList([]));
    }
  }, [selectedId]);

  const handleSubmitReview = async () => {
    if (!selectedId) return;
    setSavingReview(true);
    setFeedbackMsg(null);
    try {
      const newReview = await api.addReview(selectedId, {
        doctor_name: doctorName,
        doctor_title: doctorTitle,
        summary,
        advice,
        follow_up: followUp,
        status: 'Reviewed & Approved',
      });
      setFeedbackMsg({ type: 'success', text: `Clinical review successfully saved and verified for ${selectedId}!` });
      if (selectedAssessment) {
        setSelectedAssessment({ ...selectedAssessment, review: newReview as any });
      }
      fetchAssessments();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save review.' });
    } finally {
      setSavingReview(false);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedId || !patientEmail) return;
    setSendingEmail(true);
    setEmailStatusMsg(null);
    try {
      const res = await api.notifyPatient(selectedId, {
        recipient_email: patientEmail,
        patient_consent: patientConsent,
        patient_name: selectedAssessment?.patient_name || 'Patient',
      });
      setEmailStatusMsg({
        type: 'success',
        text: `Patient notification dispatched (${res.status} via ${res.provider})!`,
      });
      api.getNotifications(selectedId).then((notifs) => setNotificationsList(notifs));
    } catch (err) {
      setEmailStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send notification email.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <section id="doctor-workstation" className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-dark-border pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clinical">
            <Stethoscope size={14} /> Clinical Decision Support & Governance
          </div>
          <h2 className="text-xl font-bold text-ink">Doctor Workstation — Clinical Review Registry</h2>
          <p className="mt-0.5 text-xs text-subtext">
            Review patient assessments, analyze raw tabular inputs alongside predictions, and author verified clinical advice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doctor && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300">
              <ShieldCheck size={14} className="text-blue-400" />
              <div>
                <span className="font-bold block leading-tight">{doctor.name}</span>
                <span className="text-[10px] text-blue-400 block">{doctor.title}</span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={fetchAssessments}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-semibold text-subtext hover:bg-dark-elevated hover:text-ink transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Queue
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
              title="Sign out of doctor workstation"
            >
              <LogOut size={13} /> Sign Out
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Patient Assessment Registry List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-subtext">
            <span>Assessment Queue ({assessments.length})</span>
          </div>

          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {assessments.length === 0 ? (
              <div className="p-6 text-center text-xs text-subtext border border-dashed border-dark-border rounded-xl">
                No saved assessments yet. Run a prediction in the assessment panel to register patients.
              </div>
            ) : (
              assessments.map((a) => {
                const isSelected = a.id === selectedId;
                const isElevated = a.prediction.prediction === 1;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(a.id);
                      if (onSelectAssessment) onSelectAssessment(a);
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-clinical bg-teal-500/10 shadow-glow'
                        : 'border-dark-border bg-dark-surface hover:border-dark-muted hover:bg-dark-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-ink">{a.id}</span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                          isElevated
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                        }`}
                      >
                        {Math.round(a.prediction.probability * 100)}% Risk
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-subtext">
                      <span className="font-medium text-ink truncate max-w-[170px]">{a.patient_name}</span>
                      <span className="text-[10px] text-subtext/70">
                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                      {a.is_reviewed ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 size={11} /> Reviewed by {a.doctor_name || 'MD'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 font-medium">
                          <Clock size={11} /> Pending Review
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Patient Details & Clinician Review Form */}
        {selectedAssessment ? (
          <div className="space-y-5 rounded-xl border border-dark-border bg-dark-surface p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-dark-border pb-3">
              <div>
                <span className="text-[11px] font-mono text-teal-400">Assessment: {selectedAssessment.id}</span>
                <h3 className="text-lg font-bold text-ink">{selectedAssessment.patient_name}</h3>
                <span className="text-xs text-subtext">Source: {selectedAssessment.report_source || 'Manual Entry'}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-subtext uppercase block">Model Inference</span>
                <span
                  className={`text-xl font-bold font-mono ${
                    selectedAssessment.prediction.prediction === 1 ? 'text-rose-400' : 'text-teal-400'
                  }`}
                >
                  {Math.round(selectedAssessment.prediction.probability * 100)}% ({selectedAssessment.prediction.label})
                </span>
              </div>
            </div>

            {/* Raw Input Variables Grid */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-subtext mb-2">
                Patient Baseline Clinical Parameters (13 Features)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                {Object.entries(selectedAssessment.inputs).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-dark-border bg-dark-card p-2">
                    <span className="block text-[10px] text-subtext uppercase font-medium">{k}</span>
                    <span className="font-mono font-bold text-ink">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Authoring / Existing Clinician Advice */}
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-dark-border pb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-clinical flex items-center gap-1.5">
                  <MessageSquare size={14} /> Clinician Assessment & Advice Form
                </h4>
                {selectedAssessment.review && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                    Saved on {new Date(selectedAssessment.review.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {feedbackMsg && (
                <div
                  className={`rounded-xl p-3 text-xs flex items-center gap-2 ${
                    feedbackMsg.type === 'success'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {feedbackMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="doctor-name-input" className="block text-[11px] font-medium text-subtext">Reviewing Physician Name</label>
                  <input
                    id="doctor-name-input"
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-dark-border bg-dark-surface px-2.5 py-1.5 text-xs text-ink focus:border-clinical"
                  />
                </div>
                <div>
                  <label htmlFor="doctor-title-input" className="block text-[11px] font-medium text-subtext">Physician Title / Specialization</label>
                  <input
                    id="doctor-title-input"
                    type="text"
                    value={doctorTitle}
                    onChange={(e) => setDoctorTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-dark-border bg-dark-surface px-2.5 py-1.5 text-xs text-ink focus:border-clinical"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="clinical-findings-summary" className="block text-[11px] font-medium text-subtext">Clinical Findings Summary</label>
                <textarea
                  id="clinical-findings-summary"
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-dark-border bg-dark-surface p-2 text-xs text-ink leading-5 focus:border-clinical"
                  placeholder="Summarize model output in clinical context..."
                />
              </div>

              <div>
                <label htmlFor="patient-facing-advice" className="block text-[11px] font-medium text-subtext">
                  Patient-Facing Advice & Recommendations (Visible in Patient Portal)
                </label>
                <textarea
                  id="patient-facing-advice"
                  rows={3}
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-dark-border bg-dark-surface p-2 text-xs text-ink leading-5 focus:border-clinical"
                  placeholder="Plain-English lifestyle, diagnostic, or therapeutic next steps..."
                />
              </div>

              <div>
                <label htmlFor="followup-interval" className="block text-[11px] font-medium text-subtext">Follow-up Interval</label>
                <input
                  id="followup-interval"
                  type="text"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-dark-border bg-dark-surface px-2.5 py-1.5 text-xs text-ink focus:border-clinical"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={savingReview || !summary || !advice}
                  onClick={handleSubmitReview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-clinical px-4 py-2 text-xs font-bold text-white hover:bg-clinical-hover disabled:opacity-50 transition cursor-pointer"
                >
                  {savingReview && <RefreshCw size={13} className="animate-spin" />}
                  {savingReview ? 'Persisting Clinical Review...' : 'Save & Publish Clinician Advice'}
                </button>
              </div>
            </div>

            {/* Email Notification Dispatch Section */}
            <div className="rounded-xl border border-dark-border bg-dark-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-dark-border pb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-clinical flex items-center gap-1.5">
                  <Mail size={14} /> Patient Email Notification (Privacy-Preserving)
                </h4>
                <span className="text-[10px] text-subtext">HIPAA & GDPR Friendly</span>
              </div>

              <p className="text-xs text-subtext leading-5">
                Send an alert directing the patient to the secure CardioVision AI portal to review their physician recommendations. Medical parameters and diagnostic scores are excluded from the email body.
              </p>

              {emailStatusMsg && (
                <div
                  className={`rounded-xl p-3 text-xs flex items-center gap-2 ${
                    emailStatusMsg.type === 'success'
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {emailStatusMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{emailStatusMsg.text}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="flex-1 rounded-lg border border-dark-border bg-dark-surface px-3 py-1.5 text-xs text-ink placeholder-subtext/60 focus:border-clinical"
                />
                <label className="flex items-center gap-2 text-xs text-subtext select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={patientConsent}
                    onChange={(e) => setPatientConsent(e.target.checked)}
                    className="rounded border-dark-border text-clinical"
                  />
                  <span>Patient Consent Obtained</span>
                </label>
                <button
                  type="button"
                  disabled={sendingEmail || !patientEmail || !patientConsent}
                  onClick={handleSendNotification}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/20 px-3.5 py-1.5 text-xs font-bold text-teal-300 hover:bg-teal-500/30 disabled:opacity-50 transition cursor-pointer"
                >
                  <Send size={13} className={sendingEmail ? 'animate-spin' : ''} />
                  <span>{sendingEmail ? 'Dispatching...' : 'Send Portal Notification'}</span>
                </button>
              </div>

              {notificationsList.length > 0 && (
                <div className="mt-2 text-[11px] text-subtext">
                  <span className="font-semibold text-ink">Dispatch History: </span>
                  {notificationsList.map((n, i) => (
                    <span key={i} className="inline-block mr-2 text-[10px] bg-dark-surface px-2 py-0.5 rounded border border-dark-border">
                      {n.recipient_email} • {n.status} ({new Date(n.sent_at).toLocaleTimeString()})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-dark-border p-6 text-center text-subtext">
            <Stethoscope size={36} className="text-dark-muted mb-2" />
            <p className="text-sm font-semibold text-ink">Select an assessment to review</p>
            <p className="text-xs text-subtext mt-1">
              Choose a patient assessment from the left queue to inspect variables and author advice.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
