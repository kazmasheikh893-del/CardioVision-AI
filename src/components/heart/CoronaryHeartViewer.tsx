import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Heart,
  Info,
  MinusCircle,
  RotateCcw,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Component, Suspense, lazy, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { VesselRiskInfo } from '../../lib/api';
import {
  BAND_LABEL,
  CORONARY_KEYS,
  VESSEL_META,
  formatPercent,
  readVessels,
  type CoronaryKey,
  type StructureKey,
} from '../../lib/heartAnatomy';
import type { ViewCommand } from './HeartScene';

const HeartScene = lazy(() => import('./HeartScene'));

type Variant = 'patient' | 'clinician';

type Props = {
  /** `prediction.vessels` exactly as returned by the backend (or undefined when no prediction exists). */
  vessels?: Record<string, VesselRiskInfo> | null;
  variant?: Variant;
  selected?: StructureKey | null;
  onSelect?: (key: StructureKey | null) => void;
  /** Optional extra caveat shown under the vessel values (e.g. model reliability). */
  vesselCaveat?: ReactNode;
  heightClass?: string;
};

export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

class SceneErrorBoundary extends Component<{ children: ReactNode; onError: (msg: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error?.message || 'The 3D scene could not be started.');
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const BAND_CLASS = {
  lower: 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200',
  intermediate: 'border-amber-400/60 bg-amber-400/10 text-amber-200',
  higher: 'border-rose-400/60 bg-rose-400/10 text-rose-200',
  none: 'border-slate-500/50 bg-slate-500/10 text-slate-300',
} as const;

function BandIcon({ band }: { band?: 'lower' | 'intermediate' | 'higher' }) {
  if (!band) return <MinusCircle size={13} aria-hidden="true" />;
  if (band === 'higher') return <AlertTriangle size={13} aria-hidden="true" />;
  if (band === 'intermediate') return <Info size={13} aria-hidden="true" />;
  return <CheckCircle2 size={13} aria-hidden="true" />;
}

export function VesselChip({
  vesselKey,
  selected,
  onClick,
  reading,
}: {
  vesselKey: CoronaryKey;
  selected: boolean;
  onClick: () => void;
  reading: ReturnType<typeof readVessels>[CoronaryKey];
}) {
  const meta = VESSEL_META[vesselKey];
  const band = reading.band;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`focus-ring flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
        BAND_CLASS[band ?? 'none']
      } ${selected ? 'ring-2 ring-white/80' : 'hover:brightness-125'}`}
      data-testid={`vessel-chip-${vesselKey}`}
    >
      <span className="flex items-center gap-1.5 font-bold">
        <BandIcon band={band} />
        {meta.abbreviation}
      </span>
      <span className="font-mono text-sm font-extrabold">
        {reading.probability === undefined ? 'No estimate' : formatPercent(reading.probability)}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
        {band ? BAND_LABEL[band] : 'Not available'}
      </span>
    </button>
  );
}

