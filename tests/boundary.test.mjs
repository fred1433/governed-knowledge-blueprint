// The access boundary checks.
//
// Every one of them goes over HTTP against the reference service, with a token, through the
// same routes a client would use. None of them calls the policy engine directly: a check that
// imports the gate it is meant to be testing proves the gate agrees with itself.
//
// The leak oracle is the raw response body. Not the parsed object, not the fields we thought to
// look at: the bytes the client receives. It is more than the client name, because a name is
// the easiest thing to remove and the least likely thing to be left behind.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../service/server.mjs';
import { loadPolicy } from '../src/policy.mjs';
import { Registry } from '../src/corpus.mjs';

const READER = 'fixture-knowledge-reader';
const SENIOR = 'fixture-senior-reviewer';

let ctx;
let derivedId; // assigned when the derivative is created, never assumed

before(async () => {
  ctx = await startServer({ policy: loadPolicy(), registry: new Registry() });
});
after(async () => ctx?.close());

/** Returns the parsed body and the raw text, because the raw text is the oracle. */
async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${ctx.origin}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  return { status: res.status, raw, body: raw ? JSON.parse(raw) : null };
}

const markers = () => ctx.app.registry.leakMarkers;

function assertNoMarker(raw, where) {
  const hay = raw.toLowerCase();
  const hit = markers().filter((m) => hay.includes(m.toLowerCase()));
  assert.deepEqual(hit, [], `${where} returned private material: ${hit.join(', ')}`);
}

const QUERIES = [
  'discovery call notes',
  'what did the client say about references',
  'Northwind Grid Systems',
  'Priya Raman',
  'renewal risk pipeline',
  'pricing objection retainer',
  'analyst briefing pre-read',
  'evidence pack before a submission',
  'analyst coverage data platforms',
  'positioning for analyst mindshare',
  'operating system for analyst relations',
  'confidence curve',
  'retainer briefing cycles board deck',
];

describe('authentication', () => {
  test('no token, no answer', async () => {
    for (const p of ['/search?q=briefing', '/documents/LIB-057', '/review-queue']) {
      const r = await call(p);
      assert.equal(r.status, 401, `${p} answered without authentication`);
    }
  });

  test('a token identifies a role and its authority', async () => {
    const reader = await call('/whoami', { token: READER });
    assert.equal(reader.body.role, 'knowledge_reader');
    assert.equal(reader.body.may_approve, false);
    const senior = await call('/whoami', { token: SENIOR });
    assert.equal(senior.body.may_approve, true);
  });
});

describe('C1 a private record is not in the published corpus, for anyone', () => {
  test('it is absent from search, and the sweep finds no marker anywhere', async () => {
    for (const token of [READER, SENIOR]) {
      for (const q of QUERIES) {
        const r = await call(`/search?q=${encodeURIComponent(q)}`, { token });
        assert.equal(r.status, 200);
        assertNoMarker(r.raw, `search "${q}" as ${token}`);
        const ids = r.body.results.map((x) => x.id);
        for (const id of ctx.app.registry.privateIds) {
          assert.ok(!ids.includes(id), `search "${q}" returned ${id}`);
        }
      }
    }
  });

  test('it is not readable by direct reference either', async () => {
    for (const token of [READER, SENIOR]) {
      for (const id of ctx.app.registry.privateIds) {
        const r = await call(`/documents/${id}`, { token });
        assert.equal(r.status, 404, `${id} was readable by ${token}`);
        assertNoMarker(r.raw, `fetch ${id}`);
      }
    }
  });

  test('the review queue names the rule without carrying the content', async () => {
    const r = await call('/review-queue', { token: SENIOR });
    const rows = r.body.withheld.filter((w) => ctx.app.registry.privateIds.includes(w.id));
    assert.equal(rows.length, ctx.app.registry.privateIds.length);
    for (const row of rows) assert.equal(row.rule, 'R1_PRIVATE_ISOLATION');
    assertNoMarker(r.raw, 'review queue');
  });
});

describe('C2 a derived item is not published until it is approved', () => {
  test('deriving creates a new item, and it is not retrievable yet', async () => {
    const made = await call('/publications', { token: SENIOR, method: 'POST', body: { source_id: 'PR-001' } });
    assert.equal(made.status, 201);
    derivedId = made.body.created;
    assert.equal(made.body.approval_status, 'pending_approval');
    assert.ok(!derivedId.includes('PR-001'), 'the derivative id names the private record it came from');
    assertNoMarker(made.raw, 'publication response');

    for (const token of [READER, SENIOR]) {
      const direct = await call(`/documents/${derivedId}`, { token });
      assert.equal(direct.status, 404, 'an unapproved derivative was readable');
      const found = await call('/search?q=evaluation%20submission%20references', { token });
      assert.ok(!found.body.results.some((x) => x.id === derivedId));
    }
  });

  test('the private original is untouched by the derivation', async () => {
    const original = ctx.app.registry.get('PR-001');
    assert.equal(original.confidentiality, 'client_private');
    assert.equal(original.approval_status, 'none');
  });
});

