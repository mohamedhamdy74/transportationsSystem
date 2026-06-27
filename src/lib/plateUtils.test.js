import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlate, platesMatch } from './plateUtils.js';

describe('parsePlate', () => {
  it('extracts numbers and Arabic letters from combined plate string', () => {
    const p = parsePlate('6417 ص م ق');
    assert.equal(p.numbers, '6417');
    assert.ok(p.letters.includes('ص'));
  });

  it('normalizes alef variants', () => {
    const a = parsePlate('123 أ ب');
    const b = parsePlate('123 ا ب');
    assert.equal(a.letters, b.letters);
  });
});

describe('platesMatch', () => {
  it('matches same plate with different spacing', () => {
    assert.equal(platesMatch('6417 ص م ق', '6417 صمق'), true);
  });

  it('rejects different numbers', () => {
    assert.equal(platesMatch('6417 ص م ق', '6418 ص م ق'), false);
  });

  it('matches reordered letters', () => {
    assert.equal(platesMatch('9492 ع س ر', '9492 ر س ع'), true);
  });
});