/** Non-3D presentation: also acts as the accessible text alternative for the 3D view. */
function TextFallback({ reason, readings }: { reason: string; readings: ReturnType<typeof readVessels> }) {
  return (
    <div role="status" className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center" data-testid="heart-fallback">
      <ShieldAlert className="h-9 w-9 text-amber-300" aria-hidden="true" />
      <p className="text-sm font-semibold text-ink">The 3D heart view is not available on this device</p>
      <p className="max-w-md text-xs leading-5 text-subtext">
        {reason} Your results are still shown in the list below. No image is drawn here, so nothing is implied about where
        an artery narrowing might be.
      </p>
      <ul className="w-full max-w-md space-y-1.5 text-left text-xs text-subtext">
        {CORONARY_KEYS.map((k) => (
          <li key={k} className="rounded-md border border-dark-border bg-dark-surface px-3 py-2">
            <span className="font-semibold text-ink">
              {VESSEL_META[k].abbreviation} – {VESSEL_META[k].fullName}:
            </span>{' '}
            {readings[k].probability === undefined ? 'no model estimate available' : `model estimate ${formatPercent(readings[k].probability!)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StructureDetails({
  selected,
  readings,
  variant,
}: {
  selected: StructureKey | null;
  readings: ReturnType<typeof readVessels>;
  variant: Variant;
}) {
  if (!selected) {
    return (
      <div className="rounded-xl border border-dashed border-dark-border bg-dark-surface/60 p-4 text-xs leading-5 text-subtext" data-testid="vessel-details-empty">
        <p className="font-semibold text-ink">Nothing selected</p>
        Select LAD, LCX or RCA (below the image or on the image) to highlight that artery and read what it does. Drag to rotate,
        scroll or pinch to zoom.
      </div>
    );
  }
  if (selected === 'chambers') {
    return (
      <div className="rounded-xl border border-dark-border bg-dark-surface p-4 text-xs leading-5 text-subtext" data-testid="vessel-details">
        <h4 className="text-sm font-bold text-ink">Heart chambers</h4>
        The four chambers (two upper atria and two lower ventricles) that collect and pump blood. This is a reference anatomy model, not
        your own heart.
      </div>
    );
  }
  if (selected === 'great_vessels') {
    return (
      <div className="rounded-xl border border-dark-border bg-dark-surface p-4 text-xs leading-5 text-subtext" data-testid="vessel-details">
        <h4 className="text-sm font-bold text-ink">Large blood vessels</h4>
        The aorta (carries blood to the body) and the pulmonary artery (carries blood to the lungs). This is a reference anatomy model,
        not your own heart.
      </div>
    );
  }
  const meta = VESSEL_META[selected];
  const reading = readings[selected];
  return (
    <div
      className={`rounded-xl border p-4 text-xs leading-5 ${BAND_CLASS[reading.band ?? 'none']}`}
      data-testid="vessel-details"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-white">
            {meta.fullName} <span className="font-mono text-xs opacity-80">({meta.abbreviation})</span>
          </h4>
          <p className="mt-0.5 text-slate-200">{meta.simple}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-xl font-extrabold text-white">
            {reading.probability === undefined ? '—' : formatPercent(reading.probability, 1)}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide">
            {reading.band ? BAND_LABEL[reading.band] : 'Not available'}
          </div>
        </div>
      </div>
      <p className="mt-2 text-slate-200">
        {reading.probability === undefined
          ? 'There is no model estimate for this artery in this assessment, so nothing is shown for it.'
          : `The model estimates a ${formatPercent(reading.probability, 1)} likelihood of narrowing (stenosis) linked to this artery, based on the information you entered. This is a statistical estimate, not a measurement of a blockage.`}
      </p>
      <p className="mt-1 text-slate-300">
        It does not show where along the artery a narrowing might be, how long it is, or how severe it is. Where it runs: {meta.where}
      </p>
      {variant === 'clinician' && reading.info ? (
        <p className="mt-2 border-t border-white/10 pt-2 text-slate-300">
          <span className="font-semibold text-white">Territory:</span> {reading.info.territory}
        </p>
      ) : null}
    </div>
  );
}

export default function CoronaryHeartViewer({
  vessels,
  variant = 'patient',
  selected: selectedProp,
  onSelect,
  vesselCaveat,
  heightClass = 'h-[360px] sm:h-[460px]',
}: Props) {
  const readings = useMemo(() => readVessels(vessels), [vessels]);
  const [internalSelected, setInternalSelected] = useState<StructureKey | null>(null);
  const selected = selectedProp !== undefined ? selectedProp : internalSelected;
  const select = useCallback(
    (key: StructureKey | null) => {
      setInternalSelected(key);
      onSelect?.(key);
    },
    [onSelect],
  );

  const [command, setCommand] = useState<ViewCommand | null>(null);
  const send = useCallback((type: ViewCommand['type']) => setCommand((c) => ({ id: (c?.id ?? 0) + 1, type })), []);

  const [failure, setFailure] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const webgl = useMemo(() => isWebGLAvailable(), []);
  const reason = failure ?? (!webgl ? 'WebGL graphics are not available in this browser.' : null);
  const hasAnyEstimate = CORONARY_KEYS.some((k) => readings[k].probability !== undefined);

  const summary = CORONARY_KEYS.map((k) => {
    const r = readings[k];
    return `${VESSEL_META[k].fullName}: ${r.probability === undefined ? 'no estimate available' : `model estimate ${formatPercent(r.probability)}`}`;
  }).join('; ');

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, ViewCommand['type']> = {
      ArrowLeft: 'rotL',
      ArrowRight: 'rotR',
      ArrowUp: 'rotU',
      ArrowDown: 'rotD',
      '+': 'zoomIn',
      '=': 'zoomIn',
      '-': 'zoomOut',
      Home: 'reset',
    };
    if (map[e.key]) {
      e.preventDefault();
      send(map[e.key]);
    }
  };

  const toolbarBtn =
    'focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-md border border-cyan-400/25 bg-slate-900/70 px-2 text-[11px] font-semibold text-cyan-100 backdrop-blur transition hover:bg-cyan-400/15';

  return (
    <div className="space-y-3" data-testid="coronary-heart-viewer">
      <div
        className={`cv-stage relative overflow-hidden rounded-2xl border border-cyan-400/20 shadow-[0_0_40px_rgba(34,211,238,0.08)] ${heightClass}`}
        tabIndex={reason ? -1 : 0}
        role="group"
        aria-label={`Interactive 3D heart. ${summary}. Use arrow keys to rotate, plus and minus to zoom, Home to reset.`}
        onKeyDown={reason ? undefined : onKeyDown}
      >
        {reason ? (
          <TextFallback reason={reason} readings={readings} />
        ) : (
          <>
            <SceneErrorBoundary onError={setFailure}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-cyan-100/80" role="status">
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
                    Loading 3D heart…
                  </div>
                }
              >
                <HeartScene
                  readings={readings}
                  selected={selected}
                  onSelect={select}
                  command={command}
                  onFailure={setFailure}
                  onReady={() => setReady(true)}
                />
              </Suspense>
            </SceneErrorBoundary>

            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-cyan-400/20 bg-slate-950/70 px-3 py-1 text-[10px] font-medium text-cyan-100/90 backdrop-blur">
              Drag to rotate · scroll / pinch to zoom · right-drag to move
            </div>
            <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5" role="toolbar" aria-label="3D view controls">
              <button type="button" className={toolbarBtn} onClick={() => send('zoomIn')} aria-label="Zoom in" title="Zoom in">
                <ZoomIn size={14} aria-hidden="true" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => send('zoomOut')} aria-label="Zoom out" title="Zoom out">
                <ZoomOut size={14} aria-hidden="true" />
              </button>
              <button type="button" className={toolbarBtn} onClick={() => send('reset')} aria-label="Reset view" title="Reset view">
                <RotateCcw size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5" role="toolbar" aria-label="View direction">
              <button type="button" className={toolbarBtn} onClick={() => send('rotL')} aria-label="Rotate left"><ArrowLeft size={14} aria-hidden="true" /></button>
              <button type="button" className={toolbarBtn} onClick={() => send('rotR')} aria-label="Rotate right"><ArrowRight size={14} aria-hidden="true" /></button>
              <button type="button" className={toolbarBtn} onClick={() => send('rotU')} aria-label="Rotate up"><ArrowUp size={14} aria-hidden="true" /></button>
              <button type="button" className={toolbarBtn} onClick={() => send('rotD')} aria-label="Rotate down"><ArrowDown size={14} aria-hidden="true" /></button>
              <button type="button" className={toolbarBtn} onClick={() => send('front')}>Front</button>
              <button type="button" className={toolbarBtn} onClick={() => send('left')}>Patient's left</button>
              <button type="button" className={toolbarBtn} onClick={() => send('right')}>Patient's right</button>
              <button type="button" className={toolbarBtn} onClick={() => send('back')}>Back</button>
              <button type="button" className={toolbarBtn} onClick={() => send('top')}>Top</button>
            </div>
            {!ready ? null : (
              <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-1 rounded-full border border-cyan-400/20 bg-slate-950/70 px-2.5 py-1 text-[10px] text-cyan-100/80 backdrop-blur sm:flex">
                <Heart size={11} aria-hidden="true" /> Reference anatomy – not your own heart
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Select a coronary artery">
        {CORONARY_KEYS.map((k) => (
          <VesselChip key={k} vesselKey={k} reading={readings[k]} selected={selected === k} onClick={() => select(selected === k ? null : k)} />
        ))}
      </div>

      {!hasAnyEstimate ? (
        <p className="rounded-lg border border-slate-600/40 bg-slate-800/40 px-3 py-2 text-xs text-slate-300" data-testid="no-vessel-estimates">
          No artery estimates are available yet. The heart is shown in a neutral colour until a real model estimate exists.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-subtext" aria-label="Colour key">
          <span className="font-semibold text-ink">Key:</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" aria-hidden="true" />Lower estimate (under 30%)</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />Intermediate (30–69%)</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden="true" />Higher (70% or more)</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />No estimate</span>
        </div>
      )}

      <StructureDetails selected={selected} readings={readings} variant={variant} />
      {vesselCaveat}
      <p className="sr-only">{summary}</p>
    </div>
  );
}

