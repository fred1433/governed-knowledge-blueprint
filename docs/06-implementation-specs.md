# 6. Implementation specifications and acceptance criteria

Two short specifications, written to be handed to the people already doing the work. Each one is
scoped so that it can be accepted or rejected on evidence, by someone who is not the person who
built it.

A general rule for both: **no specification here asks anyone to connect a private source to
anything.** If a task seems to need that, it is the wrong task.

---

## Specification A: Wix and Algolia developer

### A.1 Scope

Give the Library a search surface that indexes only what the registry has approved, and make every
result carry the metadata a citation needs.

### A.2 Inputs

A JSON feed of approved public items, one object per item, with: `id`, `title`, `url`, `pillar`,
`content_type`, `attribution`, `owner`, `reviewer`, `review_date`, `source_last_modified`,
`summary`, `passages[]`. The shape is `data/content-registry.json` in this repository, filtered to
`approval_status = approved` and `permission = public`. 36 of the 71 published pages qualify today.

### A.3 Work

1. Publish the feed from the registry. It is generated, never hand-edited.
2. Index it into Algolia with `id` as the object id, and the pillar, content type, review date and
   attribution as facets.
3. Delete from the index anything not present in the feed on each run. An item that leaves the feed
   has been withdrawn, and withdrawal has to be as reliable as publication.
4. Build the Library search page against the index: query, pillar facet, result cards showing
   title, pillar, the matched passage, the attribution and the review date.
5. Log every query and the ids returned, so the retrieval log in `schema/schema.sql` has something
   to hold.

### A.4 Acceptance criteria

| # | Criterion | How it is checked |
|---|---|---|
| A1 | Only approved public items are indexed | Compare the index object count with the feed. They are equal, and no id outside the feed exists in the index |
| A2 | The three live pages flagged `not_intended_as_knowledge` are absent | Search "test search page", "lorem ipsum", "new page". Zero results |
| A3 | `/ar-insights-1` ("Copy of ...") is absent until a person decides | Search its title, confirm absent, confirm a registry row explains why |
| A4 | Withdrawal works | Remove one item from the feed, re-run, confirm it disappears from the index within one run |
| A5 | Every result carries attribution and review date | Inspect ten random results. Any missing field is a failure, not a cosmetic issue |
| A6 | No private or internal item is reachable | The index receives only the public approved feed. Grep the exported index for the private register in `data/sales-signals.json`. Zero hits |
| A7 | Search latency under 300 ms at the 95th percentile | Algolia analytics |
| A8 | The public site reveals no search API key with write access | Only a search-only key is in client code |

### A.5 Out of scope

Redesigning the Library. Changing the four pillars. Anything touching client material.

---

## Specification B: Monday.com and Zapier builder

### B.1 Scope

Make Monday the place where knowledge is registered, reviewed and approved, with the private
boards structurally separate from anything that is ever connected to an assistant.

### B.2 Boards

1. **Content Registry** board. One item per row, with the columns of `schema/schema.sql`:
   source, source reference, pillar, content type, attribution, permission, confidentiality, owner,
   reviewer, review date, approval status, review reason, contains client identifiers.
2. **Sales Signal review queue** board, on a **separate workspace** with its own membership. Raw
   signals arrive here and never leave. Columns: captured at, raw text, in queue, de-identified
   draft, what was removed, target pillar, decision.
3. **Analyst Directory** board. Internal permission. No column, anywhere, that names a client.

### B.3 Automations

1. New approved item in the Content Registry, permission public, approval approved, reviewer and
   review date set, to the public feed of specification A.
2. New approved item, permission internal, to the published file in the synced folder of document 5,
   with the front matter block: registry id, pillar, owner, reviewer, review date, source.
3. Approval of a de-identified draft **creates a new row** in the Content Registry and leaves the
   signal row untouched. Nothing moves the signal row between boards.
4. Review date older than 18 months, item is unapproved and the owner is notified. This automation
   must run whether or not anyone is looking.
5. Any row where approval is set to approved while reviewer or review date is empty is set back and
   the setter is notified.

### B.4 Acceptance criteria

| # | Criterion | How it is checked |
|---|---|---|
| B1 | The review queue lives in a separate workspace, and the members of the shared workspace are not members of it | Read the member list of both. Screenshot it |
| B2 | No automation reads the raw text column of a signal and writes it anywhere outside its own board | Review every automation's field list, one by one |
| B3 | Approval without a reviewer and a date is impossible | Try it. The row comes back unapproved |
| B4 | De-identified approval creates a second row | Approve the sample signal. Two rows exist afterwards, the original unchanged |
| B5 | A de-identified draft that still contains a name from the private register is refused | Try it with the client name left in. It is refused, and the reviewer is told which string was found |
| B6 | Retention runs unattended | Set a review date to 19 months ago, wait for the scheduled run, confirm the item is unapproved |
| B7 | Nothing in any connected Zapier step carries the raw text of a private signal | Read the Zap history for a week. Any occurrence is a failure |
| B8 | The account used for any assistant connector cannot open the private workspace | Log in as that account and try. Access denied, screenshot it |

### B.5 Out of scope

Any automation whose purpose is to move private material into shared knowledge without a human
approval step. There is no acceptable version of that task.

---

## Joint acceptance: the boundary test

Neither specification is accepted alone. Once both are in place, the access boundary test of
document 7 is re-run against the real boards and the real folder, with the real private register,
and the log is filed. If a single string from the private register appears in any result, for any
role, the delivery is not accepted, whatever else works.
