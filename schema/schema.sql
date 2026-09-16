-- Governed knowledge system, reference schema.
-- Portable SQL (tested shape: SQLite and Postgres). The JSON files in ../data are the same
-- model, populated: the public Library rows are real, everything else is illustrative.
--
-- Two ideas are enforced here rather than left to convention:
--   1. permission and confidentiality are separate columns, so a mislabel on one is still
--      caught by the other;
--   2. nothing can be marked approved without a reviewer and a review date.

CREATE TABLE content_registry (
  id                          TEXT PRIMARY KEY,
  title                       TEXT NOT NULL,
  url                         TEXT,                         -- where a citation points
  source_system               TEXT NOT NULL,                -- mandatory metadata: source
  source_reference            TEXT NOT NULL,                -- how to go back to it
  pillar                      TEXT,                         -- one of the four Library pillars
  content_type                TEXT NOT NULL,
  attribution                 TEXT,                         -- mandatory metadata: attribution
  attribution_basis           TEXT,                         -- how attribution was established
  attribution_status          TEXT NOT NULL DEFAULT 'to_confirm',
  permission                  TEXT NOT NULL,                -- public | internal | private_client
  confidentiality             TEXT NOT NULL,                -- public | internal | client_private
  owner                       TEXT,                         -- mandatory metadata: owner
  reviewer                    TEXT,                         -- mandatory metadata: reviewer
  review_date                 DATE,                         -- mandatory metadata: review date
  approval_status             TEXT NOT NULL,                -- approved | needs_review | pending_review | raw
  review_reason               TEXT,                         -- why it is held, if it is held
  contains_client_identifiers BOOLEAN NOT NULL DEFAULT 0,
  source_last_modified        DATE,
  word_count                  INTEGER,
  illustrative                BOOLEAN NOT NULL DEFAULT 0,
  created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (permission      IN ('public', 'internal', 'private_client')),
  CHECK (confidentiality IN ('public', 'internal', 'client_private')),
  CHECK (approval_status IN ('approved', 'needs_review', 'pending_review', 'raw')),

  -- Nothing is approved without someone accountable for it.
  CHECK (approval_status <> 'approved' OR (reviewer IS NOT NULL AND review_date IS NOT NULL)
         OR permission = 'public'),

  -- Client private material can never be carried at a shareable permission level.
  CHECK (confidentiality <> 'client_private' OR permission = 'private_client'),

  -- A held row always says why.
  CHECK (approval_status = 'approved' OR review_reason IS NOT NULL)
);

CREATE INDEX idx_registry_gate ON content_registry (confidentiality, approval_status, permission);
CREATE INDEX idx_registry_pillar ON content_registry (pillar);

-- What the registry noticed on its own: duplicates, thin pages, default titles, missing metadata.
CREATE TABLE registry_flag (
  item_id TEXT NOT NULL REFERENCES content_registry (id) ON DELETE CASCADE,
  flag    TEXT NOT NULL,
  PRIMARY KEY (item_id, flag)
);

-- The unit a citation points at. An answer cites a passage, not a whole page.
CREATE TABLE passage (
  id         TEXT PRIMARY KEY,
  item_id    TEXT NOT NULL REFERENCES content_registry (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  text       TEXT NOT NULL
);
CREATE INDEX idx_passage_item ON passage (item_id);

-- Analysts are knowledge, not contacts. No client of yours appears in this table.
CREATE TABLE analyst_directory (
  id              TEXT PRIMARY KEY REFERENCES content_registry (id) ON DELETE CASCADE,
  analyst_name    TEXT NOT NULL,
  firm            TEXT NOT NULL,
  coverage        TEXT,
  briefing_cadence TEXT,
  last_interaction DATE
);

-- The one place private material and shared knowledge meet, in one direction only.
CREATE TABLE sales_signal (
  id                 TEXT PRIMARY KEY REFERENCES content_registry (id) ON DELETE CASCADE,
  captured_at        DATE NOT NULL,
  raw_text           TEXT NOT NULL,          -- stays here, registered, never released
  in_review_queue    BOOLEAN NOT NULL DEFAULT 0,
  deidentified_title TEXT,
  deidentified_text  TEXT,
  removed            TEXT,                   -- what de-identification took out
  target_pillar      TEXT
);

-- Approval creates a NEW row and leaves the original alone. This table records that act.
CREATE TABLE approval_event (
  id             INTEGER PRIMARY KEY,
  source_item_id TEXT NOT NULL REFERENCES content_registry (id),
  derived_item_id TEXT REFERENCES content_registry (id),
  approver       TEXT NOT NULL,
  reviewer       TEXT NOT NULL,
  decided_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decision       TEXT NOT NULL,             -- approved | rejected | returned_for_deidentification
  note           TEXT,
  CHECK (decision IN ('approved', 'rejected', 'returned_for_deidentification'))
);

-- Named, owned, dated. An expired exception has no effect: the engine checks the date.
CREATE TABLE policy_exception (
  id        INTEGER PRIMARY KEY,
  item_id   TEXT NOT NULL REFERENCES content_registry (id) ON DELETE CASCADE,
  rule_id   TEXT NOT NULL,
  approver  TEXT NOT NULL,
  granted   DATE NOT NULL,
  expires   DATE NOT NULL,
  note      TEXT,
  CHECK (expires > granted)
);

-- Every retrieval, with the rule that withheld what it withheld. This is what makes an
-- access review possible six months later.
CREATE TABLE retrieval_log (
  id           INTEGER PRIMARY KEY,
  asked_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role         TEXT NOT NULL,
  query        TEXT NOT NULL,
  returned_ids TEXT,                        -- passage ids
  withheld_ids TEXT,
  withheld_rule TEXT
);

-- What may be published into the folder a connected assistant reads. Everything else is
-- invisible to the assistant because it was never put there.
CREATE VIEW shared_knowledge AS
SELECT r.*
FROM content_registry r
WHERE r.confidentiality <> 'client_private'
  AND r.approval_status = 'approved'
  AND r.contains_client_identifiers = 0
  AND (r.permission = 'public' OR (r.reviewer IS NOT NULL AND r.review_date IS NOT NULL));
