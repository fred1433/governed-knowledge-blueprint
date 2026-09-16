# 1. Architecture decision and source map

## What this document decides

Where the source of truth for approved knowledge lives, which component may publish, which one
may only propose, and why that separation rather than pointing an assistant at the operational
systems and filtering afterwards.

## The source map, with each source labelled by how well it is known

Nothing below is guessed. Each line says whether it was observed, stated in the brief, or
proposed here.

| Source | Status | What is known |
|---|---|---|
| Public Library on forwardarexperts.com | **observed** | Eight articles were fetched on 16 September 2026, two under each of the four pillars. Titles, URLs, pillars, title tags, meta descriptions and one short extract each are in `data/library-sample.json`. |
| Wix and Algolia behind that Library | **stated** | The brief names both. This sample does not verify either, and records no finding about them. Anything the implementation assumes about the search back end has to be confirmed first. |
| Operational boards and a private sales space | **stated** | Described, never seen. The private records here are invented so the controls have something to be tested against. |
| Analyst directory | **stated** | Described. No directory of assumed people is filled in here. Two placeholder entries exist so the audience rule has something internal to hold. |
| Approved document store | **proposed** | The brief does not say which one is in use. This architecture requires one and deliberately does not choose it. |
| ChatGPT Business Company Knowledge | **observed in documentation** | The behaviour asserted in document 5 is quoted from OpenAI help articles, read on 16 September 2026, with their URLs. |

### What the eight public pages actually showed

These are computed from the fetched pages, not asserted, and the same computation runs in the
checks:

- All eight title tags carry an empty segment between two separators, so anything that indexes
  the title stores a fragment.
- On all eight, the first prose block after the summary is a practitioner biography rather than
  the article. An ingestion step that keeps the opening chunk indexes a biography under the
  article's title.
- Two articles carry a byte-identical meta description, so two different pages hand an index the
  same summary.
- On three articles the title in the listing does not appear verbatim on the page, one of them
  through a spelling difference. The listing and the page disagree about the name of the same item.

None of this is a criticism of the Library. It is the ordinary state of a site that was built to
be read by people, and it is the reason a registry sits between the site and any assistant: an
identifier, a title and an owner have to be decided once, by a person, rather than inferred
differently by every tool that reads the page.

## The decision

```
  PRIVATE SPACE                          SHARED KNOWLEDGE
  ----------------------------------     ------------------------------------------
  private records                         content registry
  client material                            |  identity, owner, reviewer, review
  raw conversations                          |  date, attribution, audience, version
        |                                    |
        |  a person writes a NEW,             |  approval, by a senior reviewer,
        |  de-identified item                 |  bound to one version
        |  ------------------------------->   |
        |                                     v
  the original never moves,              approved items only
  never changes status,                        |
  never becomes retrievable                    |  publish
                                               v
                                        the approved document store
                                               |
                                               |  connect only this scope
                                               v
                                        the assistant, which cites back
```

Four decisions, each with its reason.

**1. The registry is the source of truth for what may be published, and it is not the place the
work happens.** The operational boards stay where they are. The registry holds one row per item
with its identity, its owner, its reviewer, its review date, its audience and a hash of the
version that was approved. The reason is drift: the moment two systems both decide what is
approved, they disagree, and the disagreement is discovered by an assistant answering a question.

**2. Only the publication step may publish. Every other component may propose.** An automation
can move an item into the queue, attach metadata, notify a reviewer, and publish once approval
exists. It cannot record the approval itself. This is the one place where a convenient shortcut
does the most damage, because an automation that can approve its own proposals makes the whole
chain decorative.

**3. A derived item is a new object, and the original stays excluded for ever.** Private material
is never promoted, never relabelled, never made retrievable to a sufficiently privileged reader.
When a lesson from an engagement is worth keeping, someone writes a separate de-identified item
and approves that. The audit trail is the pair, and it is not served to readers. Consequence worth
stating plainly: there is no permission level that reveals a private record. `client_private` has
no reader anywhere in this system.

**4. Publish to a document store and connect that scope, rather than connecting the operational
systems and filtering afterwards.** Filtering after connection means the sensitive material is in
reach and something is expected to hide it every time. Publishing means the material was never in
reach. Which document store is Forward's to choose; document 5 explains what it has to support
and refuses to assume the answer.

## What this architecture does not do

- It does not decide which document store, which identity provider, or which automation tool.
- It does not replace the Library's search, and it proposes no change to the public site.
- It does not claim a control over the assistant. What it controls is what the assistant is
  allowed to be pointed at. Document 5 is explicit about where that line falls.
- It has not been connected to anything at Forward. Every figure in the receipt comes from a local
  reference implementation run against eight public pages and invented private records.
