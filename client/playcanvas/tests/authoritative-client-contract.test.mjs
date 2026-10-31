import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAuthoritativeClient, connectGameTransport } from '../src/rust-authoritative-client.js';

test('PlayCanvas adapter reuses the existing authoritative client and transport', () => {
  assert.equal(typeof connectAuthoritativeClient, 'function');
  assert.equal(typeof connectGameTransport, 'function');
});
