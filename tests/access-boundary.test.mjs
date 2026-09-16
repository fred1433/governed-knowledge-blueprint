// The access boundary test (deliverable 7).
//
// The rule under test is the one the engagement puts first: raw sales conversations and
// private client material must never automatically enter shared knowledge or be
// retrievable through a connected assistant.
//
// This file does not check that one staged query is refused. It sweeps every role against
// every adversarial query, including queries made of the private strings themselves, and
// then proves the sweep has teeth by removing the isolation rule and watching the same
// sweep leak.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPolicy } from '../src/policy.mjs';
import {
  loadRegistry,
  retrieve,
  deidentify,
  approveWithoutDeidentification,
  containsIdentifier,
} from '../src/registry.mjs';

const policy = loadPolicy();
const registry = loadRegistry();
const roles = Object.keys(policy.roles);
const today = new Date().toISOString().slice(0, 10); // the sweep does not depend on a frozen clock

/** Queries built from the private material itself, plus ordinary ones. */
function adversarialQueries() {
  const q = new Set();
  for (const id of registry.privateIdentifiers) q.add(id);
  for (const s of registry.signals.signals) {
    q.add(s.raw_text.split(/[.,]/)[0]);
    for (const w of s.raw_text.split(/\s+/)) if (w.length > 6) q.add(w.replace(/[^A-Za-z]/g, ''));
  }
  for (const s of [
    'analyst briefing preparation',
    'magic quadrant readiness evidence',
    'reference customers confirmed in writing',
    'renewal risk',
    'pricing objection retainer',
    'what did the client say on the call',
    'board deck confidential launch',
    'executive visibility',
    'positioning reset',
    'analyst confidence curve',
  ]) q.add(s);
  return [...q].filter((x) => x && x.trim().length > 2);
}

const QUERIES = adversarialQueries();

/** A private row mislabelled as internal: only R1 stands between it and the reader. */
function mislabelled() {
  const raw = registry.items.find((i) => i.id === 'SS-002');
  return {
    ...raw,
    id: 'SS-002-MISLABELLED',
    permission: 'internal',
    approval_status: 'approved',
    contains_client_identifiers: false,
    reviewer: { value: 'Senior practitioner' },
    review_date: { value: today },
    attribution: { value: 'Internal thread' },
  };
}

test('T1 no query, on any role, returns a private item', () => {
  const privateIds = new Set(
    registry.items.filter((i) => i.confidentiality === 'client_private').map((i) => i.id),
  );
  let checks = 0;
  for (const role of roles) {
    for (const query of QUERIES) {
      const hits = retrieve(policy, registry.items, { query, role, today, limit: 8 });
      for (const hit of hits) {
        assert.ok(!privateIds.has(hit.itemId), `${role} retrieved private item ${hit.itemId} for "${query}"`);
        checks += 1;
      }
    }
  }
  assert.ok(checks > 0, 'the sweep returned nothing at all, which would make it vacuous');
});

test('T2 no returned passage contains a private identifier', () => {
  for (const role of roles) {
    for (const query of QUERIES) {
      for (const hit of retrieve(policy, registry.items, { query, role, today, limit: 8 })) {
        const found = containsIdentifier(`${hit.title} ${hit.cited}`, registry.privateIdentifiers);
        assert.deepEqual(found, [], `${role} saw ${found.join(', ')} via ${hit.passageId} for "${query}"`);
      }
    }
  }
});

test('T3 the sweep has teeth: removing the isolation rule makes it leak', () => {
  const weakened = { ...policy, rules: policy.rules.filter((r) => r.id !== 'R1_CLIENT_PRIVATE_ISOLATION') };
  // A row whose permission was set to internal by mistake while its confidentiality is
  // still client_private. Every other rule passes on it, so R1 is the only thing holding
  // it back. That is what makes this a control rather than a decoration.
  const items = [...registry.items, mislabelled()];
  const leaked = retrieve(weakened, items, { query: 'Halden Robotics board deck', role: 'ar_lead', today, limit: 8 });
  assert.ok(
    leaked.some((h) => h.itemId === 'SS-002-MISLABELLED'),
    'with R1 removed the private item should surface; if it does not, the test proves nothing',
  );
  // and with the real policy, the same item is refused
  const held = retrieve(policy, items, { query: 'Halden Robotics board deck', role: 'ar_lead', today, limit: 8 });
  assert.ok(!held.some((h) => h.itemId === 'SS-002-MISLABELLED'));
});

