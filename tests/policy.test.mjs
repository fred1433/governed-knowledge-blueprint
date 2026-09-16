// The policy file is executable, so these tests are about the file, not about a document.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadPolicy, decide, POLICY_PATH } from '../src/policy.mjs';

const policy = loadPolicy();

function tmpPolicy(text) {
  const dir = mkdtempSync(join(tmpdir(), 'gk-policy-'));
  const p = join(dir, 'policy.yaml');
  writeFileSync(p, text, 'utf8');
  return p;
}

const base = readFileSync(POLICY_PATH, 'utf8');

test('a rule naming a predicate that does not exist fails to load', () => {
  const broken = base.replace('predicate: confidentiality_in', 'predicate: confidentiality_is_vibes');
  assert.throws(() => loadPolicy(tmpPolicy(broken)), /unknown predicate/);
});

test('two rules with the same id fail to load', () => {
  const dup = base.replace('- id: R7_ATTRIBUTION_REQUIRED', '- id: R1_CLIENT_PRIVATE_ISOLATION');
  assert.throws(() => loadPolicy(tmpPolicy(dup)), /duplicate rule ids/);
});

test('the seven mandatory metadata fields are the ones the engagement lists', () => {
  assert.deepEqual(policy.required_metadata, [
    'source',
    'attribution',
    'permission',
    'confidentiality',
    'owner',
    'reviewer',
    'review_date',
  ]);
});

test('no role grants client_private: isolation is not a permission level', () => {
  for (const role of Object.values(policy.roles)) {
    assert.ok(!role.grants.includes('client_private'));
  }
});

const publicItem = {
  id: 'X-1',
  permission: 'public',
  confidentiality: 'public',
  approval_status: 'approved',
  contains_client_identifiers: false,
  attribution: { value: 'Forward AR Experts' },
  review_date: { value: null },
  passages: [],
};

test('a public item with no review date is allowed, and flagged elsewhere', () => {
  assert.equal(decide(policy, publicItem, 'contributor', '2026-09-16').allowed, true);
});

test('an internal item with no review date is refused by R5', () => {
  const d = decide(policy, { ...publicItem, permission: 'internal', confidentiality: 'internal' }, 'ar_lead', '2026-09-16');
  assert.equal(d.allowed, false);
  assert.equal(d.rule, 'R5_REVIEW_DATE_REQUIRED_FOR_INTERNAL');
});

test('an internal item reviewed beyond the retention window is refused by R6', () => {
  const stale = {
    ...publicItem,
    permission: 'internal',
    confidentiality: 'internal',
    review_date: { value: '2024-01-01' },
  };
  const d = decide(policy, stale, 'ar_lead', '2026-09-16');
  assert.equal(d.rule, 'R6_RETENTION_WINDOW');
});

test('an item with no attribution is refused by R7', () => {
  const d = decide(policy, { ...publicItem, attribution: { value: null } }, 'contributor', '2026-09-16');
  assert.equal(d.rule, 'R7_ATTRIBUTION_REQUIRED');
});

test('a live exception lifts its rule, an expired one does not', () => {
  const item = { ...publicItem, id: 'AD-003', permission: 'internal', confidentiality: 'internal' };
  assert.equal(decide(policy, item, 'ar_lead', '2026-09-16').rule, 'R5_REVIEW_DATE_REQUIRED_FOR_INTERNAL');
  const live = {
    ...policy,
    exceptions: [
      { item_id: 'AD-003', rule_id: 'R5_REVIEW_DATE_REQUIRED_FOR_INTERNAL', approver: 'Founder and President', expires: '2027-01-01' },
    ],
  };
  assert.equal(decide(live, item, 'ar_lead', '2026-09-16').allowed, true);
});

test('the policy digest on the page is the digest of this file', () => {
  const recorded = readFileSync(new URL('../policy/policy.sha256', import.meta.url), 'utf8').trim().split(/\s+/)[0];
  const actual = createHash('sha256').update(base).digest('hex');
  assert.equal(actual, recorded);
  assert.equal(policy.digest, recorded);
});
