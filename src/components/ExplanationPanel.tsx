import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Layers, Sparkles, Info } from 'lucide-react';
import type { Explanation } from '../lib/api';

const FEATURE_LABELS: Record<string, string> = {
  ca: 'Major vessels colored (ca)',
  cp: 'Chest pain type (cp)',
  thal: 'Thalassemia stress (thal)',
  sex: 'Biological sex (sex)',
  slope: 'ST slope (slope)',
  thalach: 'Max heart rate (thalach)',
  trestbps: 'Resting BP (trestbps)',
  exang: 'Exercise angina (exang)',
  chol: 'Serum cholesterol (chol)',
  oldpeak: 'ST depression (oldpeak)',
  restecg: 'Resting ECG (restecg)',
  fbs: 'Fasting blood sugar (fbs)',
  age: 'Patient age (age)',
};

export default function ExplanationPanel({ explanation }: { explanation: Explanation | null }) {
  const [viewMode, setViewMode] = useState<'local' | 'global' | 'math'>('local');

  const localData = explanation?.contributions.map((item) => ({
    feature: FEATURE_LABELS[item.feature] || item.feature,
    rawFeature: item.feature,
    contribution: item.contribution,
    direction: item.direction,
    absolute: item.absolute,
  }));

  const globalData = explanation?.global_importance?.map((item) => ({
    feature: FEATURE_LABELS[item.feature] || item.feature,
    rawFeature: item.feature,
    importance: item.importance,
  }));

  return (
    <section id="explain" className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card flex flex-col justify-between">
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-dark-border pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clinical">
              <Sparkles size={14} /> Explainable Medical ML
            </div>
            <h2 className="text-xl font-bold text-ink">Prediction Explanation & Importance</h2>
          </div>
          <div className="inline-flex rounded-lg border border-dark-border bg-dark-surface p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('local')}
              className={`rounded-md px-2.5 py-1.5 transition cursor-pointer ${
                viewMode === 'local' ? 'bg-dark-card text-ink shadow-card font-bold' : 'text-subtext hover:text-ink'
              }`}
            >
              Current Input
            </button>
            <button
              type="button"
              onClick={() => setViewMode('global')}
              className={`rounded-md px-2.5 py-1.5 transition cursor-pointer ${
                viewMode === 'global' ? 'bg-dark-card text-ink shadow-card font-bold' : 'text-subtext hover:text-ink'
              }`}
            >
              Global Model Weights
            </button>
            <button
              type="button"
              onClick={() => setViewMode('math')}
              className={`rounded-md px-2.5 py-1.5 transition cursor-pointer ${
                viewMode === 'math' ? 'bg-dark-card text-ink shadow-card font-bold' : 'text-subtext hover:text-ink'
              }`}
            >
              Log-Odds Audit
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm text-subtext">
          {viewMode === 'local' && 'Computed log-odds contributions (β × x) decomposed for this specific clinical profile.'}
          {viewMode === 'global' && 'Mean absolute coefficient magnitudes across the full trained model parameters.'}
          {viewMode === 'math' && 'Exact mathematical verification connecting transformed variables to logistic logit output.'}
        </p>

        {explanation ? (
          viewMode === 'local' ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-subtext">
                <span className="flex items-center gap-1.5 text-rose-400 font-semibold">■ Coral: Increases risk score (+β)</span>
                <span className="flex items-center gap-1.5 text-sky-400 font-semibold">■ Cyan: Decreases risk score (-β)</span>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={localData} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1E2F4A" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis dataKey="feature" type="category" width={175} tick={{ fontSize: 11, fill: '#f8fafc' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0D1524', borderColor: '#1E2F4A', borderRadius: '8px', color: '#f8fafc' }}
                      formatter={(val) => [`${Number(val).toFixed(4)} contribution (log-odds)`, 'Impact']}
                      labelFormatter={(label) => `Feature: ${label}`}
                    />
                    <Bar dataKey="contribution" radius={4}>
                      {localData?.map((entry) => (
                        <Cell key={entry.rawFeature} fill={entry.contribution >= 0 ? '#f43f5e' : '#38bdf8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : viewMode === 'global' ? (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-subtext">
                Global feature influence ranked by average absolute weight across all levels.
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={globalData} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1E2F4A" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 'auto']} />
                    <YAxis dataKey="feature" type="category" width={175} tick={{ fontSize: 11, fill: '#f8fafc' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0D1524', borderColor: '#1E2F4A', borderRadius: '8px', color: '#f8fafc' }}
                      formatter={(val) => [`${Number(val).toFixed(4)} (mean |weight|)`, 'Importance']}
                      labelFormatter={(label) => `Feature: ${label}`}
                    />
                    <Bar dataKey="importance" fill="#14b8a6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-dark-border bg-dark-surface p-2.5">
                  <span className="block text-xs uppercase text-subtext">Model Intercept (β₀)</span>
                  <span className="text-base font-bold text-ink">{explanation.intercept.toFixed(4)}</span>
                </div>
                <div className="rounded-xl border border-dark-border bg-dark-surface p-2.5">
                  <span className="block text-xs uppercase text-subtext">Total Logit (z)</span>
                  <span className="text-base font-bold text-ink">{explanation.logit.toFixed(4)}</span>
                </div>
                <div className="rounded-xl border border-dark-border bg-dark-surface p-2.5">
                  <span className="block text-xs uppercase text-subtext">Sigmoid P(y=1)</span>
                  <span className="text-base font-bold text-rose-400 font-mono">{(explanation.probability * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-xl border border-dark-border text-xs">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-dark-surface text-ink font-semibold border-b border-dark-border">
                    <tr>
                      <th className="py-2 px-3">Transformed Variable</th>
                      <th className="py-2 px-2 text-right">Value (x)</th>
                      <th className="py-2 px-2 text-right">Weight (β)</th>
                      <th className="py-2 px-3 text-right">Product (β × x)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border bg-dark-card">
                    {explanation.detailed_contributions?.map((d, i) => (
                      <tr key={i} className="hover:bg-dark-elevated font-mono">
                        <td className="py-1.5 px-3 font-sans text-ink">{d.transformed_feature}</td>
                        <td className="py-1.5 px-2 text-right text-subtext">{d.value.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right text-subtext">{d.coefficient.toFixed(3)}</td>
                        <td className={`py-1.5 px-3 text-right font-bold ${d.contribution >= 0 ? 'text-rose-400' : 'text-sky-400'}`}>
                          {d.contribution >= 0 ? `+${d.contribution.toFixed(4)}` : d.contribution.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="mt-4 flex h-80 flex-col items-center justify-center rounded-xl border border-dashed border-dark-border p-6 text-center text-subtext">
            <Layers className="h-10 w-10 text-dark-muted mb-2" />
            <p className="text-sm font-semibold text-ink">Awaiting Clinical Prediction</p>
            <p className="text-xs text-subtext mt-1 max-w-sm">
              Submit the clinical input form or load a synthetic demonstration profile above to calculate the mathematical feature contribution breakdown.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-dark-border bg-dark-surface p-3 text-xs leading-5 text-subtext flex items-start gap-2">
        <Info className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
        <span>
          <strong>Methodological note:</strong> {explanation?.caution ?? 'Feature contributions describe how this model calculated this specific score. They represent statistical associations within this dataset, not causal etiology.'}
        </span>
      </div>
    </section>
  );
}
