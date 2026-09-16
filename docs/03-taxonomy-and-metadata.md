# 3. Taxonomy and mandatory metadata

The taxonomy is not invented here. The Library already publishes four pillars, and the registry
uses them rather than replacing them. What is added is the metadata every item must carry before
it can be shared, and an honest account of which of those values exist today and which a person
has to confirm.

## 3.1 Taxonomy

**Level 1, pillar** (as published on `/library`):

- Forward Leadership and Executive Influence
- Forward Strategy and Market Positioning
- Program Excellence (Ops and Delivery)
- Influence Mechanics (Briefings and Evaluations)

**Level 2, content type**: `library_article`, `site_page`, `blog_post`, `approved_method`,
`template`, `analyst_profile`, `raw_sales_signal`, `placeholder`, `test_fixture`.

**Level 3, audience**: AR leader, CMO or communications, product, executive. Optional, and useful
mainly for the Library's own navigation.

Two rules keep the taxonomy from rotting:

1. An item has exactly one pillar. If it needs two, the second becomes a cross-reference, because
   an item with two homes has no owner.
2. A new pillar is a decision by the Founder and President, not a side effect of a contributor
   picking a value from a list.

## 3.2 The seven mandatory fields

| Field | What it must hold | Where it comes from |
|---|---|---|
| Source | The system and the reference inside it | Automatic |
| Attribution | Named author or the firm, and how that was established | From the item, or set by the reviewer |
| Permission | `public`, `internal`, `private_client` | Set at registration, reviewed at approval |
| Confidentiality | `public`, `internal`, `client_private` | Set at registration, never widened without a named approver |
| Owner | The person accountable for the item being right | Human |
| Reviewer | The senior practitioner who approved it | Human |
| Review date | When it was last judged current | Human |

Three of those are machine facts and four are human judgements. Pretending otherwise is how
metadata schemes die: the fields get filled with defaults, and then nobody trusts them.

## 3.3 What the 71 Library rows carry today

| Field | Observed | To confirm by a person |
|---|---|---|
| Source | 71 | 0 |
| Permission | 71 (public, they are on the open web) | 0 |
| Confidentiality | 71 (public) | 0 |
| Attribution | 71 provisional, set to the firm | 71, each needs the named author or an explicit firm attribution |
| Owner | 0 | 71 |
| Reviewer | 0 | 71 |
| Review date | 0 (the sitemap gives a last modified date, which is not a review) | 71 |

So: **213 values a person has to set**, three per item, and not one of them can be derived from the
public site. That number is the honest cost of governance, and it is smaller than it looks: owner
and reviewer are the same two names for most of the Library, and the fastest path is to set them
per pillar and override the exceptions.

`source_last_modified` is captured from the sitemap and ranges from 23 July 2026 to 15 September
2026 across the site. It is evidence of editing, not evidence of review, and the registry keeps the
two apart on purpose.

## 3.4 What the registry flagged on its own

| Flag | Rows | What it means for retrieval |
|---|---|---|
| `no_meta_description` | 11 | No usable summary for a result card or a citation preview |
| `thin_or_empty_page` | 6 | Under 60 words. An assistant will still cite them |
| `title_shared_with_another_page` | 4 | Two live pages, one title. Citations become ambiguous |
| `not_intended_as_knowledge` | 3 | A placeholder, a test page, a test blog entry, all live |
| `default_site_name_in_title` | 2 | The Wix default site name is still in the browser title |
| `duplicate_of_another_page` | 1 | A page titled "Copy of ..." |

Each flag holds the row for a decision. None of them deletes anything or changes the site.

## 3.5 Contributed articles

The Library invites outside contributions and promises review for quality, relevance, originality,
evidence, permissions and confidentiality, with clear attribution and an author profile. The
registry mirrors that promise as fields, so the promise is enforceable:

- `attribution` is mandatory and `R7_ATTRIBUTION_REQUIRED` refuses to share an item without it;
- `permission` records the right to publish, obtained from the contributor;
- `reviewer` and `review_date` record who accepted it and when;
- a contributed item that mentions a third party's confidential material is `client_private` on
  arrival and goes through the same de-identification path as anything else.
