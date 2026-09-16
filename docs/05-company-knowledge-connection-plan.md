# 5. Connecting ChatGPT Business Company Knowledge

Everything asserted here about the product is quoted from OpenAI's own help pages, read on
16 September 2026, with the URL beside it. Where the documentation is silent, this document says
so rather than filling the gap. The pages carry an "Updated" stamp and they do change: the first
task of an implementation week is to re-read all four and diff them against what is written below.

- **[A]** Company knowledge in ChatGPT, https://help.openai.com/en/articles/12628342-company-knowledge-in-chatgpt-business-enterprise-and-edu
- **[B]** Administrator-managed apps with sync in ChatGPT, https://help.openai.com/en/articles/10847137-administrator-managed-apps-with-sync-in-chatgpt
- **[C]** ChatGPT Business release notes, https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes
- **[D]** Apps in ChatGPT, https://help.openai.com/en/articles/11487775-apps-in-chatgpt

## 5.1 The distinction the whole plan rests on

> "Company Knowledge respects permissions in the connected source. A member can retrieve only
> information they are already allowed to access through an individually authorized account or a
> supported administrator-managed connection." **[A]**

> "Does Company Knowledge respect our existing permissions? Yes. ChatGPT can only access what each
> user is already allowed to view." **[A]**

That answers one question: *can this person open this document?* It does not answer the question
this engagement is about: *does Forward permit this document to be used by an assistant at all?*

Those come apart constantly. A partner can legitimately open a client folder and still not want
that folder answering colleagues' questions. The publication rule in documents 1 to 4 is an
additional restriction that has to be built. It is not a property inherited from the platform, and
nothing in the help pages offers it.

So the architecture does not filter at question time. It publishes approved items to a store and
connects only that store. What is not published was never in reach.

## 5.2 Business is not Enterprise

> "Plans: Available on ChatGPT Business, Enterprise, and Edu." **[A]**

> "Enterprise and Edu administrators and owners can manage access to individual apps using RBAC
> and group-level permissions." **[A]**

The second sentence names Enterprise and Edu. It does not name Business. Plan the Business rollout
as though group-level role-based control over apps is not available, and put the control in the
source instead. Likewise for compliance tooling: **[A]** scopes conversation-event review to
"eligible Enterprise and Edu workspaces".

Two more Business defaults that matter more than they look:

> "Apps are enabled by default in ChatGPT Business." **[A]**

> "Connectors remain default off for Enterprise plans, and default on for Business plans." **[C]**, 24 November 2025

> "When Company Knowledge isn't selected, ChatGPT may still use apps automatically as part of the
> default experience." **[A]**

> "By default, ChatGPT uses Important actions, which allows reading from apps automatically but
> asks before actions that may have a meaningful effect outside ChatGPT, expose sensitive
> information, or be difficult to undo." **[D]**

Read together: telling the team not to ask about clients is not a control, and neither is leaving
Company Knowledge unselected. The only control is what is connected. The first thing to check in
the admin console is which apps are already enabled and who has authorised an account.

**The rule that follows, and it is the architecture in one line: the account that can open a
private client space must not be the account that authorises a connector.**

## 5.3 Two connection types, and why restricting one does not restrict the other

| | Administrator-managed sync | App connector |
|---|---|---|
| What it does | "connect a supported source and make approved content available for indexed search" **[B]** | "access connectors, which fetch content when a user asks a question, built using MCP" **[C]** |
| Who sets it up | "A workspace owner or authorized administrator" **[B]** | The member authorises their own provider account **[A]** |
| Named sources | "Supported administrator-managed sources may include Google Drive, SharePoint, and Microsoft Teams when those options are available for your workspace and region" **[B]** | A partner list that includes Monday.com **[C]**, 24 November 2025 |
| Scope control | "The administrator-selected source scope can further limit what ChatGPT indexes." **[B]** | The authorising account's own permissions |

Two sentences decide the design:

> "A source listed as an app or plugin is not necessarily available for administrator-managed
> sync." **[B]**

> "A separate provider account connection may be required for live app actions, even when
> administrator-managed indexed search is already available." **[B]**

The second is the one to hold on to. **Narrowing the indexed scope does not close a direct
connection.** They are separate paths and they have to be checked separately. **[B]** makes the same
point about removal: "Do not assume that disconnecting an individual live app account also removes
a workspace-managed indexed source."

Any review of this workspace therefore enumerates both: what is indexed under an administrator
scope, and which members have authorised which accounts directly.

## 5.4 The recommended connection

```
  approved items in the registry
        |  publish, one document per approved item, front matter carrying
        |  the registry id, owner, reviewer, review date, pillar and source
        v
  ONE location in the document store Forward already uses
        |  administrator-managed connection, administrator-selected scope = that location only
        v
  ChatGPT Business, Company Knowledge
        |  members retrieve only what the store already lets them open  [A][B]
        v
  answers that cite a document naming its registry id and its reviewer
```

**Which store is Forward's decision, and this document does not make it.** The brief does not say
what is in use, and choosing on a client's behalf is how an architecture acquires a dependency
nobody agreed to. What the location has to support: an administrator-managed connection with a
scope that can be narrowed to it, and permissions that already match the audience the item is held
for. **[B]** lists Google Drive, SharePoint and Microsoft Teams as sources that "may" offer
administrator-managed setup "when those options are available for your workspace and region", and
tells you to "Confirm eligibility in the provider's current setup article" rather than assume.

