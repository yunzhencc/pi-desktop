import assert from 'node:assert/strict';
import { it } from 'vitest';
import { shouldTailFromDisk } from '../src/session-supervisor-utils.ts';

const base = { isStreaming: false, diskMtimeMs: 2_000, baselineMtimeMs: 1_000 };

it('tails from disk when an idle session\'s file grew past the reconciled baseline', () => {
  // This is the external-append case: `pi --continue` bumped the JSONL mtime
  // beyond what the in-memory runtime last reconciled.
  assert.equal(shouldTailFromDisk(base), true);
});

it('never tails mid-stream — the live runtime is authoritative while generating', () => {
  assert.equal(shouldTailFromDisk({ ...base, isStreaming: true }), false);
});

it('does not tail when disk mtime is unchanged or older than the baseline', () => {
  assert.equal(shouldTailFromDisk({ ...base, diskMtimeMs: 1_000 }), false);
  assert.equal(shouldTailFromDisk({ ...base, diskMtimeMs: 500 }), false);
});

it('does not tail without a stat result (also covers a missing session file)', () => {
  assert.equal(shouldTailFromDisk({ ...base, diskMtimeMs: undefined }), false);
});

it('first serve (no baseline yet) serves memory, not disk', () => {
  // Baseline is captured at bind time against the freshly-opened file, so an
  // undefined baseline means we have nothing proving disk is ahead.
  assert.equal(shouldTailFromDisk({ ...base, baselineMtimeMs: undefined }), false);
});
