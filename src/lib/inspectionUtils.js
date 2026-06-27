import { parsePlate, platesMatch } from './plateUtils.js';

export function inspectionPlateKey(ins) {
  const p = parsePlate(`${ins?.no || ''} ${ins?.letters || ''}`);
  return `${p.numbers}|${p.letters.split('').sort().join('')}`;
}

export function inspectionTimestamp(ins) {
  const dateMs = ins?.inspectionDate ? new Date(ins.inspectionDate).getTime() : 0;
  const createdMs = ins?.$createdAt ? new Date(ins.$createdAt).getTime() : 0;
  const idMs = ins?.id && String(ins.id).startsWith('insp_')
    ? Number(String(ins.id).replace('insp_', '').split('_')[0]) || 0
    : 0;
  return Math.max(dateMs || 0, createdMs || 0, idMs || 0);
}

/** One record per plate — the most recent inspection only. */
export function getLatestInspectionsPerPlate(inspections) {
  const byPlate = new Map();
  for (const ins of inspections || []) {
    const key = inspectionPlateKey(ins);
    const existing = byPlate.get(key);
    if (!existing || inspectionTimestamp(ins) > inspectionTimestamp(existing)) {
      byPlate.set(key, ins);
    }
  }
  return Array.from(byPlate.values()).sort(
    (a, b) => inspectionTimestamp(b) - inspectionTimestamp(a)
  );
}

export function getLatestInspectionForPlate(inspections, plateStr) {
  return getLatestInspectionsPerPlate(inspections).find(ins =>
    platesMatch(`${ins.no} ${ins.letters}`, plateStr)
  ) || null;
}