describe('C3 approval authority is enforced by the service', () => {
  test('a knowledge reader cannot approve, and cannot derive', async () => {
    const approve = await call(`/documents/${derivedId}/approval`, {
      token: READER,
      method: 'POST',
      body: { reviewer: 'Founder and President', review_date: '2026-09-16' },
    });
    assert.equal(approve.status, 403);

    const derive = await call('/publications', { token: READER, method: 'POST', body: { source_id: 'PR-002' } });
    assert.equal(derive.status, 403);

    // and nothing moved
    assert.equal(ctx.app.registry.get(derivedId).approval_status, 'pending_approval');
    assert.equal(ctx.app.registry.audit.filter((a) => a.action === 'derive').length, 1);
  });

  test('an approval without a named reviewer is refused', async () => {
    const r = await call(`/documents/${derivedId}/approval`, { token: SENIOR, method: 'POST', body: {} });
    assert.equal(r.status, 422);
  });

  test('a private record cannot be approved into shared knowledge at all', async () => {
    const r = await call('/documents/PR-002/approval', {
      token: SENIOR,
      method: 'POST',
      body: { reviewer: 'Founder and President', review_date: '2026-09-16' },
    });
    assert.equal(r.status, 403, 'a raw private record was approvable');
    assert.equal(ctx.app.registry.get('PR-002').confidentiality, 'client_private');
  });
});

describe('C4 an approved derivative is retrievable, and the original stays out', () => {
  test('after a senior approval the derivative is found and cited', async () => {
    const ok = await call(`/documents/${derivedId}/approval`, {
      token: SENIOR,
      method: 'POST',
      body: { reviewer: 'Founder and President', review_date: '2026-09-16' },
    });
    assert.equal(ok.status, 200);

    const found = await call('/search?q=written%20confirmations%20reference%20accounts', { token: READER });
    const hit = found.body.results.find((x) => x.id === derivedId);
    assert.ok(hit, 'the approved derivative was not retrievable');
    assert.equal(hit.citation.id, derivedId);
    assert.equal(hit.synthetic, true);
    assertNoMarker(found.raw, 'search after approval');

    const direct = await call(`/documents/${derivedId}`, { token: READER });
    assert.equal(direct.status, 200);
    assertNoMarker(direct.raw, 'fetch of the approved derivative');
  });

  test('the original is still refused, to both identities', async () => {
    for (const token of [READER, SENIOR]) {
      const r = await call('/documents/PR-001', { token });
      assert.equal(r.status, 404, 'the original became readable once its derivative was approved');
    }
  });

  test('C9 the citation names nothing belonging to the private record', async () => {
    const r = await call(`/documents/${derivedId}`, { token: READER });
    const asText = JSON.stringify(r.body);
    assertNoMarker(asText, 'derivative citation');
    for (const privateId of ctx.app.registry.privateIds) {
      assert.ok(!asText.includes(privateId), `the derivative names the private record ${privateId}`);
    }
    assert.equal(r.body.citation.url, null);
    const original = ctx.app.registry.get('PR-001');
    assert.ok(!asText.includes(original.source_path), 'the private source path appeared in a served citation');
    assert.ok(!asText.includes(original.title), 'the private record title appeared in a served citation');
  });
});

describe('C5 an approved item held for another audience is absent both ways', () => {
  test('search does not show it and direct reference does not return it', async () => {
    const leadershipOnly = 'AN-001';
    assert.equal(ctx.app.registry.get(leadershipOnly).audience, 'leadership');
    assert.equal(ctx.app.registry.get(leadershipOnly).approval_status, 'approved');

    const search = await call('/search?q=analyst%20coverage%20infrastructure%20automation', { token: READER });
    assert.ok(!search.body.results.some((x) => x.id === leadershipOnly), 'a leadership item appeared in a reader search');

    const direct = await call(`/documents/${leadershipOnly}`, { token: READER });
    assert.equal(direct.status, 404, 'a leadership item was readable by direct reference');

    const senior = await call(`/documents/${leadershipOnly}`, { token: SENIOR });
    assert.equal(senior.status, 200, 'the senior reviewer should be able to read it');
  });
});

