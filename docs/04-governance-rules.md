# 4. Governance rules and the publication workflow

The rules live in `policy/policy.yaml`. That file is the policy, not a description of one: the
loader refuses to start if a rule names a predicate nobody implemented, the reference service
applies the rules on the server before anything is indexed, and the checks in document 7 exercise
them over HTTP. The negative control removes each one in turn and requires the checks to go red.

## The eight rules

| Rule | Fires when | What it protects |
|---|---|---|
| `R1_PRIVATE_ISOLATION` | confidentiality is client private | Private material has no reader. Not a high one: none. |
| `R2_REQUIRED_METADATA_UNKNOWN` | owner, reviewer, review date or attribution unknown | Nothing is published without somebody accountable for it. |
| `R3_APPROVAL_REQUIRED` | approval status is not approved | A senior reviewer said yes, and it is recorded. |
| `R4_APPROVAL_BOUND_TO_VERSION` | content hash differs from the approved hash | An approval belongs to the text it was given for. |
| `R5_IDENTIFIERS_PRESENT` | the item is flagged as carrying client identifiers | Approval does not lift this flag. |
| `R6_WITHDRAWN` | withdrawal date has passed | Withdrawal takes effect here immediately. |
| `R7_RETENTION_WINDOW` | internal item whose review date is outside the window | Stale items leave without anyone remembering. |
| `R8_AUDIENCE_SCOPE` | the item's audience is not one the role carries | The same answer for search and for direct reference. |

The first rule that fires is the reason returned, so a reviewer is told the strongest reason rather
than a list to work through.

## Isolation, stated precisely

Raw client material never becomes retrievable, under any role, at any approval status, at any
point in the workflow.

What happens instead: a senior reviewer reads the private record and writes a **new** item that
carries the lesson without the identifying detail. That new item goes through the same gate as
everything else. The original keeps its confidentiality for ever. The link between the two lives
in the derivation trail, which is not served to readers, so a published note carries no title, no
path, no file name and no identifier belonging to the record it came from.

This is not a status change on the original. A workflow in which `pending` becomes `approved` on a
private record is a workflow in which one wrong click publishes a client conversation.

## De-identification, and the honest limit of it

The engine refuses to create a derivative if a known identifier survives the rewrite. That check
runs against a list of strings: names, distinctive details that would identify the engagement even
without a name, and metadata such as the source path. It is a floor, and it is worth having,
because the strings people forget are rarely the company name.

It is not a guarantee. Whether a rewrite is genuinely unidentifiable to somebody who knows the
market is a human judgement, and no string comparison makes it. The rule that follows: a reviewer
approves the derivative, and the machine check exists to stop the obvious mistakes reaching them.

## Senior approval

The judgement is human. Three things around it are not:

1. **The obligation.** Nothing publishes without an approval row.
2. **The author.** The approval names the identity that gave it, and the service refuses an
   approval from any identity whose role does not carry that authority. The check for this is a
   request from a knowledge reader that comes back 403, not a hidden button.
3. **The binding to a version.** Edit an approved item and it leaves shared knowledge until it is
   approved again.

An automation may propose, move, notify and publish. It may not approve. A publication rule that
an automation can satisfy on its own is not a rule.

## Retention, withdrawal, exceptions

**Retention.** An internal item whose review date is older than the window leaves shared knowledge
on its own. The date is evaluated on every request, so nothing depends on a scheduled job having
run.

**Withdrawal.** Set the withdrawal date and the item is out of this system from that moment. What
happens in a system downstream is that system's own timing, and this policy makes no claim about
it. Document 5 says what that means for an assistant that has already indexed something.

**Exceptions** are named, owned and dated. There is one in the policy file and it expired on the
day it was written, so the rule it was meant to lift still applies. A check asserts that: an
exception mechanism nobody has watched expire is an exception mechanism that does not expire.

## What remains open

The real approval authority and who holds it. Whether one senior reviewer is a bottleneck in
practice and what the second signature would be. The retention window. The escalation path when a
reviewer is unavailable and something is genuinely urgent, which is the situation every governance
system is eventually judged on.
