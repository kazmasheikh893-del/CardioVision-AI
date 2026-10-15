import {
  Activity,
  Heart,
  Info,
} from 'lucide-react';
import { useState } from 'react';
import type { VesselRiskInfo } from '../lib/api';
import type { StructureKey } from '../lib/heartAnatomy';
import CoronaryHeartViewer from './heart/CoronaryHeartViewer';

interface AnatomicalStructure {
  id: string;
  name: string;
  category: 'Myocardium' | 'Coronary' | 'Vessels';
  structureKey?: StructureKey;
  description: string;
  clinicalSignificance: string;
  territory?: string;
  vesselKey?: 'lad' | 'lcx' | 'rca';
}

const structures: AnatomicalStructure[] = [
  {
    id: 'lad_artery',
    name: 'LAD (Left Anterior Descending)',
    category: 'Coronary',
    structureKey: 'lad',
    vesselKey: 'lad',
    description:
      'Travels down the anterior interventricular sulcus supplying ~50% of the left ventricular myocardium, including apex and anterior septum.',
    clinicalSignificance:
      'Critical vessel ("widowmaker"). Stenosis correlates with anterior ST depression (oldpeak), flat/downsloping ST slope, and regional anterior wall motion abnormalities.',
    territory: 'Anterior LV wall, cardiac apex, anterior 2/3 of interventricular septum',
  },
  {
    id: 'rca_artery',
    name: 'RCA (Right Coronary Artery)',
    category: 'Coronary',
    structureKey: 'rca',
    vesselKey: 'rca',
    description:
      'Courses along the right atrioventricular groove supplying the right ventricle, inferior LV wall, and cardiac conduction nodes (SA & AV).',
    clinicalSignificance:
      'Inferior wall ischemia correlates with exercise-induced angina, inferior ST changes, fixed perfusion defects, and bradyarrhythmias.',
    territory: 'Right ventricle, inferior diaphragmatic LV wall, SA & AV nodes',
  },
  {
    id: 'lcx_artery',
    name: 'LCX (Left Circumflex Artery)',
    category: 'Coronary',
    structureKey: 'lcx',
    vesselKey: 'lcx',
    description:
      'Curves posteriorly around the coronary sulcus, supplying the posterolateral wall of the left ventricle and left atrium.',
    clinicalSignificance:
      'Lateral ischemia correlates with reversible thallium perfusion defects, posterior wall motion changes, and multi-vessel disease in elevated lipids.',
    territory: 'Posterolateral LV wall, left atrium, anterolateral papillary muscle',
  },
  {
    id: 'myocardium',
    name: 'Myocardium & Ventricles',
    category: 'Myocardium',
    structureKey: 'chambers',
    description:
      'The muscular walls of the heart. The left ventricle generates systemic arterial pressure, while the right ventricle directs flow to the pulmonary circulation.',
    clinicalSignificance:
      'Ischemic burden causes regional wall motion abnormalities (RWMA) and ST-segment depression under metabolic stress.',
    territory: 'Global biventricular myocardium',
  },
  {
    id: 'great_vessels',
    name: 'Ascending Aorta & Pulmonary Trunk',
    category: 'Vessels',
    structureKey: 'great_vessels',
    description:
      'Ascending aorta distributes oxygenated blood from the LV; pulmonary trunk directs deoxygenated blood to the lungs.',
    clinicalSignificance:
      'Aortic compliance and systemic vascular resistance determine systolic blood pressure (BP) and cardiac afterload.',
    territory: 'Systemic and pulmonary outflow tracts',
  },
];

