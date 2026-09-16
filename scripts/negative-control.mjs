// The negative control.
//
// A check suite that stays green when a control is removed is not evidence of anything. This
// script switches off one guard at a time and requires the suite to go red. If a guard can be
// taken out and every check still passes, that guard is decoration, and this script fails the
// build so that nobody finds out later.
//
// Run: npm run negative-control

import { spawnSync } from 'node:child_process';
import { loadPolicy } from '../src/policy.mjs';

const policy = loadPolicy(undefined, { neutralise: undefined });
const rules = policy.rules.map((r) => r.id);

console.log('NEGATIVE CONTROL');
console.log(`policy   ${policy.policy_name}, sha256 ${policy.digest}`);
console.log(`guards   ${rules.length}`);
console.log('expectation: with any one of them removed, the check suite fails\n');

const results = [];
for (const rule of rules) {
  const run = spawnSync(process.execPath, ['--test', 'tests/boundary.test.mjs'], {
    env: { ...process.env, BLUEPRINT_NEUTRALISE_RULE: rule },
    encoding: 'utf8',
  });
  const failed = run.status !== 0;
  const failCount = (run.stdout.match(/fail (\d+)/) ?? [])[1] ?? (failed ? 'some' : '0');
  results.push({ rule, failed, failCount });
  console.log(`${failed ? 'CAUGHT ' : 'MISSED '} ${rule.padEnd(32)} ${failed ? `${failCount} check(s) went red` : 'the suite stayed green'}`);
}

const missed = results.filter((r) => !r.failed);
console.log('');
if (missed.length) {
  console.log(`RESULT  FAIL  ${missed.length} guard(s) can be removed without any check noticing:`);
  for (const m of missed) console.log(`  ${m.rule}`);
  console.log('Either the guard does nothing, or nothing exercises it. Both have to be fixed.');
  process.exit(1);
}
console.log(`RESULT  PASS  all ${rules.length} guards are load bearing`);
