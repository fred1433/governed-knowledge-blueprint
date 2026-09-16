# 2. Data model

Four registers, one gate. The shape below is what `schema/schema.sql` implements and what the
reference service reads. It is an implementation of record for the controls, not a proposal to add
another database next to the systems Forward already runs. A team that keeps this in an existing
tool has to reproduce the same constraints there, and the acceptance criteria in document 6 are
written so that either choice can be checked the same way.

## The one shape every source is reduced to

A registry works only if every source ends up in the same shape. Otherwise the gate needs a
special case per source, and a special case is where the exception lives.

| Field | Why it exists |
|---|---|
| `id` | A stable identifier that does not change when a title is edited. |
| `title`, `body` | What the item is called and what it says. |
| `content_hash` | What an approval is given to. Recomputed on every write. |
| `source_system`, `source_ref` | Where it came from, so an answer can be traced. |
| `attribution` | Who is credited. Required: an item with no attribution is not shareable. |
| `permission`, `confidentiality`, `item_audience` | The three separate questions below. |
| `owner`, `reviewer`, `review_date` | Who is accountable, who checked, when. Required. |
| `contains_client_identifiers` | A human's assertion, enforced by the gate. |
| `withdrawn_at` | Set once; the item leaves from that moment. |
| `synthetic` | Whether the row is invented. Served to the reader, so nothing invented can pass for real. |

### Three fields that are usually collapsed into one, and should not be

- **`confidentiality`** is what the material *is*: public, internal, or client private. It is a
  property of the content and it does not change because somebody gained a permission.
- **`item_audience`** is who it is held for: everyone, leadership, one engagement team. It is a
  distribution decision.
- **`permission`** is the handling class the item inherits from its source.

Collapsing them produces the failure this whole system exists to prevent: an item marked
"confidential" gets read as "needs a higher role", somebody with that role is given it, and
private material has entered shared knowledge through an ordinary permission grant. Keeping them
apart is what lets `client_private` mean *no reader*, rather than *a senior reader*.

## The four registers

**Content Registry.** Every item, from every source, in the shape above. The public Library rows
carry what the public pages publish and nothing more: owner, reviewer and review date are recorded
as unknown, because the pages do not publish them and a prototype is not entitled to guess them.

**Analyst Directory.** Entries about named third parties. Two things follow from the fact that the
subject is a person outside the firm: entries are held at a narrower audience by default, and the
directory is not a list of the system's users. The roles in this architecture are named for what
they do to knowledge, `knowledge_reader` and `senior_reviewer`, precisely so the two are never
confused.

**Private records and their review queue.** Raw material, isolated. The queue is not a staging
area on the way to publication: an item in it is never promoted. What the queue holds is the
decision *to write something else*. A reviewer reads the private record, writes a de-identified
item, and approves that. The original keeps its confidentiality before and after.

**Approved Shared Knowledge.** The published set. In the schema it is a view rather than a table,
`publishable`, because a view cannot fall out of date with the rules it is derived from. Every
retrieval path reads it, so search and fetch-by-id can never disagree about what is allowed.

## Approval is a row, not a status field

```sql
CREATE TABLE approval (
  item_id      TEXT PRIMARY KEY REFERENCES item (id) ON DELETE CASCADE,
  approved_by  TEXT NOT NULL REFERENCES role (name),
  approver_id  TEXT NOT NULL,
  approved_at  TEXT NOT NULL,
  reviewer     TEXT NOT NULL,
  review_date  TEXT NOT NULL,
  version_hash TEXT NOT NULL,
  CHECK (approved_by = 'senior_reviewer')
);
```

A status column can be set by any code path that touches the item, including a sync that had no
idea what it was doing. A row has to be written deliberately, it names who wrote it, and it names
the version it applies to. That last column is what makes "the approval did not survive the edit"
a fact about the data rather than a convention somebody has to remember.

The judgement stays human. What the model enforces is that the judgement exists, that it is
attributable, and that it is attached to a specific version of a specific item.

## The constraint that catches the realistic mistake

```sql
CHECK (confidentiality <> 'client_private' OR item_audience = 'engagement_team')
```

The failure to expect is not somebody deciding to publish client material. It is a row filed under
the wrong label on a busy day, then approved by someone who trusted the label. The check above
refuses that shape at write time. The engine holds the same line at read time, and the checks in
document 7 include exactly that case: a record filed as internal, approved, with every other field
in order, held by one rule and one rule only.

## What remains open

The real owners, reviewers, review dates and audiences. The identifiers of the systems this maps
onto. Whether the registry lives in a database, in an existing tool, or in the document store
itself. None of those can be settled without Forward, and none of them changes the shape above.