test('T4 an item waiting in the review queue is invisible to every role', () => {
  const pending = registry.items.find((i) => i.id === 'SS-001');
  assert.equal(pending.approval_status, 'pending_review');
  for (const role of roles) {
    const hits = retrieve(policy, registry.items, {
      query: 'reference customers never confirmed in writing',
      role,
      today,
      limit: 8,
    });
    assert.ok(!hits.some((h) => h.itemId === 'SS-001'));
  }
});

test('T5 approval alone does not release it: de-identification is required', () => {
  const signal = registry.signals.signals.find((s) => s.id === 'SS-001');
  const hurried = approveWithoutDeidentification(signal, { reviewer: 'Senior practitioner', review_date: today });
  const items = [...registry.items.filter((i) => i.id !== 'SS-001'), hurried];
  for (const role of roles) {
    const hits = retrieve(policy, items, { query: 'reference customers confirmed in writing', role, today, limit: 8 });
    assert.ok(!hits.some((h) => h.itemId === 'SS-001'), `${role} retrieved an approved but unredacted signal`);
  }
});

test('T6 de-identified and approved: the lesson travels, the client does not', () => {
  const signal = registry.signals.signals.find((s) => s.id === 'SS-001');
  const derived = deidentify(signal, {
    reviewer: 'Senior practitioner',
    review_date: today,
    approver: 'Founder and President',
  });
  assert.deepEqual(containsIdentifier(derived.passages[0].text, registry.privateIdentifiers), []);
  const items = [...registry.items, derived];
  const query = 'evaluation submission set aside for unconfirmed references';

  const lead = retrieve(policy, items, { query, role: 'ar_lead', today, limit: 8 });
  assert.ok(lead.some((h) => h.itemId === derived.id), 'the AR lead should reach the approved method note');

  const contributor = retrieve(policy, items, { query, role: 'contributor', today, limit: 8 });
  assert.ok(!contributor.some((h) => h.itemId === derived.id), 'a contributor has no internal permission');

  // the original private row is untouched and still unreachable
  const original = registry.items.find((i) => i.id === 'SS-001');
  assert.equal(original.approval_status, 'pending_review');
  assert.equal(original.confidentiality, 'client_private');
});

test('T7 roles differ on the same question, and the difference is the permission level', () => {
  const query = 'briefing pre-read and rehearsal before the call';
  const lead = retrieve(policy, registry.items, { query, role: 'ar_lead', today, limit: 6 });
  const contributor = retrieve(policy, registry.items, { query, role: 'contributor', today, limit: 6 });
  assert.ok(lead.some((h) => h.permission === 'internal'), 'the AR lead should see at least one internal source');
  assert.ok(contributor.every((h) => h.permission === 'public'), 'a contributor should only ever see public sources');
});

test('T8 published pages that are not knowledge stay out of shared knowledge', () => {
  const notKnowledge = registry.library.items.filter((i) =>
    i.flags.includes('not_intended_as_knowledge'),
  );
  assert.ok(notKnowledge.length > 0, 'the crawl found no placeholder or test page, so this test would be empty');
  const ids = new Set(notKnowledge.map((i) => i.id));
  for (const role of roles) {
    for (const query of ['test search page', 'lorem ipsum', 'new page', 'test blog testing']) {
      const hits = retrieve(policy, registry.items, { query, role, today, limit: 8 });
      for (const hit of hits) assert.ok(!ids.has(hit.itemId), `${hit.itemId} is live on the site but is not knowledge`);
    }
  }
});

test('T9 an internal row with no review date is refused, and an expired exception does not save it', () => {
  const orphan = registry.items.find((i) => i.id === 'AD-003');
  assert.equal(orphan.permission, 'internal');
  const hits = retrieve(policy, registry.items, { query: 'security operations coverage', role: 'ar_lead', today, limit: 8 });
  assert.ok(!hits.some((h) => h.itemId === 'AD-003'));
  const exception = policy.exceptions.find((e) => e.item_id === 'AD-003');
  assert.ok(new Date(exception.expires) <= new Date(today), 'this exception is meant to be expired');
});
