import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLatestInspectionsPerPlate,
  getLatestInspectionForPlate,
} from './inspectionUtils.js';

describe('getLatestInspectionsPerPlate', () => {
  it('returns one record per plate using the most recent inspection date', () => {
    const inspections = [
      { id: 'insp_1', no: '6417', letters: 'ص م ق', inspectionDate: '2025-01-01', exitStatus: 'Till now' },
      { id: 'insp_2', no: '6417', letters: 'ص م ق', inspectionDate: '2025-06-01', exitStatus: 'OUT' },
      { id: 'insp_3', no: '1234', letters: 'أ ب ج', inspectionDate: '2025-03-01', exitStatus: 'Till now' },
    ];
    const latest = getLatestInspectionsPerPlate(inspections);
    assert.equal(latest.length, 2);
    const plate6417 = getLatestInspectionForPlate(inspections, '6417 ص م ق');
    assert.equal(plate6417.id, 'insp_2');
    assert.equal(plate6417.exitStatus, 'OUT');
  });

  it('picks the newer dated record when plate has multiple inspections', () => {
    const older = { id: 'insp_1', no: '9999', letters: 'س', inspectionDate: '2025-01-01', exitStatus: 'Till now' };
    const newer = { id: 'insp_2', no: '9999', letters: 'س', inspectionDate: '2025-06-01', exitStatus: 'OUT' };
    const latest = getLatestInspectionForPlate([older, newer], '9999 س');
    assert.equal(latest.exitStatus, 'OUT');
  });

  it('filters Till now count by latest status only', () => {
    const inspections = [
      { id: 'insp_1', no: '1', letters: 'أ', inspectionDate: '2025-01-01', exitStatus: 'OUT' },
      { id: 'insp_2', no: '1', letters: 'أ', inspectionDate: '2025-06-01', exitStatus: 'Till now' },
      { id: 'insp_3', no: '2', letters: 'ب', inspectionDate: '2025-06-01', exitStatus: 'OUT' },
    ];
    const latest = getLatestInspectionsPerPlate(inspections);
    const running = latest.filter(i => i.exitStatus === 'Till now').length;
    const out = latest.filter(i => i.exitStatus === 'OUT').length;
    assert.equal(running, 1);
    assert.equal(out, 1);
  });
});
