// Pure retrieval and de-identification logic: no file system. Imported by the tests, by
// the boundary log, and by the page in the browser, which is the point.

import { decide, shareable } from './policy-core.mjs';
import { buildIndex, search, citedSentence } from './search.mjs';

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
      contentType: item.content_type ?? null,
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
