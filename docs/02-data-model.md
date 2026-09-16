# 2. Data model

Four tables carry the system: **Content Registry**, **Analyst Directory**, **Sales Signal review
queue**, **Approved Shared Knowledge**. The executable form is `schema/schema.sql`; the populated
form is in `data/`, where the Content Registry rows are the real public Library and everything else
is marked `illustrative`.

The model is deliberately small. Each table exists because something different can go wrong with it.

## 2.1 Content Registry

One row per item of knowledge, whatever system it lives in. The row is not a copy of the content:
it is the governed record about the content, plus the passages that retrieval is allowed to use.

| Field | Why it exists |
|---|---|
| `id`, `title`, `url` | Identity and the thing a citation points at |
| `source_system`, `source_reference` | Mandatory metadata: **source**. Where it came from, and how to go back |
| `pillar` | The four Library pillars, so retrieval can be scoped the way the Library already is |
| `content_type` | `library_article`, `site_page`, `blog_post`, `approved_method`, `analyst_profile`, `raw_sales_signal`, `placeholder`, `test_fixture` |
| `attribution` | Mandatory metadata: **attribution**. Value plus how it was established |
| `permission` | Mandatory metadata: **permission**. `public`, `internal`, `private_client` |
| `confidentiality` | Mandatory metadata: **confidentiality**. `public`, `internal`, `client_private` |
| `owner`, `reviewer`, `review_date` | Mandatory metadata: the three accountability fields |
| `approval_status` | `approved`, `needs_review`, `pending_review`, `raw` |
| `review_reason` | Why a row is held. A row held with no reason is a bug, and a test fails on it |
| `contains_client_identifiers` | Set by the reviewer or by a scan. `R3` refuses to share a row where it is true |
| `flags` | What the registry noticed on its own: duplicates, thin pages, missing descriptions |
| `source_last_modified` | From the source, not from us |
| `passages[]` | The unit a citation points at, so an answer cites a passage and not a whole page |

**Permission and confidentiality are two fields, not one.** Permission answers "who may read it".
Confidentiality answers "what kind of material is it". A row can be mislabelled on one and still be
caught by the other, and the access boundary test exercises exactly that case.

## 2.2 Analyst Directory

An analyst row is knowledge, not a contact record: coverage, what they ask for, how they react, what
the last cycle produced. It lives at `internal` permission and follows the same rules as everything
else, including the review date. One row in `data/analyst-directory.json` is deliberately missing its
review date so that the refusal can be seen happening rather than described.

What an analyst row must never carry: which client of yours briefed them, what that client said, or
any assessment tied to a named account. Those belong to the engagement, not to the directory.

## 2.3 Sales Signal review queue

The queue is the only place where private material and shared knowledge meet, and they meet in one
direction only.

| Field | Note |
|---|---|
| `raw_text` | Stays in the private source. Registered so it can be governed, never released |
| `confidentiality` | Always `client_private` |
| `approval_status` | `raw` until someone puts it in the queue, then `pending_review` |
| `deidentified_draft` | The candidate lesson: text, the list of what was removed, the pillar it belongs to |
| `in_review_queue` | What the reviewer sees today |

Approval does not promote the raw row. It **creates a new row** (`SS-001-DEID` in the sample data)
that carries the lesson, names the reviewer and the date, and records what was removed. The raw row
keeps its status and its confidentiality for ever. That is the difference between de-identification
and relabelling, and it is why the audit trail survives.

## 2.4 Approved Shared Knowledge

Approved methods, templates and derived notes. Permission `internal`, approval `approved`, a named
reviewer and a review date, or the registry refuses to share them. This is the table that is
published into the folder a connected assistant reads, and nothing else is.

## 2.5 The rows as they are today

| Table | Rows | Origin |
|---|---|---|
| Content Registry | 71 | The public Library, crawled 16 Sep 2026 |
| Approved Shared Knowledge | 3 | Illustrative |
| Analyst Directory | 3 | Illustrative |
| Sales Signal queue | 3 | Illustrative |
| Passages indexed | 543 | 532 from the public Library, 11 illustrative |

Every illustrative row carries `"illustrative": true` in the data files, a test asserts that no
non-Library row is missing that flag, and another test asserts that no private string ever appears
in the public rows.
