// Integrity of the registry itself: the rows have to carry the mandatory metadata, the
// public rows have to come from the public site, and nothing invented may be presented
// as if it were real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPolicy } from '../src/policy.mjs';
import { loadRegistry, containsIdentifier } from '../src/registry.mjs';

const policy = loadPolicy();
const registry = loadRegistry();

test('every row carries the seven mandatory metadata fields', () => {
  const map = {
    source: (it) => it.source_system,
    attribution: (it) => it.attribution,
    permission: (it) => it.permission,
    confidentiality: (it) => it.confidentiality,
    owner: (it) => it.owner,
    reviewer: (it) => it.reviewer,
    review_date: (it) => it.review_date,
  };
  for (const it of registry.items) {
    for (const field of policy.required_metadata) {
      assert.notEqual(map[field](it), undefined, `${it.id} has no ${field} field at all`);
    }
  }
});

test('every public Library row points at an https page on the firm own domain', () => {
  for (const it of registry.library.items) {
    assert.match(it.url, /^https:\/\/www\.forwardarexperts\.com(\/|$)/);
    assert.equal(it.permission, 'public');
    assert.equal(it.confidentiality, 'public');
  }
});

test('the public crawl brought back nothing private', () => {
  for (const it of registry.library.items) {
    const text = [it.title, it.summary ?? '', ...(it.passages ?? []).map((p) => p.text)].join(' ');
    assert.deepEqual(containsIdentifier(text, registry.privateIdentifiers), [], `${it.id} contains a private string`);
  }
});

test('everything that is not from the public site is marked illustrative', () => {
  for (const it of registry.items) {
    if (it.kind === 'library') assert.equal(it.illustrative, false);
    else assert.equal(it.illustrative, true, `${it.id} is invented and must say so`);
  }
});

test('the registry has the number of rows the crawl reported', () => {
  assert.equal(registry.library.items.length, registry.library.source.pages_fetched);
  assert.equal(registry.library.source.http_200, registry.library.source.pages_fetched);
});

test('items that need review carry a reason a person can act on', () => {
  for (const it of registry.library.items) {
    if (it.approval_status === 'needs_review') {
      assert.ok(it.review_reason && it.review_reason.length > 12, `${it.id} is held with no reason`);
    } else {
      assert.equal(it.approval_status, 'approved');
    }
  }
});

test('the four Library pillars are all represented', () => {
  const pillars = new Set(registry.library.items.map((i) => i.pillar).filter(Boolean));
  assert.equal(pillars.size, 4);
});
