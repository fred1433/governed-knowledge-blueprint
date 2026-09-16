-- Reference schema for a governed knowledge registry.
--
-- This is an implementation of record for the controls, not a proposal to add another database
-- to the stack. Forward AR Experts already has systems of record. What this file shows is which
-- constraints have to exist somewhere, expressed in the one language where they are unambiguous.
-- A team that keeps the registry in an existing tool has to reproduce these constraints there,
-- and the acceptance criteria in docs/06 are written so they can be checked either way.
--
-- The point of writing it as DDL: three of the controls are structural. A shape that makes an
-- unapproved item unpublishable, or an approval unattributable, costs nothing to enforce and
-- cannot be forgotten under deadline.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- vocabulary

CREATE TABLE confidentiality_level (
  level       TEXT PRIMARY KEY,
  description TEXT NOT NULL
);
INSERT INTO confidentiality_level VALUES
  ('public',         'published on the public website'),
  ('internal',       'approved shared knowledge, method notes, analyst entries'),
  ('client_private', 'private client material. Not the top of the ladder: outside it. No role reads this.');

CREATE TABLE audience (
  name        TEXT PRIMARY KEY,
  description TEXT NOT NULL
);
INSERT INTO audience VALUES
  ('public',          'anything already published'),
  ('all_staff',       'shared knowledge, available to every reader'),
  ('leadership',      'held narrower than all staff'),
  ('engagement_team', 'the people on one engagement. Never a shared-knowledge audience.');

CREATE TABLE role (
  name        TEXT PRIMARY KEY,
  may_approve INTEGER NOT NULL CHECK (may_approve IN (0, 1))
);
INSERT INTO role VALUES ('knowledge_reader', 0), ('senior_reviewer', 1);

CREATE TABLE role_audience (
  role     TEXT NOT NULL REFERENCES role (name),
  audience TEXT NOT NULL REFERENCES audience (name),
  PRIMARY KEY (role, audience)
);
INSERT INTO role_audience VALUES
  ('knowledge_reader', 'public'), ('knowledge_reader', 'all_staff'),
  ('senior_reviewer', 'public'), ('senior_reviewer', 'all_staff'), ('senior_reviewer', 'leadership');

-- ---------------------------------------------------------------- the registry

CREATE TABLE item (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  kind            TEXT NOT NULL,
  body            TEXT NOT NULL,

  -- content_hash is what an approval is given to. It is recomputed on every write, which is what
  -- makes "the approval did not survive the edit" a fact about the data rather than a convention.
  content_hash    TEXT NOT NULL,

  source_system   TEXT NOT NULL,
  source_ref      TEXT NOT NULL,
  attribution     TEXT,
  permission      TEXT NOT NULL,
  confidentiality TEXT NOT NULL REFERENCES confidentiality_level (level),
  item_audience   TEXT NOT NULL REFERENCES audience (name),

  owner           TEXT,
  reviewer        TEXT,
  review_date     TEXT,

  contains_client_identifiers INTEGER NOT NULL DEFAULT 0 CHECK (contains_client_identifiers IN (0, 1)),
  withdrawn_at    TEXT,
  synthetic       INTEGER NOT NULL DEFAULT 0 CHECK (synthetic IN (0, 1)),

  -- A private item is never held for a shared audience. The mislabelling that this blueprint
  -- treats as the realistic failure is refused here before it can be approved by mistake.
  CHECK (confidentiality <> 'client_private' OR item_audience = 'engagement_team')
);

-- ---------------------------------------------------------------- approval

-- An approval is a row, not a column. It names who gave it, when, and which version it was given
-- to. A status field on the item could be set by anything; a row has to be written by somebody.
CREATE TABLE approval (
  item_id       TEXT PRIMARY KEY REFERENCES item (id) ON DELETE CASCADE,
  approved_by   TEXT NOT NULL REFERENCES role (name),
  approver_id   TEXT NOT NULL,
  approved_at   TEXT NOT NULL,
  reviewer      TEXT NOT NULL,
  review_date   TEXT NOT NULL,
  version_hash  TEXT NOT NULL,

  -- Only a role that may approve can appear in an approval row.
  CHECK (approved_by = 'senior_reviewer')
);

-- The derivation trail. The private original and its de-identified derivative are a pair, and
-- the pair lives here rather than inside the derivative, so that nothing served to a reader
-- carries a reference back to the record it came from.
CREATE TABLE derivation (
  derived_id  TEXT NOT NULL REFERENCES item (id) ON DELETE CASCADE,
  source_id   TEXT NOT NULL REFERENCES item (id),
  derived_at  TEXT NOT NULL,
  derived_by  TEXT NOT NULL,
  removed     TEXT NOT NULL,
  PRIMARY KEY (derived_id)
);

CREATE TABLE audit_event (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL,
  action    TEXT NOT NULL,
  item_id   TEXT NOT NULL,
  actor     TEXT NOT NULL,
  version   TEXT
);

-- ---------------------------------------------------------------- the publishable set

-- The one place that answers "what may be published". Everything else reads this. A ranking bug
-- can then make answers worse; it cannot make them unsafe, because nothing outside this view is
-- ever indexed or fetched.
CREATE VIEW publishable AS
SELECT i.*
FROM item i
JOIN approval a ON a.item_id = i.id
WHERE i.confidentiality <> 'client_private'          -- R1
  AND i.owner IS NOT NULL                            -- R2
  AND i.reviewer IS NOT NULL
  AND i.review_date IS NOT NULL
  AND i.attribution IS NOT NULL
  AND a.version_hash = i.content_hash                -- R4, the approval is tied to a version
  AND i.contains_client_identifiers = 0              -- R5
  AND (i.withdrawn_at IS NULL OR i.withdrawn_at > date('now'))   -- R6
  AND (i.permission <> 'internal'                    -- R7
       OR i.review_date >= date('now', '-18 months'));

-- What a given role may retrieve. R8 lives here, and it is the same answer for search and for
-- fetch by id, because both read this view.
CREATE VIEW publishable_for_role AS
SELECT ra.role, p.*
FROM publishable p
JOIN role_audience ra ON ra.audience = p.item_audience;
