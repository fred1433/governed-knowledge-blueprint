# 4. Governance rules and workflow

The rules are in `policy/policy.yaml`, and that file is not a description of the rules: it is the
rules. `src/policy.mjs` loads it, the retrieval gate applies it in order, and a rule that names a
predicate nobody implemented fails to load rather than quietly doing nothing. A test asserts that.

sha256 of the policy file is recorded in `policy/policy.sha256`, printed in the boundary test log,
and shown on the page, so three places have to agree before you believe any of them.

## 4.1 The rules, in the order they run

| Rule | Fires when | Effect |
|---|---|---|
| `R1_CLIENT_PRIVATE_ISOLATION` | `confidentiality = client_private` | Withheld from every role, always. Not a permission, an isolation |
| `R2_APPROVAL_REQUIRED` | `approval_status` is not `approved` | Withheld. This is what holds the placeholder and test pages that are live on the site |
| `R3_DEIDENTIFICATION_REQUIRED` | `contains_client_identifiers = true` | Withheld, even if approved. Approval does not launder identifiers |
| `R4_PERMISSION_SCOPE` | The role does not grant that permission level | Withheld for that role only |
| `R5_REVIEW_DATE_REQUIRED_FOR_INTERNAL` | `permission = internal` and no review date | Withheld. Public pages pass and are flagged instead |
| `R6_RETENTION_WINDOW` | Internal item reviewed more than 18 months ago | Withheld until reviewed again |
| `R7_ATTRIBUTION_REQUIRED` | No attribution | Withheld |

First rule that withholds wins, so a reader is told the strongest reason rather than a list.

## 4.2 Isolation of private client material

The rule the engagement puts first is enforced in three independent places:

1. **Not connected.** The private boards and the sales inbox are not connected to the assistant.
2. **R1.** Even inside the registry, a `client_private` row has no reader. There is no role that
   grants it, and no seniority that overrides it.
3. **Not published.** Only approved rows are written into the folder the assistant reads.

Any one of these would stop the ordinary case. The reason there are three is that the ordinary case
is not what leaks. What leaks is the row somebody mislabelled at two in the afternoon. Document 7
runs exactly that case: a private row relabelled `internal`, approved, with every other rule
satisfied. R1 still refuses it, and when R1 is removed from the policy the same query returns it.

## 4.3 De-identification

De-identification produces a **new row**. The private row is never edited, never promoted, never
re-labelled.

```
  SS-001  raw signal, client_private, pending_review
     │        names a company, a person, a timeline
     │
     ├── reviewer writes a de-identified draft: the pattern, not the account
     │
     └──▶ SS-001-DEID  internal, approved, reviewer + date recorded,
                        removed: [client name, individual name and title, identifying timing]

  SS-001 is still client_private and still pending_review afterwards. Both rows exist. The
  audit trail is the pair, not a single row that changed its mind.
```

What must be removed: the client name and any trading name; individual names and titles; the
timing that identifies the account; deal size, price and contract terms; the analyst firm when it
is paired with the client; any verbatim sentence long enough to be searchable back to the source.

What survives: the pattern, the mechanism, the method note. A lesson that cannot survive
de-identification was never a method, it was gossip about an account.

The check is mechanical as well as human: `containsIdentifier()` re-reads the derived text against
the register of private strings, and the boundary test asserts it comes back empty. A reviewer who
believes they removed a name and did not will be told.

## 4.4 Senior approval

Approval is a human act, and the system is built so that it cannot be simulated:

- `approved` without a named reviewer and a review date is refused by the schema, not by a
  convention (`schema/schema.sql`, CHECK constraint, and a test that tries it).
- The approval event is recorded with approver, reviewer, decision and timestamp.
- Approving a signal that still carries identifiers does not release it. R3 holds it, and the
  reviewer gets the item back with the reason.

## 4.5 Retention

Internal items carry an 18 month review window. Past it, `R6` withdraws them from shared knowledge
until a reviewer refreshes the date. Public Library pages are not withdrawn on a timer, since the
public site is the source of truth for what is public, but a review date older than the window is
surfaced in the registry as a flag.

Withdrawal from shared knowledge is not deletion. The row stays, the history stays, and the item
stops being an answer.

## 4.6 Exceptions

An exception names the item, the rule, the approver and an expiry date. It is checked at
evaluation time, so an expired exception stops working on its own and nobody has to remember to
remove it. The sample policy carries one deliberately expired exception, and a test proves it has
no effect.

There is one rule an exception may never lift: `R1_CLIENT_PRIVATE_ISOLATION`. If private material
has to be discussed, the answer is a de-identified derivative, not an exception.

## 4.7 The workflow in one pass

```
  capture ──▶ register ──▶ classify ──▶ [private?] ──yes──▶ review queue ──▶ de-identify ──▶ approve derivative
                                            │                                     │
                                            no                                    └── or reject, and the raw row stays where it is
                                            │
                                            ▼
                                     senior review ──▶ approve ──▶ publish to the synced folder ──▶ assistant can cite it
                                            │
                                            └── hold, with a reason, in the registry
```

Withdrawal runs the same path backwards: unapprove in the registry, remove from the synced folder,
and expect the assistant's index to take time to catch up (document 5 covers that delay, which is
the one thing in this design that cannot be made instant).
