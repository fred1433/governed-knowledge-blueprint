# 6. Implementation handoff

Two exchange contracts, one per builder already in place. Each is short on purpose: a
specification a builder cannot argue with is a specification nobody can be held to. What follows
is the interface, the criteria that can be checked by someone who did not write the code, and the
failure modes worth naming before they happen.

## 6.1 For the site and search developer

**What you are asked for:** a stable, machine-readable export of the Library. Not a redesign, not a
new search experience, and no change visible to a reader of the site.

**The contract**

| Field | Rule |
|---|---|
| `id` | Stable across edits. Renaming the article or its URL does not change it. |
| `url`, `title`, `pillar` | As published. If the listing title and the page heading differ, export both and mark the item as unresolved rather than picking one. |
| `body` | The article text, with page furniture removed: navigation, calls to action, and the practitioner biography block. |
| `attribution` | As published. |
| `updated_at` | Changes when the content changes, and only then. |
| `content_hash` | Hash of title and body. This is what an approval is bound to. |
| `deleted` | Present in the feed, marked deleted. Absence is not deletion. |

**Acceptance criteria, all checkable by a third party**

1. Fetch twice with no edit in between: byte-identical, same hashes.
2. Edit one article: exactly one `content_hash` changes and `updated_at` moves.
3. Rename an article and change its URL: the `id` does not change.
4. Unpublish an article: it appears with `deleted` true. It does not simply vanish.
5. Replay the same export twice into the registry: no duplicates created.
6. Every item has an `id`, a `url`, a `content_hash` and an `updated_at`. An item missing any of
   them is rejected by the registry with a named reason, not silently skipped.
7. The body of an exported item contains none of the furniture listed above. The sample shows why:
   on all eight pages examined, the first prose block after the summary is a biography rather than
   the article.

**Known failure modes.** Two pages sharing a meta description. Titles carrying an empty segment
between separators. A listing title that differs from the page heading. All three were observed on
the eight pages sampled, and the registry treats the third as blocking rather than cosmetic.

**What is stated but not verified:** the brief names Wix and Algolia. Nothing here confirms either.
Confirm the search back end before any of this is scheduled.

## 6.2 For the operations and automation builder

**What you are asked for:** move items through the workflow and publish approved ones. Not decide
anything.

**The boundary, stated first because it is the whole point:** the automation may create a review
task, attach metadata, notify a reviewer, and publish an item once an approval exists. **It may
not record the approval.** An approval names the human identity that gave it, and an automation
that can satisfy the rule it is supposed to enforce makes the rule decorative.

**The contract**

| Operation | Rule |
|---|---|
| `propose(item)` | Creates a review task. Never sets approval. |
| `publish(item)` | Refuses unless an approval row exists for this exact `content_hash`. |
| `withdraw(item)` | Removes the published document and records the time. |
| Private spaces | Out of scope entirely. The automation is not given access to them. |

**Acceptance criteria**

1. Attempt `publish` on an item with no approval: refused, with a reason, and it is visible that it
   was refused.
2. Attempt `publish` on an item edited after approval: refused. The hash is the test.
3. Attempt to write an approval from the automation's own credentials: refused by the service.
4. Replay the same event twice: one published document, not two.
5. Deliver an event out of order: the later version wins, and the earlier one does not overwrite it.
6. `withdraw` removes the published document the same day, and the run records how long the
   downstream assistant took to stop citing it. That number is measured, not assumed.
7. The automation's credentials cannot read any private space. Demonstrated by trying.
8. A publish failure raises. Silent failure is the one outcome that must not be possible: an item
   believed published and not published is worse than an item nobody published.

**On tooling.** These criteria are deliberately independent of which automation tool is used. They
are as checkable in an existing operational tool as in bespoke code.

## 6.3 What both builders need from Forward first

None of this can start without four decisions that are not a builder's to make:

1. Which document store holds approved items, and who administers its connection.
2. Who the senior reviewer is, and who covers when they are unavailable.
3. Owner, reviewer and review date for each pillar, or a rule that assigns them.
4. The retention window, and whether eighteen months is right.

## What remains open

The systems these map onto have not been seen. Identifiers, field names and event shapes will
change once they have been. The contracts above are written so that the criteria survive that:
they constrain behaviour, not field names.
