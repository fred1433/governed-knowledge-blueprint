# Approved-knowledge publication boundary

An architecture sample: how approved methods, public Library content, templates and analyst
expertise become retrievable by the people who should see them, while raw sales conversations and
private client material never enter shared knowledge at all.

It was drafted for a senior analyst relations consultancy. It uses eight articles from their public
Library as real content, and invented records for everything private. **Their internal systems are
not connected to anything here.**

Walkthrough: **https://forwardar-knowledge.theaipipe.com**

## Run it

```bash
npm ci
npm run checks     # the checks over HTTP, the negative control, then the receipt
```

Node 20 or later. One dependency, a YAML parser. No API keys, no model calls, no network access at
any point.

The receipt lands in [`logs/access-boundary-check.log`](logs/access-boundary-check.log): the code
revision, the policy digest, a digest of the test data, the command, what was expected, what came
back. The same run happens in CI on every push.

## The three ideas worth taking

**The registry decides, the index obeys.** Private material is not filtered out of results, it
never reaches the index. The policy selects the corpus for the authenticated identity on the
server, and only that corpus is indexed and only that corpus can be fetched by id. A ranking bug
can then make answers worse; it cannot make them unsafe.

**Isolation is not a permission level.** `client_private` has no reader at all. When a lesson from
an engagement is worth keeping, a person writes a separate de-identified item and approves *that*.
The original keeps its confidentiality before and after, and the link between the two is not served
to readers.

**A guard nothing notices the loss of is decoration.** `npm run negative-control` switches off each
rule in turn and requires the checks to go red. All eight are load bearing.

## What is in here

| | |
|---|---|
| [`docs/01`](docs/01-architecture-and-source-map.md) | The decision: where truth lives, what may publish, what may only propose. Plus the source map and what a fetch of eight public pages actually found |
| [`docs/02`](docs/02-data-model.md) | Content Registry, Analyst Directory, private review queue, Approved Shared Knowledge |
| [`docs/03`](docs/03-taxonomy-and-metadata.md) | The four pillars, the seven mandatory fields, and why unknown is a stop rather than a warning |
| [`docs/04`](docs/04-governance-rules.md) | Isolation, de-identification, senior approval, retention, exceptions |
| [`docs/05`](docs/05-company-knowledge-connection-plan.md) | ChatGPT Business Company Knowledge: the documented permission model, the connection, the acceptance test, and the claims this plan refuses to make |
| [`docs/06`](docs/06-implementation-specs.md) | Two exchange contracts with acceptance criteria, one per builder |
| [`docs/07`](docs/07-access-boundary-test.md) | The checks, the oracle, the negative control |
| [`policy/policy.yaml`](policy/policy.yaml) | The policy. Not a description of one: the engine loads this file |
| [`schema/schema.sql`](schema/schema.sql) | The constraints, expressed where they are unambiguous |
| [`service/`](service/) | The reference service. Authorisation happens here, on the server |

## Coverage, against the seven deliverables

Seven headings, so it is clear what has been shown and what has not. This is a sample built before
any conversation, not seven pieces of work delivered.

| Deliverable | Shown here | Still open |
|---|---|---|
| 1. Architecture and source map | The decision and its reasons; sources labelled observed, stated or proposed; findings from eight real pages | The private systems, seen only as described |
| 2. Data model | Four registers, one shape, approval as a row bound to a version | Real identifiers and field names |
| 3. Taxonomy and metadata | Your four pillars used as published; unknown treated as blocking; metadata defects computed from the real pages | Owners, reviewers, review dates: yours to decide |
| 4. Governance rules | Eight rules, executable, each one exercised and each one load bearing | The real approval authority, the retention window, the escalation path |
| 5. Company Knowledge plan | The documented permission model, quoted with URLs; the connection; an acceptance test for your workspace | Which document store; the propagation delay, measured; which apps are already enabled |
| 6. Implementation specs | Two exchange contracts with criteria a third party can check | The systems they map onto, unseen |
| 7. Build review | The method, and the boundary checks run against a reference implementation | The review of your build. Not done, and not doable: there is nothing built yet to review |

## About the data

The eight Library articles are real: fetched once from the public pages on 16 September 2026, one
request each, no crawl of the rest of the site. Each row keeps the title, the URL, the observed
pillar, the visible attribution and one short quoted extract, with a link back. The articles
themselves stay on their site.

Everything else is invented and marked synthetic in the data files and in every response. A check
fails if anything invented is presented as real, and another fails if any invented string reaches
the file holding the real content.

The brief states Wix and Algolia behind the Library. This sample verifies neither and records no
finding about either.

---

Built by [The AI Pipe](https://cal.theaipipe.com).
