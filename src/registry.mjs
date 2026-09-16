// The Content Registry: one shape for every source, so one gate can govern all of them.
//
// Public Library rows come from a crawl of forwardarexperts.com. Internal rows, analyst
// rows and sales signals are illustrative and carry illustrative: true. Nothing here is
// private client data: the private rows are invented so the boundary test has something
// to try to leak.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export { deidentify, approveWithoutDeidentification, containsIdentifier, retrieve, explainWithheld } from './registry-core.mjs';

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

