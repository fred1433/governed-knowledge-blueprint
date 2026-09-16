// Builds the registry the reference service governs, and owns the two write operations that
// can change what is publishable: deriving a shareable item from a private one, and approving.
//
// Nothing here trusts a caller's word about who they are: the service passes an identity it
// authenticated, and authority is checked here as well, so no route can skip it.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const SEP = String.fromCharCode(0);
export const contentHash = (title, text) =>
  createHash('sha256').update(`${title}${SEP}${text}`).digest('hex');

export class Forbidden extends Error {
  constructor(message) {
    super(message);
    this.code = 'forbidden';
  }
}
export class Invalid extends Error {
  constructor(message) {
    super(message);
    this.code = 'invalid';
  }
}

/** One shape for every source, so one gate can govern all of them. */
function normalise(raw, extra = {}) {
  const item = { ...raw, ...extra };
  if (!item.content_hash) item.content_hash = contentHash(item.title, item.text);
  return item;
}

export function buildRegistry() {
  const library = read('library-sample.json');
  const internal = read('internal-records.json');
  const priv = read('private-records.json');
  const governance = read('governance-decisions.json');

  const decisions = new Map(governance.decisions.map((d) => [d.item_id, d]));

  const items = [];

  for (const row of library.items) {
    const d = decisions.get(row.id);
    items.push(
      normalise(row, {
        kind: 'library_article',
        text: row.extract.text,
        content_hash: row.content_hash,
        owner: d ? { value: d.owner, status: 'synthetic' } : row.owner,
        reviewer: d ? { value: d.reviewer, status: 'synthetic' } : row.reviewer,
        review_date: d ? { value: d.review_date, status: 'synthetic' } : row.review_date,
        audience: d ? d.audience : row.audience,
        approval_status: d ? d.approval.status : 'none',
        approved_by: d ? d.approval.approved_by : null,
        approved_content_hash: d ? d.approval.approved_content_hash : null,
        citation: { id: row.id, title: row.title, url: row.url, pillar: row.pillar_observed, source: 'public Library article' },
        real_content: true,
      }),
    );
  }

  for (const row of internal.records) {
    items.push(
      normalise(row, {
        approved_content_hash: row.approval_status === 'approved' ? contentHash(row.title, row.text) : null,
        citation: { id: row.id, title: row.title, url: null, pillar: row.pillar ?? null, source: 'internal record (synthetic)' },
        synthetic: true,
      }),
    );
  }

  for (const row of priv.records) {
    items.push(
      normalise(row, {
        // A private record carries no citation: it is never served, so there is nothing to cite.
        citation: null,
        synthetic: true,
      }),
    );
  }

  return {
    items,
    leakMarkers: [
      ...priv.leak_markers.names,
      ...priv.leak_markers.distinctive_details,
      ...priv.leak_markers.metadata,
    ],
    privateIds: priv.records.map((r) => r.id),
    sources: { library, internal, priv, governance },
  };
}

/**
 * The registry, with the two operations that can change what is publishable.
 * Every state change is appended to an audit trail, because an approval nobody can find later
 * is not an approval.
 */
export class Registry {
  constructor(built = buildRegistry()) {
    this.items = new Map(built.items.map((i) => [i.id, i]));
    this.leakMarkers = built.leakMarkers;
    this.privateIds = built.privateIds;
    this.sources = built.sources;
    this.audit = [];
  }

  all() {
    return [...this.items.values()];
  }

  get(id) {
    return this.items.get(id) ?? null;
  }

