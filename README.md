# Governed knowledge system blueprint

A permission-aware knowledge architecture: a content registry, an executable policy, and an access
boundary test that is actually run rather than described.

It was drafted for a senior analyst relations consultancy that wants one question answered before
anything else: how do approved methods, a public Library, templates and analyst expertise become
retrievable by the people who should see them, while raw sales conversations and private client
material never enter shared knowledge at all.

Live walkthrough: **https://forwardar-knowledge.theaipipe.com**

## What is in here

| | |
|---|---|
| [`docs/01-architecture-and-source-map.md`](docs/01-architecture-and-source-map.md) | The system in one diagram, the source map, and what a crawl of the public Library actually found |
| [`docs/02-data-model.md`](docs/02-data-model.md) | Content Registry, Analyst Directory, Sales Signal review queue, Approved Shared Knowledge |
| [`docs/03-taxonomy-and-metadata.md`](docs/03-taxonomy-and-metadata.md) | The four pillars, the seven mandatory fields, and which values a person still has to set |
| [`docs/04-governance-rules.md`](docs/04-governance-rules.md) | Isolation, de-identification, senior approval, retention, exceptions |
| [`docs/05-company-knowledge-connection-plan.md`](docs/05-company-knowledge-connection-plan.md) | ChatGPT Business Company Knowledge: the documented permission model, the connection, the test questions, and the claims this plan refuses to make |
| [`docs/06-implementation-specs.md`](docs/06-implementation-specs.md) | Two specifications with acceptance criteria, one for a Wix and Algolia developer, one for a Monday and Zapier builder |
| [`docs/07-access-boundary-test.md`](docs/07-access-boundary-test.md) | The boundary test, its cases, and its negative control |
| [`policy/policy.yaml`](policy/policy.yaml) | The policy. Not a description of one: the engine reads this file |
| [`schema/schema.sql`](schema/schema.sql) | The schema, with the constraints that refuse an approval without a reviewer |
| [`logs/access-boundary-test.log`](logs/access-boundary-test.log) | The receipt |

## Run it

```bash
npm ci
npm test         # 33 assertions across policy, schema, registry integrity and the boundary test
npm run boundary # rewrites logs/access-boundary-test.log
```

Node 20 or later. One dependency, a YAML parser. No API keys, no model calls, no network access at
any point: retrieval here is an ordinary BM25 index, because the interesting part is which passages
are allowed to reach it.

## The two ideas worth stealing

**The registry decides, the index obeys.** Private material is not filtered out of results, it never
reaches the index. A ranking bug can then make answers worse, never unsafe.

**Isolation is not a permission level.** `client_private` has no reader at all. When a lesson from a
client engagement is worth keeping, a person writes a de-identified derivative and approves that.
The original row keeps its status for ever, and the audit trail is the pair.

## About the data

The 71 rows of the content registry are the public pages of a real Library, crawled from its
published sitemaps with `robots.txt` respected. Everything else, every analyst, every client name,
every sales conversation, is invented for the blueprint and marked `illustrative` in the data files.
A test asserts that nothing invented is presented as real, and another asserts that no private
string appears anywhere in the public rows.

---

Built by [The AI Pipe](https://cal.theaipipe.com).
