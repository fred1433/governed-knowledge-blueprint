# 7. Access boundary test

The engagement's screening question is the right one: raw sales conversations and private client
material must never automatically enter shared knowledge or be retrievable through the assistant.
This document is that rule, exercised.

Run it yourself:

```bash
npm ci
npm test              # 33 assertions, including this file's cases
npm run boundary      # writes logs/access-boundary-test.log
```

The log committed in `logs/` is the output of that command. The CI workflow runs both on every push.

## 7.1 What is being tested against what

- **Policy**: `policy/policy.yaml`, sha256 recorded in `policy/policy.sha256` and printed at the
  top of the log.
- **Corpus**: 71 registry rows from the public Library (real, crawled 16 September 2026), plus 9
  illustrative rows: 3 approved method notes, 3 analyst rows, 3 raw sales signals. Every
  illustrative row is marked `illustrative` in the data files and a test asserts it.
- **Private register**: the strings that must never come back, listed in
  `data/sales-signals.json` under `private_identifiers`. They belong to invented companies and
  invented people, because no real client material was used anywhere in this work.
- **Roles**: `ar_lead` (public and internal) and `contributor` (public only). No role grants
  `client_private`.

## 7.2 The cases

| # | Case | Result |
|---|---|---|
| T1 | Every role, every adversarial query: does a private row ever come back? | No private row returned |
| T2 | Every role, every adversarial query: does any returned passage contain a private string? | None |
| T3 | Negative control: remove `R1` from the policy and run the same sweep | The private row surfaces, which is what makes the other cases meaningful |
| T4 | An item sitting in the review queue | Invisible to every role |
| T5 | The same item approved in a hurry, identifiers still in it | Still withheld, by `R3` |
| T6 | The same item de-identified and approved | Reachable by the AR lead, not by the contributor, and the derived text contains none of the private strings |
| T7 | One question, two roles | The AR lead sees an internal source, the contributor sees public sources only |
| T8 | The placeholder and test pages that are live on the public site | Never returned |
| T9 | An internal row with no review date, carrying an expired exception | Withheld by `R5`, the expired exception has no effect |

The adversarial queries are not hand-picked. They are generated from the private material itself:
every private identifier, the opening clause of each raw signal, and every word longer than six
characters in those signals, plus ten ordinary questions a practitioner would ask. The sweep runs
the product of roles and queries.

## 7.3 The step a reader will ask about

A demonstration is worth nothing if the private item could never have been returned anyway. So the
negative control builds the case that actually happens in real systems: **a private row that
somebody relabelled as internal, approved, with a reviewer and a date, and with the identifiers
flag cleared.** Every rule passes on it except one.

```
with R1_CLIENT_PRIVATE_ISOLATION removed, the same query returns it: true
with the real policy, it does not:                                   true
```

That is the difference between a test and a screenshot. If the isolation rule were decorative, the
first line would say false and nothing here would be worth reading.

## 7.4 The private signal, step by step

From the log:

```
  raw, ar_lead                                  -> withheld by R1_CLIENT_PRIVATE_ISOLATION
  raw, contributor                              -> withheld by R1_CLIENT_PRIVATE_ISOLATION
  approved but not de-identified, ar_lead       -> withheld by R3_DEIDENTIFICATION_REQUIRED
  approved but not de-identified, contributor   -> withheld by R3_DEIDENTIFICATION_REQUIRED
  de-identified and approved, ar_lead           -> ALLOWED
  de-identified and approved, contributor       -> withheld by R4_PERMISSION_SCOPE
  identifiers left in the derived text: 0
  original row after the approval: approval_status=pending_review, confidentiality=client_private
```

Read the last line twice. The original row did not change. Approval created a second row. The
lesson travels, the account does not, and six months later the audit trail is the pair.

## 7.5 What this test does not prove

It proves the registry and the retrieval gate. It does not prove your Google Drive permissions,
your Monday board membership, or what a connected assistant does with a document a member can
already open. Those are tested by the acceptance criteria in document 6 and by the questions in
section 5.6, run from real accounts against the real workspace.

That is the honest boundary of a blueprint: this is the part that can be proven before the
engagement starts, and it is proven. The rest is proven in week one, the same way, with the log
filed next to this one.
