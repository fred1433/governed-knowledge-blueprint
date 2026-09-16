// Produces logs/access-boundary-check.log: the receipt.
//
// It records what was run, against which code, which data and which policy, what was expected,
// and what came back. Every number below is measured during this run. Nothing is written in by
// hand, which is the only reason the file is worth reading.
//
// Run: npm run boundary

import { writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startServer } from '../service/server.mjs';
import { loadPolicy } from '../src/policy.mjs';
import { Registry } from '../src/corpus.mjs';
import { withheldFor, publishedFor } from '../src/policy-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const out = [];
const say = (s = '') => out.push(s);

const sh = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unavailable';
  }
};

const QUERIES = [
  'discovery call notes',
  'what did the client say about references',
  'Northwind Grid Systems',
  'Priya Raman',
  'renewal risk pipeline',
  'pricing objection retainer',
  'retainer briefing cycles board deck',
  'analyst briefing pre-read',
  'evidence pack before a submission',
  'analyst coverage data platforms',
  'positioning for analyst mindshare',
  'operating system for analyst relations',
  'confidence curve',
];

const TOKENS = {
  knowledge_reader: 'fixture-knowledge-reader',
  senior_reviewer: 'fixture-senior-reviewer',
};

const policy = loadPolicy();
const registry = new Registry();
const { origin, close } = await startServer({ policy, registry });

