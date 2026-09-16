// Checks on the policy file, the schema and the data, as opposed to the boundary behaviour.
//
// These are the ones that stop the artefact from quietly telling a lie: that a rule exists when
// nothing implements it, that the schema promises a constraint the engine does not apply, that
// something invented is presented as real, or that real content was republished wholesale.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPolicy } from '../src/policy.mjs';
import { buildRegistry, contentHash } from '../src/corpus.mjs';
import { PREDICATES } from '../src/policy-core.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

const policy = loadPolicy();
const built = buildRegistry();

describe('the policy file and the engine cannot drift apart', () => {
  test('every rule names an implemented predicate', () => {
    for (const rule of policy.rules) {
      assert.ok(PREDICATES[rule.predicate], `${rule.id} names predicate "${rule.predicate}", which does not exist`);
    }
  });

  test('every rule carries a reason a person can read', () => {
    for (const rule of policy.rules) {
      assert.ok(rule.reason && rule.reason.trim().length > 40, `${rule.id} has no usable reason`);
    }
  });

  test('no role grants client_private, because it is not a permission level', () => {
    for (const [name, role] of Object.entries(policy.roles)) {
      assert.ok(!role.audiences.includes('engagement_team'), `${name} grants an engagement audience`);
    }
    assert.ok(policy.confidentiality_levels.includes('client_private'));
  });

  test('exactly one role may approve', () => {
    const approvers = Object.entries(policy.roles).filter(([, r]) => r.may_approve);
    assert.equal(approvers.length, 1);
    assert.equal(approvers[0][0], 'senior_reviewer');
  });
});

describe('the schema encodes the same controls as the policy', () => {
  const sql = read('schema/schema.sql');

  test('the publishable view carries a clause for each content rule', () => {
    for (const marker of ['R1', 'R2', 'R4', 'R5', 'R6', 'R7']) {
      assert.ok(sql.includes(`-- ${marker}`), `the publishable view has no clause marked ${marker}`);
    }
    assert.ok(sql.includes('publishable_for_role'), 'the schema has no per-role view, so R8 lives nowhere');
  });

  test('an approval is a row that names its approver and its version', () => {
    assert.match(sql, /CREATE TABLE approval[\s\S]*approver_id\s+TEXT NOT NULL/);
    assert.match(sql, /CREATE TABLE approval[\s\S]*version_hash\s+TEXT NOT NULL/);
    assert.match(sql, /CHECK \(approved_by = 'senior_reviewer'\)/);
  });

  test('the schema refuses a private item held for a shared audience', () => {
    assert.match(sql, /CHECK \(confidentiality <> 'client_private' OR item_audience = 'engagement_team'\)/);
  });
});

describe('nothing invented is presented as real', () => {
  test('every synthetic file says so at the top', () => {
    for (const f of ['data/private-records.json', 'data/internal-records.json', 'data/governance-decisions.json']) {
      const d = readJson(f);
      assert.equal(d.synthetic, true, `${f} is not flagged synthetic`);
      assert.match(d._comment, /SYNTHETIC/, `${f} does not say so in words`);
    }
  });

  test('every item that is not a real Library article is flagged synthetic to a reader', () => {
    for (const item of built.items) {
      if (item.kind === 'library_article') {
        assert.notEqual(item.synthetic, true, `${item.id} is real content marked synthetic`);
      } else {
        assert.equal(item.synthetic, true, `${item.id} is invented and is not flagged`);
      }
    }
  });

  test('the governance values attached to real articles are labelled as placeholders', () => {
    const decisions = readJson('data/governance-decisions.json');
    assert.equal(decisions.synthetic, true);
    for (const item of built.items.filter((i) => i.kind === 'library_article')) {
      for (const f of ['owner', 'reviewer', 'review_date']) {
        const status = item[f]?.status;
        assert.ok(['unknown', 'synthetic'].includes(status), `${item.id}.${f} has status "${status}"`);
      }
    }
  });
});

describe('the Library sample stays a sample', () => {
  const lib = readJson('data/library-sample.json');

  test('eight articles, two under each observed pillar', () => {
    assert.equal(lib.items.length, 8);
    const byPillar = {};
    for (const i of lib.items) byPillar[i.pillar_observed] = (byPillar[i.pillar_observed] ?? 0) + 1;
    assert.equal(Object.keys(byPillar).length, 4);
    for (const [p, n] of Object.entries(byPillar)) assert.equal(n, 2, `${p} has ${n} articles`);
  });

  test('each row keeps a short extract, not the article', () => {
    for (const i of lib.items) {
      assert.ok(i.extract.words <= 60, `${i.id} carries ${i.extract.words} words, which is a copy rather than a citation`);
      assert.ok(i.url.startsWith('https://www.forwardarexperts.com/'), `${i.id} has no link back to the source`);
      assert.equal(i.attribution.status, 'observed');
    }
  });

  test('the observations are the ones the fetched pages support', () => {
    const withObs = lib.items.filter((i) => i.observations.length);
    assert.equal(withObs.length, 8, 'every sampled page produced at least one observation');
    const drift = lib.items.filter((i) => i.observations.some((o) => o.includes('listing and the page disagree')));
    assert.equal(drift.length, 3);
    // An article whose own identity is unsettled is not one a reviewer signs off. No governance
    // decision exists for any of the three, which is why the metadata rule holds them.
    const decided = new Set(readJson('data/governance-decisions.json').decisions.map((d) => d.item_id));
    for (const i of drift) {
      assert.ok(!decided.has(i.id), `${i.id} was approved while its title and its page disagree`);
    }
  });

  test('no governance field was invented on a real page', () => {
    for (const i of lib.items) {
      for (const f of ['owner', 'reviewer', 'review_date']) {
        assert.equal(i[f].status, 'unknown', `${i.id}.${f} claims a value the public page does not publish`);
      }
    }
  });
});

describe('the integrity of the registry itself', () => {
  test('content hashes match the content', () => {
    for (const item of built.items) {
      assert.equal(item.content_hash, contentHash(item.title, item.text), `${item.id} has a stale content hash`);
    }
  });

  test('every approval recorded in the data is bound to the version it approved', () => {
    for (const item of built.items) {
      if (item.approval_status === 'approved' && item.approved_content_hash) {
        assert.equal(item.approved_content_hash, item.content_hash, `${item.id} carries an approval for another version`);
      }
    }
  });

  test('no private marker appears anywhere in the real Library rows', () => {
    const lib = read('data/library-sample.json').toLowerCase();
    for (const m of built.leakMarkers) {
      assert.ok(!lib.includes(m.toLowerCase()), `the invented string "${m}" reached the real content file`);
    }
  });

  test('a private record carries no citation, because it is never served', () => {
    for (const id of built.privateIds) {
      const item = built.items.find((i) => i.id === id);
      assert.equal(item.citation, null, `${id} has a citation, which means somebody expected to serve it`);
      assert.equal(item.confidentiality, 'client_private');
    }
  });
});