  /**
   * Derive a shareable item from a private one. The result is a NEW item. The private record is
   * not edited, not re-labelled and not promoted: it keeps its confidentiality for ever, and the
   * audit trail is the pair.
   */
  derive(sourceId, identity, policy, now = '2026-09-16T12:00:00Z') {
    if (!policy.roles[identity.role]?.may_approve) {
      throw new Forbidden('deriving a shareable item from a private record requires a senior reviewer');
    }
    const source = this.get(sourceId);
    if (!source) throw new Invalid(`no such record: ${sourceId}`);
    if (source.confidentiality !== 'client_private') throw new Invalid(`${sourceId} is not a private record`);
    const draft = source.derivative_draft;
    if (!draft) throw new Invalid(`${sourceId} has no de-identified draft, so there is nothing to review`);

    // The derivative gets an identifier of its own. It does not embed the identifier of the
    // record it came from: an id that names its origin is a small, permanent leak of the fact
    // that this note came from that account. The link lives in the audit trail, which is not served.
    if (this.audit.some((a) => a.action === 'derive' && a.from === sourceId)) {
      throw new Invalid(`${sourceId} already has a derivative`);
    }
    const n = this.audit.filter((a) => a.action === 'derive').length + 1;
    const id = `DER-${String(n).padStart(3, '0')}`;

    // A machine floor under a human judgement: refuse to create the derivative at all if a known
    // marker survived the rewrite. Passing this does not mean the de-identification is good.
    const survived = this.leakMarkers.filter((m) =>
      `${draft.title} ${draft.text}`.toLowerCase().includes(m.toLowerCase()),
    );
    if (survived.length) throw new Invalid(`de-identification incomplete, still present: ${survived.join(', ')}`);

    const item = normalise({
      id,
      title: draft.title,
      kind: 'derived_method_note',
      content_type: 'approved_method',
      text: draft.text,
      source_system: 'Approved shared knowledge (derived)',
      source_reference: 'derived from an internal record; the original is not referenced here',
      attribution: { value: 'Forward AR Experts', basis: 'derived method note', status: 'synthetic' },
      permission: 'internal',
      confidentiality: 'internal',
      audience: 'all_staff',
      owner: source.owner,
      reviewer: { value: null, status: 'unknown' },
      review_date: { value: null, status: 'unknown' },
      approval_status: 'pending_approval',
      approved_by: null,
      approved_content_hash: null,
      contains_client_identifiers: false,
      removed: draft.removed,
      synthetic: true,
      // The citation names the derived item only. It carries no title, path, file name or link
      // belonging to the record it came from.
      citation: { id, title: draft.title, url: null, pillar: draft.pillar ?? null, source: 'approved shared knowledge (derived, de-identified)' },
    });

    this.items.set(id, item);
    this.audit.push({ at: now, action: 'derive', item: id, from: sourceId, from_kind: 'private record', by: identity.user_id });
    return item;
  }

  /** Approve an item. Records who, when, and which version. */
  approve(id, identity, policy, { reviewer, review_date }, now = '2026-09-16T12:00:00Z') {
    if (!policy.roles[identity.role]?.may_approve) {
      throw new Forbidden('approval requires a senior reviewer');
    }
    const item = this.get(id);
    if (!item) throw new Invalid(`no such item: ${id}`);
    if (item.confidentiality === 'client_private') {
      throw new Forbidden('a private record is never approved for shared knowledge; derive a de-identified item instead');
    }
    if (!reviewer || !review_date) throw new Invalid('an approval names its reviewer and its review date');

    item.approval_status = 'approved';
    item.approved_by = identity.user_id;
    item.approved_at = now;
    item.reviewer = { value: reviewer, status: 'synthetic' };
    item.review_date = { value: review_date, status: 'synthetic' };
    item.approved_content_hash = item.content_hash;
    this.audit.push({ at: now, action: 'approve', item: id, by: identity.user_id, version: item.content_hash });
    return item;
  }

  /** Edit an item's text. Used to show that an approval does not survive a change. */
  edit(id, text, identity, policy, now = '2026-09-16T12:00:00Z') {
    const item = this.get(id);
    if (!item) throw new Invalid(`no such item: ${id}`);
    item.text = text;
    item.content_hash = contentHash(item.title, text);
    this.audit.push({ at: now, action: 'edit', item: id, by: identity.user_id, version: item.content_hash });
    return item;
  }

  withdraw(id, identity, policy, at = '2026-09-16') {
    if (!policy.roles[identity.role]?.may_approve) throw new Forbidden('withdrawal requires a senior reviewer');
    const item = this.get(id);
    if (!item) throw new Invalid(`no such item: ${id}`);
    item.withdrawn_at = at;
    this.audit.push({ at, action: 'withdraw', item: id, by: identity.user_id });
    return item;
  }
}
