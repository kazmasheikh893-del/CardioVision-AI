/**
 * Anatomical mapping for the CardioVision heart asset (`public/models/cardiovision-heart.glb`).
 *
 * The asset is built from the Human Reference Atlas v1.3 "3D Reference Organ for Heart, Female" and
 * "3D Reference Organ for Blood Vasculature, Female" (CC BY 4.0, see docs/asset-attribution.md).
 * Both objects share one coordinate frame, and the HRA vasculature model provides *separate named
 * meshes* for the LAD, the LCX and the RCA, so no overlays or hand-drawn lines are needed.
 *
 * Node names below were taken from the actual GLB node hierarchy (verified by
 * `scripts/build_heart_asset.mjs` output and `src/lib/heartAnatomy.test.ts`).
 */
import type { VesselRiskInfo } from './api';

export const HEART_ASSET_URL = '/models/cardiovision-heart.glb';

export type CoronaryKey = 'lad' | 'lcx' | 'rca';
export type StructureKey = CoronaryKey | 'chambers' | 'great_vessels';

/** HRA node names that belong to each coronary artery (artery + branches explicitly named after it). */
export const CORONARY_NODES: Record<CoronaryKey, string[]> = {
  lad: ['VH_F_left_anterior_descending_artery', 'VH_F_diagonal_branch_of_left_anterior_descending_artery'],
  lcx: [
    'VH_F_left_circumflex_artery',
    'VH_F_left_marginal_branch',
    'VH_F_left_posterior_descending_branch_of_circumflex_branch_of_left_coronary_artery',
  ],
  rca: ['VH_F_right_coronary_artery', 'VH_F_right_marginal_artery'],
};

/**
 * Coronary meshes that are deliberately NOT attributed to a single artery: the left main stem feeds
 * both LAD and LCX, and the HRA label of the posterior left-ventricular branch does not name a parent.
 */
export const UNASSIGNED_CORONARY_NODES = [
  'VH_F_left_coronary_artery',
  'VH_F_posterior_left_ventricular_branch',
];

export const CHAMBER_NODE_PREFIXES = [
  'VH_F_interventricular_septum',
  'VH_F_left_cardiac_atrium',
  'VH_F_left_ventricle',
  'VH_F_right_cardiac_atrium',
  'VH_F_right_ventricle',
];

export const GREAT_VESSEL_NODE_PREFIXES = [
  'VH_F_aortic_arch',
  'VH_F_ascending_aorta',
  'VH_F_descending_aorta',
  'VH_F_pulmonary_trunk',
  'VH_F_pulmonary_artery',
  'VH_F_brachiocephalic',
  'VH_F_left_common_carotid',
  'VH_F_left_subclavian',
];

export type NodeClass =
  | { kind: 'coronary'; vessel: CoronaryKey }
  | { kind: 'coronary_unassigned' }
  | { kind: 'chambers' }
  | { kind: 'great_vessels' }
  | { kind: 'veins' }
  | { kind: 'internal' };

/** Classify an HRA node name. Order matters: exact coronary names first. */
export function classifyNode(name: string): NodeClass {
  for (const key of Object.keys(CORONARY_NODES) as CoronaryKey[]) {
    if (CORONARY_NODES[key].includes(name)) return { kind: 'coronary', vessel: key };
  }
  if (UNASSIGNED_CORONARY_NODES.includes(name)) return { kind: 'coronary_unassigned' };
  if (CHAMBER_NODE_PREFIXES.some((p) => name.startsWith(p))) return { kind: 'chambers' };
  if (GREAT_VESSEL_NODE_PREFIXES.some((p) => name.startsWith(p))) return { kind: 'great_vessels' };
  if (/vein|sinus|vena_cava/.test(name)) return { kind: 'veins' };
  return { kind: 'internal' };
}

export type VesselMeta = {
  key: CoronaryKey;
  abbreviation: string;
  fullName: string;
  /** Plain-English description for patients. */
  simple: string;
  /** Where the artery runs, in plain English. */
  where: string;
};

export const VESSEL_META: Record<CoronaryKey, VesselMeta> = {
  lad: {
    key: 'lad',
    abbreviation: 'LAD',
    fullName: 'Left Anterior Descending artery',
    simple: 'A major artery that runs down the front of the heart and feeds a large part of the left side of the heart muscle.',
    where: 'Front of the heart, running toward the tip.',
  },
  lcx: {
    key: 'lcx',
    abbreviation: 'LCX',
    fullName: 'Left Circumflex artery',
    simple: 'An artery that wraps around the left side of the heart and feeds the side and back of the left heart muscle.',
    where: 'Left side and back of the heart.',
  },
  rca: {
    key: 'rca',
    abbreviation: 'RCA',
    fullName: 'Right Coronary Artery',
    simple: 'An artery on the right side of the heart that feeds the right side of the heart and the bottom of the left side.',
    where: 'Right side and lower surface of the heart.',
  },
};

export const CORONARY_KEYS: CoronaryKey[] = ['lad', 'lcx', 'rca'];

export type RiskBand = 'lower' | 'intermediate' | 'higher';

export function probabilityBand(p: number): RiskBand {
  // Same cut-points as backend/app/model_service.py (30% and 70%).
  if (p >= 0.7) return 'higher';
  if (p >= 0.3) return 'intermediate';
  return 'lower';
}

export const BAND_LABEL: Record<RiskBand, string> = {
  lower: 'Lower estimate',
  intermediate: 'Intermediate estimate',
  higher: 'Higher estimate',
};

export function formatPercent(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`;
}

export type VesselReading = {
  key: CoronaryKey;
  /** Probability in [0, 1], or `undefined` when the backend returned no valid value for this vessel. */
  probability: number | undefined;
  band: RiskBand | undefined;
  info?: VesselRiskInfo;
};

/**
 * Map the backend prediction's `vessels` object to the three coronary arteries.
 *
 * Safety rules:
 *  - the probability for vessel X is only read from `vessels[X]`;
 *  - the backend's own `vessel` label must agree with the key, otherwise the value is treated as
 *    unavailable (so a swapped/corrupted mapping can never silently show LAD data on the RCA);
 *  - values outside [0, 1] or non-finite are treated as unavailable. Nothing is ever invented.
 */
export function readVessels(vessels: Record<string, VesselRiskInfo> | undefined | null): Record<CoronaryKey, VesselReading> {
  const out = {} as Record<CoronaryKey, VesselReading>;
  for (const key of CORONARY_KEYS) {
    const info = vessels?.[key];
    const p = info?.probability;
    const labelMatches = !info || String(info.vessel).toLowerCase() === key;
    const valid = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1 && labelMatches;
    out[key] = {
      key,
      probability: valid ? p : undefined,
      band: valid ? probabilityBand(p as number) : undefined,
      info: valid ? info : undefined,
    };
  }
  return out;
}

