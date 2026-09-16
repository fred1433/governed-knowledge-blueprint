# 3. Taxonomy and mandatory metadata

## The taxonomy is already yours

The Library publishes four pillars. The sample uses them exactly as they appear, two articles
under each, and adds nothing:

- Forward Leadership & Executive Influence
- Forward Strategy & Market Positioning
- Influence Mechanics (Briefings & Evaluations)
- Program Excellence (Ops & Delivery)

An editorial structure that already exists and that people already use is worth more than a
cleaner one invented by an outsider. The work is not to design a taxonomy. It is to carry the
editorial judgement the Library already applies across a boundary where no editor is watching.

## The seven mandatory fields

Source, attribution, permission, confidentiality, owner, reviewer, review date.

The first four are properties of the item and can usually be derived. The last three are decisions,
and nobody outside Forward can make them.

## Unknown is a stop, not a warning

This is the one place where the obvious design is wrong.

The obvious design records a missing owner as "to be confirmed", publishes the item, and shows a
badge somewhere. The badge is never read, the queue of things to confirm grows, and within a
quarter the system's answer to "who is accountable for this" is a list nobody has looked at.

So: **an item with an unknown owner, reviewer, review date or attribution is not published.** It
is not degraded, not flagged, not published with a warning. The rule is `R2_REQUIRED_METADATA_UNKNOWN`
and it is enforced on the server, for every identity, on both retrieval paths.

The consequence is deliberate and worth saying out loud: **being published on your public website
does not make something approved shared knowledge.** Those are two different acts. The first is
editorial. The second says someone is accountable for the item being current when an assistant
quotes it to a colleague.

### What that rule does to the eight sampled articles

Five carry a synthetic governance decision, so they publish. Three do not, and the reason is not
arbitrary: on those three the title in the listing and the heading on the page disagree, one of
them by a spelling difference. When a system cannot say what an item is called, it has no business
saying who owns it. Those three stay held, and the receipt names them.

The five that publish carry placeholder values in `data/governance-decisions.json`, marked
synthetic in the file and served as synthetic to the reader. They are the shape of a decision, not
a decision. A check fails if any governance value on a real article is presented as anything other
than unknown or synthetic.

## What the fetched pages showed about metadata

Computed from the eight pages, and recomputed every time the checks run:

| What was found | On how many | Why it matters here |
|---|---|---|
| Title tag with an empty segment between two separators | 8 of 8 | Whatever indexes the title stores a fragment. |
| The first prose block after the summary is a practitioner biography | 8 of 8 | An ingestion step that keeps the opening chunk indexes a biography under the article's title. |
| Listing title and page heading disagree | 3 of 8 | Two tools will disagree about the identity of one item. |
| Meta description byte-identical to another article | 2 of 8 | Two pages hand an index the same summary, and a ranker cannot tell them apart. |

The first two are the ones that would quietly ruin retrieval quality, and neither is visible to a
reader of the site. They are visible to a registry, which is the argument for having one.

## Attribution, and why it is mandatory rather than nice

An answer that carries a source a reader can open is checkable. An answer that does not is a
rumour with good formatting. Attribution is in the required set for that reason, and an item
without it is withheld by the same rule that withholds an item without an owner.

## What remains open

Every real value. Who owns which pillar, who reviews, how often a review date has to be refreshed
to stay inside the retention window, and whether eighteen months is the right window at all.
Eighteen is a placeholder chosen so the rule could be exercised, and one sample item is deliberately
outside it so the expiry can be watched happening.