Two things it is worth knowing before that conversation. **[A]** notes that "A supported
administrator-managed Google Drive source can be available without an individual connection", and
**[B]** records regional limits that differ by provider, with SharePoint and Teams supported in
fewer data-residency regions than Drive. Also **[B]**: "Individually authorized app sync is no
longer available", so personal sync is not a fallback.

**A dedicated connector limited to approved items is a reasonable alternative**, not a layer this
architecture imposes. Custom apps built with MCP are supported: **[A]** says the plugin "can
discover supported custom apps built with MCP when those apps are available to you in ChatGPT",
subject to workspace access, app permissions and provider authorisation. It buys exact control
over what is exposed, and costs a component to run and keep available. It is worth it if the
document-store route cannot be scoped narrowly enough, and not otherwise.

**Monday.com.** It is in the partner list of MCP access connectors **[C]**, which fetch at question
time with the authorising member's permissions. The recommendation is not "connect Monday and then
filter". It is: make accessible only the spaces or objects explicitly authorised for assistant
use, and check every parallel path into the same data. If Monday is connected at all, connect it
with an account whose board access is limited to the operational board, and keep every private
client space outside that account's reach.

## 5.5 Propagation is not instant

> "The initial index may take time to become available. New content and permission changes can
> also take time to appear after the source refreshes." **[B]**

Withdrawal in the registry is immediate, as document 7 shows. Withdrawal downstream is not, and no
figure for it should be invented. Design for the gap:

- the registry, not the assistant, is the system of record for what is approved;
- withdrawing means unapproving in the registry **and** removing the published document, the same
  day, in that order;
- for an urgent removal, narrowing the administrator-selected scope is the faster lever;
- every published document names its registry id, so an answer citing a withdrawn document can be
  traced and corrected;
- nothing is published whose exposure for a few hours would be a problem, which is another reason
  client material never enters the store at all.

The propagation delay is a number to measure in Forward's workspace during acceptance, and then to
agree on. It is not a number to quote from here.

## 5.6 Citations

> "When an answer includes citations or source links, use them to verify the information." **[A]**

> "If an answer includes source links, open them to check the details." **[A]**

Citations are a way back to the source. They are not a guarantee that every answer carries one, and
they are not a guarantee that what was cited is everything relevant. Do not promise the team
otherwise. Two cheap mitigations: every published document opens with front matter naming its
registry id, pillar, owner, reviewer and review date, so an uncited answer can still be checked by
searching the id; and the acceptance test records, per question, whether a citation appeared and
what it pointed at. That number is a fact about Forward's workspace rather than a claim from a help
page.

Make it a pass criterion rather than a hope: the cited source opens with the account under test,
the passage genuinely supports the answer, and no forbidden metadata appears in what is shown.

## 5.7 Acceptance test, to run in Forward's workspace

Run each from a separate real account, not only the administrator's, since the documented model is
per user. **[B]** says the same thing in its own setup steps: "Wait for initial indexing to finish,
then verify that eligible workspace members can retrieve only content they are allowed to access."

| # | Ask | Pass |
|---|---|---|
| 1 | A question answered by an approved method document | Answers from it, cites it, the link opens for this account |
| 2 | A question answered by a public Library article | Answers from the published item, cites it |
| 3 | "What did we learn from the last discovery call with a client?" | No client name, no individual name. Either a de-identified note, or nothing |
| 4 | "Summarise the renewal risks in our pipeline." | Nothing from the private spaces. Anything at all means stopping and checking what is connected |
| 5 | Name one of your own clients and ask what they said | Nothing. This is the test that matters, run from each member's own account |
| 6 | Question 2 again, from an account without the internal audience | Public material only |
| 7 | A document withdrawn this morning | Expect the delay from 5.5. Record how long it takes to disappear, and agree on that number |
| 8 | Ask something answerable only from a connected operational board | Establishes whether a parallel path exists that the indexed scope does not cover |

## 5.8 Claims this plan refuses to make

- That Company Knowledge applies Forward's publication policy. It applies the source's permissions.
  The policy is applied by the publication step, before anything is connected.
- That permissions on an operational board prevent an assistant reaching raw material. Permissions
  and assistant-authorised scope are separate questions, verified separately.
- That a synced folder is the only possible source. It is one documented route; a dedicated
  connector limited to approved items is another.
- That leaving Company Knowledge unselected prevents apps being used. **[A]** says the opposite.
- That revoking access takes effect everywhere at once. **[B]** says it does not.
- That the local checks prove Company Knowledge will not disclose anything. They validate the
  reference controls in this repository. The real integration has to be accepted in Forward's
  workspace, with distinct identities, using the test above.

## What remains open

Which document store. The propagation delay, measured. Which apps are already enabled in the
workspace and who has authorised an account. Whether a dedicated connector is worth its
maintenance. And deliverable 7 in the original brief, the review of the build once it exists, which
has not been done here and cannot be: there is nothing built yet to review.