const get = async (path, token) => {
  const res = await fetch(`${origin}${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: res.status, raw: await res.text() };
};

const post = async (path, token, body) => {
  const res = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, raw: await res.text() };
};

const step = (label, expected, got) => {
  const ok = expected === got;
  return { label, expected, got, ok };
};

// ---------------------------------------------------------------- header

const dataFiles = readdirSync(join(ROOT, 'data')).filter((f) => f.endsWith('.json')).sort();
const dataDigest = createHash('sha256');
for (const f of dataFiles) dataDigest.update(readFileSync(join(ROOT, 'data', f)));

say('ACCESS BOUNDARY CHECKS  --  approved-knowledge publication boundary');
say('');
say(`run at          ${new Date().toISOString()}`);
say(`evaluated as of ${'2026-09-16'}`);
say(`code revision   ${sh('git', ['rev-parse', '--short', 'HEAD'])}${sh('git', ['status', '--porcelain']) ? '  (working tree has uncommitted changes)' : ''}`);
say(`node            ${process.version}`);
say(`policy          policy/policy.yaml  sha256 ${policy.digest}`);
say(`test data       ${dataFiles.length} files in data/  sha256 ${dataDigest.digest('hex')}`);
say(`command         npm run checks`);
say('');
say('WHAT THE REGISTRY HOLDS');
const kinds = {};
for (const i of registry.all()) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1;
for (const [k, n] of Object.entries(kinds).sort()) {
  const real = k === 'library_article';
  say(`  ${String(n).padStart(2)}  ${k.padEnd(22)} ${real ? 'real content, public pages fetched 2026-09-16' : 'synthetic'}`);
}
say('');

// ---------------------------------------------------------------- the sweep

say('THE SWEEP');
say(`  ${Object.keys(TOKENS).length} identities x ${QUERIES.length} queries, every request over HTTP against the reference service`);
say('  oracle: the raw response body, scanned for every private marker, not only the client names');
say('');

let requests = 0;
let returned = 0;
const markersFound = [];
for (const [role, token] of Object.entries(TOKENS)) {
  for (const q of QUERIES) {
    const r = await get(`/search?q=${encodeURIComponent(q)}`, token);
    requests += 1;
    returned += JSON.parse(r.raw).results.length;
    const hay = r.raw.toLowerCase();
    for (const m of registry.leakMarkers) {
      if (hay.includes(m.toLowerCase())) markersFound.push({ role, q, m });
    }
  }
  // and every private record asked for by name, which is the request that matters most
  for (const id of registry.privateIds) {
    const r = await get(`/documents/${id}`, token);
    requests += 1;
    if (r.status === 200) markersFound.push({ role, q: `direct fetch of ${id}`, m: 'returned 200' });
    const hay = r.raw.toLowerCase();
    for (const m of registry.leakMarkers) if (hay.includes(m.toLowerCase())) markersFound.push({ role, q: id, m });
  }
}
say(`  ${requests} requests, ${returned} results returned, ${markersFound.length} private marker(s) found`);
say('');

say('THE PUBLISHED CORPUS, BY IDENTITY');
for (const role of Object.keys(TOKENS)) {
  const n = publishedFor(policy, registry.all(), role, '2026-09-16').length;
  say(`  ${role.padEnd(18)} ${String(n).padStart(2)} of ${registry.all().length} items`);
}
say('');

say('WITHHELD, BY RULE, FOR EACH IDENTITY');
for (const role of Object.keys(TOKENS)) {
  const held = withheldFor(policy, registry.all(), role, '2026-09-16');
  say(`  ${role}`);
  for (const rule of policy.rules) {
    const rows = held.filter((h) => h.rule === rule.id);
    say(`    ${rule.id.padEnd(30)} ${String(rows.length).padStart(2)}  ${rows.map((r) => r.id).join(' ')}`);
  }
}
say('');

// ---------------------------------------------------------------- the publication path

say('THE PUBLICATION PATH, STEP BY STEP');
say('  one private record, carried to shared knowledge the only way it can be. Every line below');
say('  is a real request, and the code on the right is the one the service answered with.');
say('');

const path = [];
path.push(step('a knowledge reader tries to derive a shareable note from the private record',
  403, (await post('/publications', TOKENS.knowledge_reader, { source_id: 'PR-001' })).status));

const derived = await post('/publications', TOKENS.senior_reviewer, { source_id: 'PR-001' });
const derivedId = JSON.parse(derived.raw).created;
path.push(step('a senior reviewer derives it, which creates a new item', 201, derived.status));

path.push(step(`the new item ${derivedId} is not readable yet, it is waiting for approval`,
  404, (await get(`/documents/${derivedId}`, TOKENS.knowledge_reader)).status));
path.push(step('a knowledge reader tries to approve it',
  403, (await post(`/documents/${derivedId}/approval`, TOKENS.knowledge_reader, { reviewer: 'Founder and President', review_date: '2026-09-16' })).status));
path.push(step('an approval that names no reviewer is refused',
  422, (await post(`/documents/${derivedId}/approval`, TOKENS.senior_reviewer, {})).status));
path.push(step('the private record itself is offered for approval, and refused outright',
  403, (await post('/documents/PR-001/approval', TOKENS.senior_reviewer, { reviewer: 'Founder and President', review_date: '2026-09-16' })).status));
path.push(step('a senior reviewer approves the derived item, naming a reviewer and a date',
  200, (await post(`/documents/${derivedId}/approval`, TOKENS.senior_reviewer, { reviewer: 'Founder and President', review_date: '2026-09-16' })).status));
path.push(step('the derived item is now readable by a knowledge reader',
  200, (await get(`/documents/${derivedId}`, TOKENS.knowledge_reader)).status));
path.push(step('the private original is still refused, to the senior reviewer too',
  404, (await get('/documents/PR-001', TOKENS.senior_reviewer)).status));

const derivedBody = await get(`/documents/${derivedId}`, TOKENS.knowledge_reader);
const leakedInDerived = registry.leakMarkers.filter((m) => derivedBody.raw.toLowerCase().includes(m.toLowerCase()));
const namesOrigin = registry.privateIds.filter((id) => derivedBody.raw.includes(id));

for (const s of path) {
  say(`  ${s.ok ? 'as expected' : 'UNEXPECTED '}  ${String(s.got).padStart(3)} (expected ${s.expected})  ${s.label}`);
}
say('');
say(`  the served derived item contains ${leakedInDerived.length} private marker(s) and names ${namesOrigin.length} private record id(s)`);
say(`  what the reviewer recorded as removed: ${(JSON.parse(derived.raw).removed ?? []).join('; ')}`);
say(`  the original after all of this: confidentiality=${registry.get('PR-001').confidentiality}, approval=${registry.get('PR-001').approval_status}`);
say('');

const pathOk = path.every((s) => s.ok) && leakedInDerived.length === 0 && namesOrigin.length === 0;

await close();

// ---------------------------------------------------------------- the checks

say('THE CHECKS');
say('  each one drives the service over HTTP, with a token, through the routes a client uses');
const testFiles = readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort()
  .map((f) => join('tests', f));
const checks = spawnSync(process.execPath, ['--test', ...testFiles], { cwd: ROOT, encoding: 'utf8' });
const pass = (checks.stdout.match(/pass (\d+)/) ?? [])[1] ?? '?';
const fail = (checks.stdout.match(/fail (\d+)/) ?? [])[1] ?? '?';
say(`  ${pass} passed, ${fail} failed`);
say('');

// ---------------------------------------------------------------- negative control

say('THE NEGATIVE CONTROL');
say('  each guard is switched off in turn; a guard whose removal nothing notices is decoration');
const neg = spawnSync(process.execPath, ['scripts/negative-control.mjs'], { cwd: ROOT, encoding: 'utf8' });
for (const line of neg.stdout.split('\n')) {
  if (/^(CAUGHT|MISSED)/.test(line)) say(`  ${line}`);
}
const negOk = neg.status === 0;
say(`  ${negOk ? 'every guard is load bearing' : 'AT LEAST ONE GUARD IS NOT EXERCISED'}`);
say('');

// ---------------------------------------------------------------- what this does not show

say('WHAT THIS RUN DOES NOT SHOW');
say('  It exercises the reference controls in this repository. It says nothing about any real');
say('  workspace. The connection to a live assistant, the real identities, the real sources and');
say('  the real document store all still have to be accepted in place, with separate accounts.');
say('  Whether a de-identification is good enough stays a human judgement: the machine floor here');
say('  is a string check against a list it was given.');
say('');

const ok = markersFound.length === 0 && fail === '0' && negOk && pathOk;
say(`RESULT  ${ok ? 'PASS' : 'FAIL'}  ${markersFound.length} leak(s) across ${requests} requests, ${fail} failed check(s), publication path ${pathOk ? 'behaved as expected' : 'DID NOT behave as expected'}, negative control ${negOk ? 'passed' : 'failed'}`);

mkdirSync(join(ROOT, 'logs'), { recursive: true });
writeFileSync(join(ROOT, 'logs', 'access-boundary-check.log'), out.join('\n') + '\n', 'utf8');
console.log(out.join('\n'));
if (!ok) process.exit(1);
