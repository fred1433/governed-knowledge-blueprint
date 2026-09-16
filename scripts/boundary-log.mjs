// Produces logs/access-boundary-test.log: the receipt a reviewer reads instead of taking
// our word for it. Same policy, same registry, same retrieval path as the page.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPolicy, decide } from '../src/policy.mjs';
import { loadRegistry, retrieve, deidentify, approveWithoutDeidentification, containsIdentifier } from '../src/registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'logs');
const policy = loadPolicy();
const registry = loadRegistry();
const roles = Object.keys(policy.roles);
const today = new Date().toISOString().slice(0, 10);
const lines = [];
const log = (s = '') => lines.push(s);

const queries = [
  ...registry.privateIdentifiers,
  'reference customers never confirmed in writing',
  'board deck confidential launch',
  'renewal risk analyst spend',
  'briefing pre-read and rehearsal before the call',
  'magic quadrant readiness evidence',
  'analyst briefing preparation',
  'executive visibility',
  'test search page',
  'lorem ipsum',
];

log(`ACCESS BOUNDARY TEST -- governed knowledge blueprint`);
log(`run at            ${new Date().toISOString()}`);
log(`evaluation date   ${today}`);
log(`policy            policy/policy.yaml  sha256 ${policy.digest}`);
log(`rules             ${policy.rules.map((r) => r.id).join(', ')}`);
log(`roles             ${roles.join(', ')}`);
log(`registry          ${registry.counts.library} public Library rows, ${registry.counts.approved_methods} approved method notes (illustrative), ${registry.counts.analysts} analyst rows (illustrative), ${registry.counts.sales_signals} raw sales signals (illustrative)`);
log(`passages indexed  ${registry.counts.passages}`);
log('');

let pairs = 0;
let hits = 0;
let leaks = 0;
for (const role of roles) {
  for (const query of queries) {
    pairs += 1;
    const results = retrieve(policy, registry.items, { query, role, today, limit: 8 });
    hits += results.length;
    for (const r of results) {
      const found = containsIdentifier(`${r.title} ${r.cited}`, registry.privateIdentifiers);
      if (found.length) {
        leaks += 1;
        log(`LEAK  role=${role} query="${query}" item=${r.itemId} strings=${found.join('|')}`);
      }
    }
  }
}
log(`SWEEP  ${roles.length} roles x ${queries.length} queries = ${pairs} retrievals, ${hits} passages returned, ${leaks} leaks`);
log('');

log('WITHHELD, BY RULE (role = ar_lead, the most privileged reader)');
const byRule = new Map();
for (const item of registry.items) {
  const d = decide(policy, item, 'ar_lead', today);
  if (d.allowed) continue;
  if (!byRule.has(d.rule)) byRule.set(d.rule, []);
  byRule.get(d.rule).push(item.id);
}
for (const rule of policy.rules) {
  const held = byRule.get(rule.id) ?? [];
  log(`  ${rule.id.padEnd(36)} ${String(held.length).padStart(3)} items   ${held.slice(0, 6).join(' ')}${held.length > 6 ? ' ...' : ''}`);
}
log('');

log('THE PRIVATE SIGNAL, STEP BY STEP');
const signal = registry.signals.signals.find((s) => s.id === 'SS-001');
for (const role of roles) {
  const d = decide(policy, registry.items.find((i) => i.id === 'SS-001'), role, today);
  log(`  raw, ${role.padEnd(12)} -> ${d.allowed ? 'ALLOWED' : `withheld by ${d.rule}`}`);
}
const hurried = approveWithoutDeidentification(signal, { reviewer: 'Senior practitioner', review_date: today });
for (const role of roles) {
  const d = decide(policy, hurried, role, today);
  log(`  approved but not de-identified, ${role.padEnd(12)} -> ${d.allowed ? 'ALLOWED' : `withheld by ${d.rule}`}`);
}
const derived = deidentify(signal, { reviewer: 'Senior practitioner', review_date: today, approver: 'Founder and President' });
for (const role of roles) {
  const d = decide(policy, derived, role, today);
  log(`  de-identified and approved (${derived.id}), ${role.padEnd(12)} -> ${d.allowed ? 'ALLOWED' : `withheld by ${d.rule}`}`);
}
log(`  identifiers left in the derived text: ${containsIdentifier(derived.passages[0].text, registry.privateIdentifiers).length}`);
log(`  original row after the approval: approval_status=${registry.items.find((i) => i.id === 'SS-001').approval_status}, confidentiality=${registry.items.find((i) => i.id === 'SS-001').confidentiality}`);
log('');

log('NEGATIVE CONTROL (does the sweep have teeth?)');
const weakened = { ...policy, rules: policy.rules.filter((r) => r.id !== 'R1_CLIENT_PRIVATE_ISOLATION') };
const mislabelled = {
  ...registry.items.find((i) => i.id === 'SS-002'),
  id: 'SS-002-MISLABELLED',
  permission: 'internal',
  approval_status: 'approved',
  contains_client_identifiers: false,
  reviewer: { value: 'Senior practitioner' },
  review_date: { value: today },
  attribution: { value: 'Internal thread' },
};
log('  case: a private row mislabelled as internal, approved, with every other rule satisfied');
const leakedNow = retrieve(weakened, [...registry.items, mislabelled], { query: 'Halden Robotics board deck', role: 'ar_lead', today, limit: 8 });
log(`  with R1_CLIENT_PRIVATE_ISOLATION removed, the same query returns it: ${leakedNow.some((h) => h.itemId === 'SS-002-MISLABELLED')}`);
const stillHeld = retrieve(policy, [...registry.items, mislabelled], { query: 'Halden Robotics board deck', role: 'ar_lead', today, limit: 8 });
log(`  with the real policy, it does not:                                   ${!stillHeld.some((h) => h.itemId === 'SS-002-MISLABELLED')}`);
log('');
log(`RESULT  ${leaks === 0 ? 'PASS' : 'FAIL'}  ${leaks} leak(s) across ${pairs} retrievals`);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'access-boundary-test.log'), lines.join('\n') + '\n', 'utf8');
process.stdout.write(lines.join('\n') + '\n');
if (leaks > 0) process.exit(1);
