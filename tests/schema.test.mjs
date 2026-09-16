// The schema is executable too. These tests load schema/schema.sql into an in-memory
// database and check that the constraints refuse the mistakes they exist to refuse.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../schema/schema.sql', import.meta.url), 'utf8');
const db = () => {
  const d = new DatabaseSync(':memory:');
  d.exec(sql);
  return d;
};

const row = (over = {}) => ({
  id: 'X-1',
  title: 'A method note',
  source_system: 'Approved document storage',
  source_reference: 'folder/doc',
  content_type: 'approved_method',
  permission: 'internal',
  confidentiality: 'internal',
  approval_status: 'approved',
  reviewer: 'Senior practitioner',
  review_date: '2026-09-01',
  review_reason: null,
  ...over,
});

function insert(d, r) {
  const keys = Object.keys(r);
  d.prepare(`INSERT INTO content_registry (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(
    ...keys.map((k) => r[k]),
  );
}

test('the schema loads', () => {
  const d = db();
  const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((t) => t.name);
  assert.deepEqual(tables, [
    'analyst_directory',
    'approval_event',
    'content_registry',
    'passage',
    'policy_exception',
    'registry_flag',
    'retrieval_log',
    'sales_signal',
  ]);
});

test('a well formed row is accepted', () => {
  const d = db();
  insert(d, row());
  assert.equal(d.prepare('SELECT count(*) c FROM content_registry').get().c, 1);
});

test('client private material cannot be carried at a shareable permission level', () => {
  const d = db();
  assert.throws(
    () => insert(d, row({ confidentiality: 'client_private', permission: 'internal', approval_status: 'raw', review_reason: 'raw' })),
    /CHECK constraint failed/,
  );
});

test('an internal row cannot be approved without a reviewer and a review date', () => {
  const d = db();
  assert.throws(() => insert(d, row({ reviewer: null, review_date: null })), /CHECK constraint failed/);
});

test('a held row must say why it is held', () => {
  const d = db();
  assert.throws(() => insert(d, row({ approval_status: 'needs_review', review_reason: null })), /CHECK constraint failed/);
});

test('the shared_knowledge view excludes private, unapproved and unredacted rows', () => {
  const d = db();
  insert(d, row({ id: 'OK-1' }));
  insert(d, row({ id: 'PRIV-1', permission: 'private_client', confidentiality: 'client_private', approval_status: 'raw', review_reason: 'raw signal' }));
  insert(d, row({ id: 'HELD-1', approval_status: 'needs_review', review_reason: 'no owner yet' }));
  insert(d, row({ id: 'DIRTY-1', contains_client_identifiers: 1 }));
  const ids = d.prepare('SELECT id FROM shared_knowledge ORDER BY id').all().map((r) => r.id);
  assert.deepEqual(ids, ['OK-1']);
});

test('an exception cannot expire before it is granted', () => {
  const d = db();
  insert(d, row({ id: 'AD-9' }));
  assert.throws(
    () =>
      d
        .prepare('INSERT INTO policy_exception (item_id, rule_id, approver, granted, expires) VALUES (?,?,?,?,?)')
        .run('AD-9', 'R5_REVIEW_DATE_REQUIRED_FOR_INTERNAL', 'Founder and President', '2026-09-16', '2026-09-01'),
    /CHECK constraint failed/,
  );
});
