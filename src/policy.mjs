// Loading side of the policy: read the YAML, check that every rule it declares is actually
// implemented, and re-export the pure engine unchanged.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { PREDICATES } from './policy-core.mjs';

export * from './policy-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const POLICY_PATH = join(HERE, '..', 'policy', 'policy.yaml');

/**
 * BLUEPRINT_NEUTRALISE_RULE exists for one purpose: scripts/negative-control.mjs switches a
 * guard off and requires the check suite to go red. A suite that stays green when a control is
 * removed is not evidence of anything. The affordance is loud on purpose, and a check asserts
 * that an ordinary run loads every rule.
 */
export function loadPolicy(path = POLICY_PATH, { neutralise = process.env.BLUEPRINT_NEUTRALISE_RULE } = {}) {
  const raw = readFileSync(path, 'utf8');
  const policy = parse(raw);
  policy.digest = createHash('sha256').update(raw).digest('hex');

  for (const rule of policy.rules) {
    if (!PREDICATES[rule.predicate]) {
      throw new Error(`policy.yaml declares ${rule.id} with unimplemented predicate "${rule.predicate}"`);
    }
  }
  const ids = policy.rules.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error('policy.yaml has duplicate rule ids');

  policy.neutralised = null;
  if (neutralise) {
    if (!ids.includes(neutralise)) throw new Error(`cannot neutralise unknown rule ${neutralise}`);
    process.emitWarning(`POLICY GUARD NEUTRALISED: ${neutralise}. This is the negative control, never a normal run.`);
    policy.rules = policy.rules.filter((r) => r.id !== neutralise);
    policy.neutralised = neutralise;
  }
  return policy;
}
