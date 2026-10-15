import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
} from 'lucide-react';
import { api, type ClinicalInput, type ReportUploadResult } from '../lib/api';

type Props = {
  currentValues: ClinicalInput;
  onApplyExtracted: (confirmedValues: Partial<ClinicalInput>, reportFilename: string) => void;
};

export default function ReportUploadModal({ onApplyExtracted }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<ReportUploadResult | null>(null);
  const [confirmedValues, setConfirmedValues] = useState<Partial<ClinicalInput>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    if (!selectedFile.name.match(/\.(pdf|png|jpe?g)$/i)) {
      setError('Unsupported file type. Please upload a PDF document or JPG/PNG medical image.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit.');
      return;
    }
    setFile(selectedFile);
    setUploadResult(null);
    setConfirmedValues({});
  };

  const handleUploadAndProcess = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadReport(file);
      setUploadResult(result);
      setConfirmedValues({ ...result.extracted_values });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse report.');
    } finally {
      setUploading(false);
    }
  };

  const handleApply = () => {
    if (uploadResult && file) {
      onApplyExtracted(confirmedValues, file.name);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-300 hover:bg-teal-500/20 transition shadow-card cursor-pointer"
      >
        <Upload size={14} /> Upload Medical Report (PDF / Image)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-dark-border bg-dark-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-subtext hover:bg-dark-surface hover:text-ink transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="border-b border-dark-border pb-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clinical">
                <FileText size={14} /> Document Parsing & OCR Pipeline
              </div>
              <h3 className="text-lg font-bold text-ink">Upload Clinical ECG / Lab Report</h3>
              <p className="mt-0.5 text-xs text-subtext">
                Extract compatible parameters (BP, Chol, Glucose, Max HR) for your manual review and confirmation.
              </p>
            </div>

            {/* Upload Area */}
            {!uploadResult ? (
              <div className="mt-5 space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-dark-border bg-dark-surface p-8 text-center hover:border-clinical hover:bg-dark-elevated cursor-pointer transition"
                >
                  <Upload size={36} className="text-teal-400 mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-ink">
                    {file ? file.name : 'Drag & drop your medical PDF or scanned lab image here'}
                  </p>
                  <p className="mt-1 text-xs text-subtext">PDF, JPG, JPEG, or PNG up to 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="rounded-xl border border-dark-border bg-dark-surface p-3 text-[11px] text-subtext flex items-start gap-2">
                  <ShieldCheck size={16} className="shrink-0 text-clinical mt-0.5" />
                  <span>
                    <strong>Privacy Contract:</strong> Uploaded documents are parsed locally in temporary system memory for parameter extraction. Extracted values are marked unconfirmed until verified by the user.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg border border-dark-border px-4 py-2 text-xs font-semibold text-subtext hover:bg-dark-surface hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!file || uploading}
                    onClick={handleUploadAndProcess}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-clinical px-4 py-2 text-xs font-bold text-white hover:bg-clinical-hover disabled:opacity-50 transition cursor-pointer"
                  >
                    {uploading && <RefreshCw size={13} className="animate-spin" />}
                    {uploading ? 'Processing Extraction...' : 'Extract Clinical Values'}
                  </button>
                </div>
              </div>
            ) : (
              /* Review & User Confirmation Contract */
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3.5 text-xs text-teal-200 flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-clinical mt-0.5" />
                  <div>
                    <p className="font-semibold">{uploadResult.notice}</p>
                    <p className="mt-1 text-[11px] text-subtext">
                      File: <strong>{uploadResult.filename}</strong> ({(uploadResult.file_size / 1024).toFixed(1)} KB)
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2">
                    Extracted Values Found in Document (Unconfirmed — Review & Edit)
                  </h4>
                  {Object.keys(confirmedValues).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(confirmedValues).map(([key, val]) => (
                        <div key={key} className="rounded-xl border border-dark-border bg-dark-surface p-2.5">
                          <span className="block text-[11px] font-semibold uppercase text-subtext">{key}</span>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) =>
                              setConfirmedValues({ ...confirmedValues, [key]: Number(e.target.value) })
                            }
                            className="mt-1 w-full rounded-lg border border-dark-border bg-dark-card px-2 py-1 text-xs font-mono font-bold text-ink focus:border-clinical focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-subtext bg-dark-surface p-3 rounded-xl border border-dark-border">
                      No matching numeric markers were found automatically. Please enter values manually into the assessment form.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-dark-border bg-dark-surface p-3">
                  <span className="block text-[11px] font-semibold uppercase text-subtext mb-1">
                    Raw Document Snippet Preview
                  </span>
                  <pre className="max-h-28 overflow-y-auto font-mono text-[11px] text-subtext whitespace-pre-wrap">
                    {uploadResult.raw_text_preview}
                  </pre>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-dark-border">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadResult(null);
                      setFile(null);
                    }}
                    className="text-xs text-teal-400 hover:underline font-medium cursor-pointer"
                  >
                    ← Upload different file
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded-lg border border-dark-border px-4 py-2 text-xs font-semibold text-subtext hover:bg-dark-surface hover:text-ink cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="rounded-lg bg-clinical px-4 py-2 text-xs font-bold text-white hover:bg-clinical-hover transition cursor-pointer"
                    >
                      Confirm & Populate Form
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