describe('C6 an approval does not survive a change to the content', () => {
  test('the edited version is withheld until it is approved again', async () => {
    const before = await call('/documents/LIB-057', { token: READER });
    assert.equal(before.status, 200);

    ctx.app.registry.edit('LIB-057', 'Rewritten after approval, by someone in a hurry.', { user_id: 'u-senior' }, ctx.app.policy);

    const after = await call('/documents/LIB-057', { token: READER });
    assert.equal(after.status, 404, 'an edited item kept the approval given to its previous version');

    const queue = await call('/review-queue', { token: SENIOR });
    const row = queue.body.withheld.find((w) => w.id === 'LIB-057');
    assert.equal(row.rule, 'R4_APPROVAL_BOUND_TO_VERSION');

    // and re-approving the new version brings it back
    await call('/documents/LIB-057/approval', {
      token: SENIOR,
      method: 'POST',
      body: { reviewer: 'Founder and President', review_date: '2026-09-16' },
    });
    const again = await call('/documents/LIB-057', { token: READER });
    assert.equal(again.status, 200);
  });
});

describe('C7 withdrawal and expiry', () => {
  test('a withdrawn item is excluded here, and no claim is made about anywhere else', async () => {
    const r = await call('/documents/MN-002', { token: READER });
    assert.equal(r.status, 404);
    const queue = await call('/review-queue', { token: READER });
    assert.equal(queue.body.withheld.find((w) => w.id === 'MN-002').rule, 'R6_WITHDRAWN');
  });

  test('an item whose review date has aged out leaves shared knowledge on its own', async () => {
    const r = await call('/documents/MN-003', { token: READER });
    assert.equal(r.status, 404);
    const queue = await call('/review-queue', { token: READER });
    assert.equal(queue.body.withheld.find((w) => w.id === 'MN-003').rule, 'R7_RETENTION_WINDOW');
  });

  test('withdrawing an item takes it out immediately', async () => {
    const live = await call('/documents/MN-001', { token: READER });
    assert.equal(live.status, 200);
    ctx.app.registry.withdraw('MN-001', { user_id: 'u-senior', role: 'senior_reviewer' }, ctx.app.policy);
    const gone = await call('/documents/MN-001', { token: READER });
    assert.equal(gone.status, 404);
  });
});

describe('C8 unknown governance fields refuse publication', () => {
  test('the three articles whose identity is unsettled are not published', async () => {
    for (const id of ['LIB-004', 'LIB-010', 'LIB-032']) {
      const r = await call(`/documents/${id}`, { token: SENIOR });
      assert.equal(r.status, 404, `${id} was published with unknown governance fields`);
      const queue = await call('/review-queue', { token: SENIOR });
      assert.equal(queue.body.withheld.find((w) => w.id === id).rule, 'R2_REQUIRED_METADATA_UNKNOWN');
    }
  });

  test('an expired exception does not rescue an item', async () => {
    const r = await call('/documents/AN-002', { token: READER });
    assert.equal(r.status, 404, 'an expired exception was still lifting a rule');
  });

  test('public on the website is not the same as approved shared knowledge', async () => {
    const q = await call('/review-queue', { token: SENIOR });
    const held = q.body.withheld.filter((w) => w.rule === 'R2_REQUIRED_METADATA_UNKNOWN');
    assert.ok(held.length >= 3, 'the metadata rule is not holding anything, which would make it decorative');
  });
});

describe('C1b a record filed as internal that still names an account', () => {
  test('one rule holds it, and it never reaches a reader', async () => {
    const item = ctx.app.registry.get('MN-004');
    assert.equal(item.confidentiality, 'internal', 'the fixture is the mislabelling case, so it must be filed as internal');
    assert.equal(item.approval_status, 'approved', 'and it must be approved, so approval is not what is stopping it');

    for (const token of [READER, SENIOR]) {
      const direct = await call('/documents/MN-004', { token });
      assert.equal(direct.status, 404, 'a record still carrying identifiers was readable');
      const found = await call('/search?q=retainer%20briefing%20cycles%20board%20deck', { token });
      assertNoMarker(found.raw, 'search that would reach MN-004');
      assert.ok(!found.body.results.some((x) => x.id === 'MN-004'));
    }

    const queue = await call('/review-queue', { token: SENIOR });
    assert.equal(queue.body.withheld.find((w) => w.id === 'MN-004').rule, 'R5_IDENTIFIERS_PRESENT');
  });
});

describe('the negative control has a companion here', () => {
  test('an ordinary run loads every rule in the policy file', () => {
    const policy = loadPolicy(undefined, { neutralise: undefined });
    assert.equal(policy.neutralised, null, 'a guard was switched off outside the negative control');
    assert.equal(policy.rules.length, 8);
  });
});
