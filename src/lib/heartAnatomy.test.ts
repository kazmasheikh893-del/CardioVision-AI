import { describe, expect, it } from 'vitest';
import {
  classifyNode,
  formatPercent,
  probabilityBand,
  readVessels,
  CORONARY_KEYS,
  CORONARY_NODES,
} from './heartAnatomy';

describe('heartAnatomy unit test suite', () => {
  it('correctly classifies exact HRA coronary artery nodes', () => {
    expect(classifyNode('VH_F_left_anterior_descending_artery')).toEqual({
      kind: 'coronary',
      vessel: 'lad',
    });
    expect(classifyNode('VH_F_diagonal_branch_of_left_anterior_descending_artery')).toEqual({
      kind: 'coronary',
      vessel: 'lad',
    });
    expect(classifyNode('VH_F_left_circumflex_artery')).toEqual({
      kind: 'coronary',
      vessel: 'lcx',
    });
    expect(classifyNode('VH_F_left_marginal_branch')).toEqual({
      kind: 'coronary',
      vessel: 'lcx',
    });
    expect(classifyNode('VH_F_right_coronary_artery')).toEqual({
      kind: 'coronary',
      vessel: 'rca',
    });
    expect(classifyNode('VH_F_right_marginal_artery')).toEqual({
      kind: 'coronary',
      vessel: 'rca',
    });
  });

  it('classifies chambers, great vessels, and unassigned stems correctly', () => {
    expect(classifyNode('VH_F_left_ventricle')).toEqual({ kind: 'chambers' });
    expect(classifyNode('VH_F_right_ventricle')).toEqual({ kind: 'chambers' });
    expect(classifyNode('VH_F_interventricular_septum')).toEqual({ kind: 'chambers' });
    expect(classifyNode('VH_F_ascending_aorta')).toEqual({ kind: 'great_vessels' });
    expect(classifyNode('VH_F_pulmonary_trunk')).toEqual({ kind: 'great_vessels' });
    expect(classifyNode('VH_F_left_coronary_artery')).toEqual({ kind: 'coronary_unassigned' });
  });

  it('determines probability risk bands accurately', () => {
    expect(probabilityBand(0.12)).toBe('lower');
    expect(probabilityBand(0.29)).toBe('lower');
    expect(probabilityBand(0.30)).toBe('intermediate');
    expect(probabilityBand(0.55)).toBe('intermediate');
    expect(probabilityBand(0.699)).toBe('intermediate');
    expect(probabilityBand(0.70)).toBe('higher');
    expect(probabilityBand(0.95)).toBe('higher');
  });

  it('formats percentages properly', () => {
    expect(formatPercent(0.15)).toBe('15%');
    expect(formatPercent(0.728, 1)).toBe('72.8%');
  });

  it('safely extracts and validates vessel predictions without inventing data', () => {
    const rawData = {
      lad: { vessel: 'lad', name: 'LAD', probability: 0.82, risk_level: 'High Risk', territory: 'Anterior', clinical_note: 'Note' },
      lcx: { vessel: 'lcx', name: 'LCX', probability: 0.45, risk_level: 'Intermediate', territory: 'Lateral', clinical_note: 'Note' },
      rca: { vessel: 'rca', name: 'RCA', probability: 0.15, risk_level: 'Low Risk', territory: 'Inferior', clinical_note: 'Note' },
    };

    const result = readVessels(rawData);
    expect(result.lad.probability).toBe(0.82);
    expect(result.lad.band).toBe('higher');
    expect(result.lcx.probability).toBe(0.45);
    expect(result.lcx.band).toBe('intermediate');
    expect(result.rca.probability).toBe(0.15);
    expect(result.rca.band).toBe('lower');
  });

  it('rejects corrupt or mismatched vessel labels', () => {
    const corruptData = {
      lad: { vessel: 'rca', name: 'Mismatched', probability: 0.9, risk_level: 'High', territory: '', clinical_note: '' },
      lcx: { vessel: 'lcx', name: 'LCX', probability: 1.5, risk_level: 'Invalid', territory: '', clinical_note: '' }, // > 1
      rca: { vessel: 'rca', name: 'RCA', probability: -0.1, risk_level: 'Invalid', territory: '', clinical_note: '' }, // < 0
    };

    const result = readVessels(corruptData as any);
    expect(result.lad.probability).toBeUndefined();
    expect(result.lad.band).toBeUndefined();
    expect(result.lcx.probability).toBeUndefined();
    expect(result.rca.probability).toBeUndefined();
  });

  it('handles null or undefined input gracefully', () => {
    const result = readVessels(null);
    for (const key of CORONARY_KEYS) {
      expect(result[key].probability).toBeUndefined();
      expect(result[key].band).toBeUndefined();
    }
  });
});