export default function AnatomyExplorer({
  vesselPredictions,
}: {
  vesselPredictions?: Record<string, VesselRiskInfo>;
}) {
  const [selectedStructure, setSelectedStructure] = useState<AnatomicalStructure>(structures[0]);
  const [selectedKey, setSelectedKey] = useState<StructureKey | null>('lad');

  const handleSelectStructure = (structure: AnatomicalStructure) => {
    setSelectedStructure(structure);
    setSelectedKey(structure.structureKey ?? null);
  };

  const handleViewerSelect = (key: StructureKey | null) => {
    setSelectedKey(key);
    if (key) {
      const match = structures.find((s) => s.structureKey === key);
      if (match) setSelectedStructure(match);
    }
  };

  return (
    <section id="anatomy" className="rounded-xl border border-dark-border bg-dark-card p-5 shadow-card space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-dark-border pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-clinical">
            <Heart size={14} className="text-rose-400" /> Human Reference Atlas v1.3
          </div>
          <h2 className="text-xl font-bold text-ink">3D Coronary Anatomy & Spatial Correlation</h2>
          <p className="mt-0.5 text-xs text-subtext">
            Dynamic 3D model mapping predicted stenosis probabilities to coronary branches and myocardial territories.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="rounded-full bg-teal-500/10 text-teal-300 text-xs font-semibold px-2.5 py-1 border border-teal-500/30">
            Visible Human Female
          </span>
        </div>
      </div>

      {/* Main 3D Canvas + Side Reference */}
      <div className="grid gap-4 lg:grid-cols-[1fr_310px]">
        {/* Left 3D Viewer */}
        <div className="rounded-xl border border-dark-border bg-dark-bg p-3 shadow-card">
          <CoronaryHeartViewer
            vessels={vesselPredictions}
            variant="clinician"
            selected={selectedKey}
            onSelect={handleViewerSelect}
            heightClass="h-[460px]"
          />
        </div>

        {/* Right Reference Panel */}
        <div className="flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-subtext">
              Select Anatomy to Inspect
            </div>
            <div className="grid gap-1.5">
              {structures.map((structure) => {
                const isSelected = selectedStructure.id === structure.id;
                const vInfo = structure.vesselKey ? vesselPredictions?.[structure.vesselKey] : null;

                return (
                  <button
                    key={structure.id}
                    className={`focus-ring rounded-lg border px-3 py-2 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? 'border-clinical bg-teal-500/10 text-clinical font-bold shadow-glow'
                        : 'border-dark-border bg-dark-surface text-subtext hover:border-dark-muted hover:bg-dark-card hover:text-ink'
                    }`}
                    onClick={() => handleSelectStructure(structure)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{structure.name}</span>
                      {vInfo ? (
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            vInfo.probability >= 0.7
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : vInfo.probability >= 0.3
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                          }`}
                        >
                          {(vInfo.probability * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-normal uppercase text-subtext/70">{structure.category}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Structure Detail Card */}
          <div className="rounded-xl border border-dark-border bg-dark-surface p-3.5 space-y-2 shadow-card">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-clinical block">
                {selectedStructure.category} Profile
              </span>
              <h3 className="text-base font-bold text-ink">{selectedStructure.name}</h3>
            </div>

            {selectedStructure.vesselKey && vesselPredictions?.[selectedStructure.vesselKey] && (
              <div className="rounded-lg border border-dark-border bg-dark-card p-2.5 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-subtext">Estimated Stenosis Probability:</span>
                  <span className="font-mono font-bold text-ink text-sm">
                    {(vesselPredictions[selectedStructure.vesselKey].probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-subtext">Territory Category:</span>
                  <span
                    className={`font-semibold ${
                      vesselPredictions[selectedStructure.vesselKey].probability >= 0.7
                        ? 'text-rose-400'
                        : vesselPredictions[selectedStructure.vesselKey].probability >= 0.3
                        ? 'text-amber-400'
                        : 'text-teal-400'
                    }`}
                  >
                    {vesselPredictions[selectedStructure.vesselKey].risk_level}
                  </span>
                </div>
              </div>
            )}

            <p className="text-xs leading-5 text-subtext">{selectedStructure.description}</p>

            {selectedStructure.territory && (
              <div className="text-[11px] text-subtext">
                <span className="font-semibold text-ink">Myocardial Territory: </span>
                {selectedStructure.territory}
              </div>
            )}

            <div className="border-t border-dark-border pt-2 text-[11px] leading-4 text-subtext">
              <span className="font-semibold text-ink block mb-0.5">Clinical Relevance:</span>
              {selectedStructure.clinicalSignificance}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 border-t border-dark-border pt-3 text-xs leading-5 text-subtext flex items-start gap-2">
        <Info className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
        <span>
          <strong>Visualization Note:</strong> Colored meshes and chips reflect statistical model estimates of vessel stenosis risk based on baseline physiological indicators. They do not replace invasive coronary angiography.
        </span>
      </div>
    </section>
  );
}
