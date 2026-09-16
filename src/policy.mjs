// Loading side of the policy: read the YAML, check that every rule it declares is actually
// implemented, and expose the pure engine from ./policy-core.mjs unchanged.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { PREDICATES } from './policy-core.mjs';

export { PREDICATES, decide, shareable, withheld, exceptionFor } from './policy-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const POLICY_PATH = join(HERE, '..', 'policy', 'policy.yaml');

export function loadPolicy(path = POLICY_PATH) {
  const raw = readFileSync(path, 'utf8');
  const policy = parse(raw);
  policy.digest = createHash('sha256').update(raw).digest('hex');
  for (const rule of policy.rules) {
    if (!PREDICATES[rule.predicate]) {
      throw new Error(`policy.yaml declares rule ${rule.id} with unknown predicate "${rule.predicate}"`);
    }
  }
  const ids = policy.rules.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error('policy.yaml has duplicate rule ids');
  return policy;
}
