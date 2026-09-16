# 1. Knowledge architecture and source map

Drafted 16 September 2026 for Forward AR Experts. Everything about the public Library in this
document was measured, not assumed: the figures come from a crawl of the published sitemaps on
16 September 2026, at a human pace, with `robots.txt` respected. Nothing private was touched.

## 1.1 The shape of the system

```
  SOURCES                      CONTENT REGISTRY              APPROVAL            SHARED KNOWLEDGE           ASSISTANT
  ────────                     ────────────────              ────────            ────────────────           ─────────
  Wix Library (public)   ─┐                                                                              
  Approved documents     ─┼──▶  one row per item       ──▶   senior          ──▶  approved items only ──▶  Company Knowledge
  Analyst Directory      ─┤     seven mandatory              reviewer             published into the       reads the synced
  Monday work board      ─┘     metadata fields               names it,           one synced folder        folder, cites the
                                permission +                  dates it                                     source document
  ─────────────────────────────────────────────────────────────────────────────
  Sales conversations           registered, never released. A derived, de-identified
  Private client material  ───▶ method note can be created and approved. The raw row
                                stays where it is and is never promoted, never copied,
                                never connected.
```

Two sentences carry the whole design:

1. **The registry decides, the index obeys.** Retrieval never filters private material out of
   its results. Private material never reaches the index in the first place, because the gate runs
   before indexing. A ranking bug can then make results worse, never unsafe.
2. **Isolation is not a permission level.** `client_private` has no reader at all in shared
   knowledge. There is no role, no seniority, no override that reads it there. When a lesson from a
   client engagement is worth keeping, a person writes a de-identified derivative and approves that
   instead. The original never moves.

## 1.2 Source map

| Source | What it holds | Status today | Role in the target system |
|---|---|---|---|
| Wix Library, public site | 71 published pages, 4 pillars, about 47 300 words | Live, measured 16 Sep 2026 | The public layer of shared knowledge. Registered, mostly approvable as is. |
| Algolia index | Search over the Library | Named in the plan. Not detectable in the public HTML today: 0 occurrences of `algolia` across the 71 pages fetched | Becomes the public search surface. The registry decides what is fed to it. |
| Monday.com | The operating system for work, and where sales signals live | Described, not inspected here | Two scopes, never one: an operational scope that can feed the registry, and a private scope that is never connected to anything. |
| Analyst Directory | Analysts, coverage, cadence, history | Described, not inspected here | Internal permission. Approved rows only. |
| Approved document storage | Methods, templates, playbooks | To be chosen (see document 5) | The publication target. This is the only place a connected assistant reads. |
| ChatGPT Business, Company Knowledge | The assistant surface | Business plan feature, see document 5 | Reads the synced folder. It enforces the source's permissions. It does not add a permission model of its own. |

## 1.3 What the crawl found in the Library

71 pages, all HTTP 200. 532 passages extracted for retrieval, after the registry strips what does not belong in a knowledge index: contact details, phone numbers, published prices, and staffing copy. Four pillars, as published on
`/library`:

| Pillar | Pages listed |
|---|---|
| Forward Leadership and Executive Influence | 8 |
| Forward Strategy and Market Positioning | 11 |
| Program Excellence (Ops and Delivery) | 9 |
| Influence Mechanics (Briefings and Evaluations) | 10 |
| Not listed under any pillar (service, index and policy pages) | 33 |

The registry approves 36 of the 71 rows for shared knowledge on the evidence available, and holds
35 for a human decision. The ones it holds are not errors, they are questions with a named reason.
Ten of them are worth seeing before anything is connected to an assistant:

| Row | Page | What the registry saw |
|---|---|---|
| LIB-016 | `/blank` | Titled "New Page", 6 words, live in the sitemap |
| LIB-017 | `/blank-3` | Titled "Test search page", 10 words, live in the sitemap |
| LIB-025 | `/blogs/test-blog-testingg-wixtesting-lorem-ipsum` | A test blog entry, live in the sitemap |
| LIB-009 | `/ar-insights-1` | Titled "Copy of Forward AR Insights", a duplicate of `/ar-insights` |
| LIB-014, LIB-015 | `/ar-through-insights`, `/ar-through-insights-2` | Two live pages sharing one title |
| LIB-024, LIB-059 | `/blogs/ar-strategy-%26-market-positioning-series`, `/post/ar-strategy-market-positioning-series` | Same title on a category page and a post |
| LIB-001 | `/` | The browser title ends in the Wix default site name, "My Site 1" |
| LIB-071 | `/why-senior-only` | Browser title reads "About Us" followed by the same default site name, over 1 000 words of real content |

Plus, across the whole site: 11 pages with no meta description, and 6 pages under 60 words.

None of this is a criticism of the Library. It is the ordinary residue of a site that is being
built, and it is exactly what a registry is for: an assistant that indexes a site wholesale will
answer from "Test search page" and from "Copy of Forward AR Insights" with a straight face, and
will cite them. The registry holds them until a person decides, and the decision is recorded.

## 1.4 The confidentiality boundary, drawn once

```
   PUBLIC                          INTERNAL                         CLIENT PRIVATE
   already on the web              approved shared knowledge        raw sales conversations
   Library pages                   methods, templates               client materials and decks
   public posts                    analyst directory rows           anything naming a client
   ──────────────────────          ──────────────────────           ──────────────────────
   contributor: yes                contributor: no                  nobody, through this system
   AR lead:     yes                AR lead:     yes                 nobody, through this system
   assistant:   yes                assistant:   yes, via the        never connected, never synced,
                                   synced folder                    never indexed
```

The boundary is enforced in three independent places, so that no single mistake opens it:

1. **Source scope.** The private Monday boards and the sales inbox are not connected to the
   assistant at all. What is not connected cannot be retrieved.
2. **Registry rule.** `R1_CLIENT_PRIVATE_ISOLATION` withholds any row marked `client_private`
   for every role, even if that row has been approved by mistake. See `policy/policy.yaml`.
3. **Publication.** Only approved rows are copied into the synced folder that the assistant reads.
   The folder is the only door, and the registry is the only key holder.

Document 7 and `logs/access-boundary-test.log` show those three being exercised, including the
case where the second one is removed and the leak appears.

## 1.5 What this architecture does not do

- It does not stop a person from opening a private board themselves. Source permissions do that.
- It does not make an assistant forget something it was already allowed to read in the source
  application. That is why the isolation is at the source and at the connector, not in a prompt.
- It does not approve anything. A senior reviewer does, and the registry refuses to act until
  they have.
