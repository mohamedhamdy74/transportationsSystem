import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toAuthEmail, toDisplayUsername } from './authEmail.js';

describe('auth email mapping', () => {
  it('maps plain username to auth email domain', () => {
    assert.equal(toAuthEmail('admin'), 'admin@transport.local');
    assert.equal(toAuthEmail('hhc@taqa'), 'hhc@taqa');
  });

  it('returns display username from auth email', () => {
    assert.equal(toDisplayUsername('admin@transport.local'), 'admin');
    assert.equal(toDisplayUsername('hhc@taqa'), 'hhc@taqa');
  });
});
