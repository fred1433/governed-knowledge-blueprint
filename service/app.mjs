// The reference service. Authorisation happens here, on the server, before anything is indexed
// and before anything is returned.
//
// The shape that matters: the policy decides the corpus for the authenticated identity first,
// and only that corpus is indexed and only that corpus can be fetched by id. A client is never
// sent material it is then trusted to hide. There is no route that returns the registry.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { publishedFor, decide, withheldFor, mayApprove } from '../src/policy-core.mjs';
import { Registry, Forbidden, Invalid } from '../src/corpus.mjs';
import { buildIndex, search, citedSentence } from '../src/search.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IDENTITIES = JSON.parse(readFileSync(join(HERE, '..', 'data', 'identities.json'), 'utf8')).identities;

export const TODAY = '2026-09-16';

export function createApp({ policy, registry = new Registry(), today = TODAY } = {}) {
  if (!policy) throw new Error('the service will not start without a policy');

  const authenticate = (req) => {
    const header = req.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    return IDENTITIES.find((i) => i.token === token) ?? null;
  };

  /** The corpus this identity may see. Computed per request, never cached across identities. */
  const corpusFor = (identity) => publishedFor(policy, registry.all(), identity.role, today);

  const serve = (item, extra = {}) => ({
    id: item.id,
    title: item.title,
    text: item.text,
    citation: item.citation,
    permission: item.permission,
    audience: item.audience,
    synthetic: Boolean(item.synthetic),
    reviewer: item.reviewer?.value ?? null,
    review_date: item.review_date?.value ?? null,
    ...extra,
  });

  async function handle(req) {
    const url = new URL(req.url, 'http://service.local');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    const identity = authenticate(req);
    if (!identity) {
      return { status: 401, body: { error: 'authentication required' } };
    }

    if (path === '/whoami' && method === 'GET') {
      return {
        status: 200,
        body: {
          user_id: identity.user_id,
          display_name: identity.display_name,
          role: identity.role,
          audiences: policy.roles[identity.role].audiences,
          may_approve: mayApprove(policy, identity.role),
        },
      };
    }

    if (path === '/search' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const corpus = corpusFor(identity);
      const index = buildIndex(corpus.map((i) => ({ id: i.id, title: i.title, text: i.text })));
      const hits = search(index, q, Number(url.searchParams.get('limit') ?? 5));
      return {
        status: 200,
        body: {
          // The caller's query is deliberately not echoed. A response body can then be scanned
          // for private strings without first working out which ones the caller supplied.
          as: { user_id: identity.user_id, role: identity.role },
          corpus_size: corpus.length,
          results: hits.map((h) => {
            const item = registry.get(h.id);
            return serve(item, { score: h.score, cited: citedSentence(item.text, q) });
          }),
        },
      };
    }

    const doc = path.match(/^\/documents\/([A-Za-z0-9-]+)$/);
    if (doc && method === 'GET') {
      const id = doc[1];
      const item = registry.get(id);
      // An item this identity may not have is reported the same way whether or not it exists,
      // so the shape of the answer does not leak the existence of a private record.
      if (!item || !decide(policy, item, identity.role, today).allowed) {
        return { status: 404, body: { error: 'not found' } };
      }
      return { status: 200, body: serve(item) };
    }

    if (path === '/review-queue' && method === 'GET') {
      // What is being held back from this identity, and by which rule. Ids and rules only: the
      // queue explains the decision, it does not smuggle out the content.
      return {
        status: 200,
        body: { as: identity.role, withheld: withheldFor(policy, registry.all(), identity.role, today) },
      };
    }

    if (path === '/publications' && method === 'POST') {
      const body = req.body ?? {};
      try {
        const item = registry.derive(body.source_id, identity, policy);
        return { status: 201, body: { created: item.id, approval_status: item.approval_status, removed: item.removed } };
      } catch (e) {
        if (e instanceof Forbidden) return { status: 403, body: { error: e.message } };
        if (e instanceof Invalid) return { status: 422, body: { error: e.message } };
        throw e;
      }
    }

    const approve = path.match(/^\/documents\/([A-Za-z0-9-]+)\/approval$/);
    if (approve && method === 'POST') {
      const body = req.body ?? {};
      try {
        const item = registry.approve(approve[1], identity, policy, body);
        return { status: 200, body: { approved: item.id, by: item.approved_by, version: item.approved_content_hash } };
      } catch (e) {
        if (e instanceof Forbidden) return { status: 403, body: { error: e.message } };
        if (e instanceof Invalid) return { status: 422, body: { error: e.message } };
        throw e;
      }
    }

    return { status: 404, body: { error: 'no such route' } };
  }

  return { handle, registry, policy, today };
}
