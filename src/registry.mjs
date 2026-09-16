// The Content Registry: one shape for every source, so one gate can govern all of them.
//
// Public Library rows come from a crawl of forwardarexperts.com. Internal rows, analyst
// rows and sales signals are illustrative and carry illustrative: true. Nothing here is
// private client data: the private rows are invented so the boundary test has something
// to try to leak.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decide, shareable } from './policy.mjs';
import { buildIndex, search, citedSentence } from './search.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');

const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

export function loadRegistry() {
  const library = read('content-registry.json');
  const shared = read('approved-shared-knowledge.json');
  const analysts = read('analyst-directory.json');
  const signals = read('sales-signals.json');

  const items = [
    ...library.items.map((it) => ({ ...it, kind: 'library', illustrative: false })),
    ...shared.items.map((it) => ({ ...it, kind: 'approved_method' })),
    ...analysts.entries.map((it) => ({
      ...it,
      kind: 'analyst',
      title: `${it.analyst_name}, ${it.firm}`,
      content_type: 'analyst_profile',
    })),
    ...signals.signals.map((s) => ({
      ...s,
      kind: 'sales_signal',
      content_type: 'raw_sales_signal',
      passages: [{ id: `${s.id}#raw`, text: s.raw_text }],
    })),
  ];

  return {
    items,
    library,
    signals,
    privateIdentifiers: signals.private_identifiers,
    counts: {
      library: library.items.length,
      approved_methods: shared.items.length,
      analysts: analysts.entries.length,
      sales_signals: signals.signals.length,
      passages: items.reduce((n, it) => n + (it.passages?.length ?? 0), 0),
    },
  };
}

/**
 * De-identification produces a NEW item. The private row is never edited, never promoted,
 * never re-labelled: it stays where it is, and a derived item carries the lesson.
 */
export function deidentify(signal, { reviewer, review_date, approver }) {
  const draft = signal.deidentified_draft;
  if (!draft) throw new Error(`${signal.id} has no de-identified draft to approve`);
  return {
    id: `${signal.id}-DEID`,
    kind: 'approved_method',
    derived_from: signal.id,
    title: draft.title,
    pillar: draft.pillar ?? null,
    content_type: 'approved_method',
    source_system: 'Approved shared knowledge (derived from a private signal)',
    source_reference: `de-identified from ${signal.id}, original left in place`,
    attribution: { value: 'Forward AR Experts', basis: 'derived method note', status: 'derived' },
    permission: 'internal',
    confidentiality: 'internal',
    owner: signal.owner,
    reviewer: { value: reviewer, status: 'approved' },
    review_date: { value: review_date, status: 'approved' },
    approved_by: approver,
    approval_status: 'approved',
    contains_client_identifiers: false,
    removed: draft.removed,
    illustrative: true,
    passages: [{ id: `${signal.id}-DEID#p1`, text: draft.text }],
  };
}

/** Approval without de-identification: what a hurried reviewer would do. R3 still refuses it. */
export function approveWithoutDeidentification(signal, { reviewer, review_date }) {
  return {
    ...signal,
    approval_status: 'approved',
    permission: 'internal',
    confidentiality: 'internal',
    reviewer: { value: reviewer, status: 'approved' },
    review_date: { value: review_date, status: 'approved' },
  };
}

/** Machine check that a text really is clean, rather than declared clean. */
export function containsIdentifier(text, identifiers) {
  const hay = String(text).toLowerCase();
  return identifiers.filter((id) => hay.includes(String(id).toLowerCase()));
}

/**
 * The retrieval gate. The registry decides first, the index only ever sees what the
 * registry released, and every hit carries the item it came from.
 */
export function retrieve(policy, items, { query, role, today = '2026-09-16', limit = 4 }) {
  const allowed = shareable(policy, items, role, today);
  const passages = [];
  for (const item of allowed) {
    for (const p of item.passages ?? []) {
      passages.push({ id: p.id, text: p.text, title: item.title, itemId: item.id });
    }
  }
  const index = buildIndex(passages);
  return search(index, query, limit).map((hit) => {
    const item = allowed.find((it) => it.id === hit.itemId);
    return {
      itemId: item.id,
      title: item.title,
      url: item.url ?? null,
      pillar: item.pillar ?? null,
      permission: item.permission,
      illustrative: Boolean(item.illustrative),
      passageId: hit.id,
      cited: citedSentence(hit.text, query),
      score: hit.score,
    };
  });
}

/** What the reader did not get, and the rule that stopped it. */
export function explainWithheld(policy, items, role, today = '2026-09-16') {
  return items
    .map((item) => ({ item, decision: decide(policy, item, role, today) }))
    .filter((x) => !x.decision.allowed)
    .map((x) => ({
      itemId: x.item.id,
      title: x.item.title,
      confidentiality: x.item.confidentiality,
      rule: x.decision.rule,
      reason: x.decision.reason,
    }));
}
