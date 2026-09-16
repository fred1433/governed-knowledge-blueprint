# 7. The access boundary checks

## What is actually being tested

A reference implementation in this repository: a small service that authorises on the server, a
registry of eight real public articles and a set of invented private and internal records, and the
policy from document 4. The checks drive it over HTTP, with a token, through the same routes a
client would use.

Two things that would make this worthless, and how each is avoided.

**Nothing is enforced in a browser.** A page that receives every document and then leaves some of
them out of a list has protected nothing: the documents were delivered. Here the policy selects the
corpus for the authenticated identity on the server, and only that corpus is indexed and only that
corpus can be fetched. There is no route that returns the registry.

**No check calls the gate directly.** A test that imports the policy engine and asks it whether it
would allow something proves only that the engine agrees with itself. Every check below makes an
HTTP request and reads the response, which is what a client gets.

## The oracle

The oracle for a leak is **the raw response body**, scanned for every private marker, for every
identity, on every request. Not the parsed object, and not the fields someone thought to inspect.

The markers are not only the client names. A name is the easiest thing to remove and the least
likely thing to be left behind. They are:

- names of companies and people;
- distinctive details that would identify the engagement without a name, such as the reason a
  submission was set aside, or the timing that pins it to one account;
- metadata: source paths, file names, board names.

Two consequences worth stating. The service deliberately does not echo the caller's query back, so
a response body can be scanned for private strings without first working out which of them the
caller supplied. And a request for an item the identity may not have returns the same answer
whether or not the item exists, so the shape of the response does not reveal that a private record
is there.

## The controls

| | Control | Result |
|---|---|---|
| C1 | A private record, unapproved: absent from the published corpus, from search and from fetch, for every identity | held by `R1_PRIVATE_ISOLATION` |
| C1b | A record filed as internal that still names an account, approved, everything else in order | held by `R5_IDENTIFIERS_PRESENT` |
| C2 | A de-identified derivative, not yet approved: still absent | held by `R3_APPROVAL_REQUIRED` |
| C3 | Approval attempted by an identity without the authority: refused by the service, not by the interface | 403, and nothing moved |
| C4 | The approved derivative: retrievable with its citation, while the original stays excluded | as expected |
| C5 | An approved item held for an audience the reader does not carry: absent from search **and** not readable by direct reference | held by `R8_AUDIENCE_SCOPE` |
| C6 | Content edited after approval: the new version does not inherit the approval | held by `R4_APPROVAL_BOUND_TO_VERSION` |
| C7 | Withdrawal and expiry: excluded here, with no claim about anywhere else | held by `R6_WITHDRAWN`, `R7_RETENTION_WINDOW` |
| C8 | Mandatory fields unknown: publication refused | held by `R2_REQUIRED_METADATA_UNKNOWN` |
| C9 | Citations and metadata: no title, path, file name or link reveals the private origin | as expected |
| C10 | A guard switched off: the suite goes red | every guard, see below |

## C10, the one that makes the rest mean something

A check suite that stays green when a control is removed is not evidence. `npm run negative-control`
removes each guard in turn and requires the suite to fail. If a guard can be taken out and every
check still passes, the script fails the build, because that guard is either doing nothing or
nothing is exercising it.

All eight guards are load bearing. The receipt records how many checks went red for each.

This is also why the registry contains a record filed as internal that still names an account.
Without it, `R5_IDENTIFIERS_PRESENT` could be deleted and nothing would notice: the private records
would still be caught by the isolation rule. That record is the mislabelling case, and it is the
realistic one.

## The publication path, run rather than described

One private record, carried to shared knowledge the only way it can be. Every line in the receipt
is a real request and a real status code: a knowledge reader refused when deriving, a senior
reviewer deriving a new item, that item unreadable while it waits, a reader refused when approving,
an approval without a named reviewer refused, the private original refused for approval outright,
the senior reviewer approving, the derived item readable, and the original still refused afterwards.

## Reproducing it

```bash
npm ci
npm run checks     # the checks, the negative control, then the receipt
```

Node 20 or later. One dependency, a YAML parser. No API keys, no model calls, no network access at
any point. Retrieval here is an ordinary keyword index, because the interesting question is not how
passages are ranked but which passages are allowed to reach the ranker at all.

The receipt is `logs/access-boundary-check.log`. It records the code revision, the digest of the
policy file, a digest of the test data, the command, what was expected and what came back. Every
number in it is measured during the run. The same run happens in CI on every push.

## What these checks do not show

They exercise the reference controls in this repository. They say nothing about any real workspace.

- The connection to a live assistant has not been made, and cannot be from here.
- The real identities, the real sources and the real document store still have to be accepted in
  place, with separate accounts. Document 5 contains that test.
- Whether a de-identification is good enough for someone who knows the market is a human judgement.
  The machine floor here is a string comparison against a list it was given, which catches the
  obvious mistakes and guarantees nothing.
- Deliverable 7 in the original brief is a review of Forward's own build. That has not been done
  and could not be: there is nothing built yet to review.
