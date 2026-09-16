// A small BM25 index over passages. No dependency, no service, no model call.
//
// It matters that retrieval is ordinary and boring: the access boundary is enforced by the
// registry before anything reaches the index, not by hoping a ranker never surfaces a
// private passage. The same module runs in the page, in the tests, and in the boundary log.

const STOP = new Set(
  'a an the and or but if of to in on for with without by at from as is are was were be been being it its this that these those we our you your they their he she his her not no do does did can could should would will may might more most than then them there here what which who whom how why when where all any some such own same so too very just about into over under again further once'.split(' '),
);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function buildIndex(docs) {
  const postings = new Map();
  const lengths = [];
  docs.forEach((doc, i) => {
    const terms = tokenize(`${doc.title ?? ''} ${doc.text}`);
    lengths[i] = terms.length || 1;
    const counts = new Map();
    for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [t, c] of counts) {
      if (!postings.has(t)) postings.set(t, []);
      postings.get(t).push([i, c]);
    }
  });
  const avg = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  return { docs, postings, lengths, avg, N: docs.length };
}

export function search(index, query, limit = 5) {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const k1 = 1.4;
  const b = 0.72;
  const scores = new Map();
  for (const t of terms) {
    const posting = index.postings.get(t);
    if (!posting) continue;
    const idf = Math.log(1 + (index.N - posting.length + 0.5) / (posting.length + 0.5));
    for (const [i, c] of posting) {
      const norm = c * (k1 + 1) / (c + k1 * (1 - b + (b * index.lengths[i]) / index.avg));
      scores.set(i, (scores.get(i) ?? 0) + idf * norm);
    }
  }
  return [...scores.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([i, score]) => ({ ...index.docs[i], score: Math.round(score * 1000) / 1000 }));
}

/** The sentence a citation points at: the part of the passage the query actually matched. */
export function citedSentence(text, query) {
  const terms = new Set(tokenize(query));
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  let best = sentences[0] ?? text;
  let bestHits = -1;
  for (const s of sentences) {
    const hits = tokenize(s).filter((t) => terms.has(t)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = s;
    }
  }
  return best.trim();
}
