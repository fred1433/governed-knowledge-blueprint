# 5. Connecting ChatGPT Business Company Knowledge

Everything asserted here about Company Knowledge comes from OpenAI's own documentation, read on
16 September 2026, quoted with its URL. Where the documentation is silent, this document says so
instead of filling the gap. The help articles carry an "Updated" stamp and they do change, so the
first task of any implementation week is to re-read the four pages listed at the end and diff them
against what is written here.

Sources:

- **[A]** Company knowledge in ChatGPT (Business, Enterprise, and Edu) - https://help.openai.com/en/articles/12628342-company-knowledge-in-chatgpt-business-enterprise-and-edu
- **[B]** Administrator-managed apps with sync in ChatGPT - https://help.openai.com/en/articles/10847137-administrator-managed-apps-with-sync-in-chatgpt
- **[C]** ChatGPT Business release notes - https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes
- **[D]** Apps in ChatGPT - https://help.openai.com/en/articles/11487775-apps-in-chatgpt

## 5.1 What the product actually is, in its own words

> "Company Knowledge is a plugin that helps ChatGPT answer organization-specific questions using
> the knowledge sources available to you. It replaces the previous company knowledge option in
> chat." **[A]**

> "Plans: Available on ChatGPT Business, Enterprise, and Edu." **[A]**

Two sources of content reach it, and they behave differently:

| | Administrator-managed sync | App (access) connector |
|---|---|---|
| What it does | "connect a supported source and make approved content available for indexed search" **[B]** | "access connectors, which fetch content when a user asks a question, built using MCP" **[C], 24 Nov 2025** |
| Who sets it up | A workspace owner or administrator **[B]** | The member, by authorising their own account **[A]** |
| Documented sources | "Supported administrator-managed sources may include Google Drive, SharePoint, and Microsoft Teams when those options are available for your workspace and region" **[B]** | A partner list that includes Monday.com **[C], 24 Nov 2025** |
| Freshness | Indexed in advance, with a delay (see 5.4) | Fetched at question time |

One sentence in **[B]** decides a lot of the design: *"A source listed as an app or plugin is not
necessarily available for administrator-managed sync."* An app being connectable does not mean its
content can be indexed under an administrator's scope.

## 5.2 The permission model, and what it does not give you

> "Company Knowledge respects permissions in the connected source. A member can retrieve only
> information they are already allowed to access through an individually authorized account or a
> supported administrator-managed connection." **[A]**

> "Does Company Knowledge respect our existing permissions? Yes. ChatGPT can only access what each
> user is already allowed to view." **[A]**

> "Administrator-managed sync does not grant members access to content they cannot view in the
> underlying provider." **[B]**

> "The plugin does not override workspace access controls or app permissions." **[A]**

Read carefully, that is a mirror, not a gate. **ChatGPT enforces the source's permissions. It does
not add a permission model of its own.** The consequences for Forward AR Experts are direct:

1. **The folder permissions are the access control.** Whatever governance you want between an AR
   lead and a contributor has to exist in the source, because that is the only thing the assistant
   will reproduce.
2. **Group-level RBAC is documented for the larger plans.** *"Enterprise and Edu administrators and
   owners can manage access to individual apps using RBAC and group-level permissions."* **[A]**
   The same sentence does not name Business. Plan the Business rollout as if that control is not
   available to you, and put the control in the source instead.
3. **Reading happens without being asked for.** *"When Company Knowledge isn't selected, ChatGPT
   may still use apps automatically as part of the default experience."* **[A]**, and in **[D]**:
   *"By default, ChatGPT uses Important actions, which allows reading from apps automatically."*
   So "we will tell the team not to ask it about clients" is not a control. Only not connecting the
   source is.
4. **On Business, connectors start on.** *"Connectors remain default off for Enterprise plans, and
   default on for Business plans."* **[C], 24 Nov 2025**, and *"Apps are enabled by default in
   ChatGPT Business."* **[A]** A member can therefore authorise their own account to an app unless
   an administrator changes the workspace setting. That is the first thing to check in the console.

**The rule that follows, and it is the whole architecture in one line: any account that can open a
private client board must not be the account that authorises a connector.**

## 5.3 The recommended connection

```
   Approved Shared Knowledge (registry)
              │  publish: one file per approved item, front matter carries
              │  registry id, owner, reviewer, review date, pillar, source
              ▼
   ONE folder in Google Drive: "Forward Shared Knowledge"
              │  admin-managed sync, administrator-selected scope = this folder only
              ▼
   ChatGPT Business, Company Knowledge
              │  members retrieve only what Drive already lets them open  [A][B]
              ▼
   Answers cite the published document, which names the item and its reviewer
```

Why a folder rather than a direct connection to Monday or to the Library:

- It is a documented administrator-managed source: *"Supported administrator-managed sources may
  include Google Drive, SharePoint, and Microsoft Teams"* **[B]**, and the administrator chooses
  the scope: *"The administrator-selected source scope can further limit what ChatGPT indexes."*
  **[B]**
- It makes publication an explicit act. A file exists in that folder because the registry put it
  there after approval, which is exactly the control the engagement asks for.
- It keeps the private sources structurally out of reach, rather than filtered out at question
  time.

**Monday.com.** It appears in OpenAI's partner list of MCP access connectors **[C], 24 Nov 2025**.
It is an access connector, so it fetches at question time with the authorising member's own
permissions, and **[B]** warns that being listed as an app does not make a source available for
administrator-managed sync. Recommendation: if Monday is connected at all, connect it with an
account whose board access is limited to the operational board, and keep every private client board
outside that account's reach. Verify in your own workspace before relying on any of it, because
**[A]** also says *"The plugin discovers the knowledge sources available to you when it runs. App
availability can depend on your plan, workspace settings, role, and the app's own requirements."*

## 5.4 The one thing that cannot be made instant

> "The initial index may take time to become available. New content and permission changes can also
> take time to appear after the source refreshes." **[B]**

Withdrawal is therefore not immediate. Design for it:

- the registry, not the assistant, is the system of record for what is approved;
- withdrawal means unapprove in the registry **and** remove the file from the synced folder, in
  that order, on the same day;
- for an urgent withdrawal, narrowing the administrator-selected scope is the faster lever;
- every published file names its registry id, so an answer citing a withdrawn document can be
  traced back and corrected;
- no published document should contain anything whose exposure for a few hours would be a problem.
  That is another reason client material never enters the folder at all.

## 5.5 Citations

The release note of 23 October 2025 says company knowledge gives answers *"with clear citations and
links back to the original sources"* **[C]**. The current help article is more careful: *"When an
answer includes citations or source links, use them to verify the information."* **[A]** and *"If an
answer includes source links, open them to check the details."* **[A]**

So: do not promise the team that every answer will be cited. Two mitigations, both cheap:

1. Every published file starts with a front matter block naming the registry id, the pillar, the
   owner, the reviewer and the review date, so a citation is traceable and an uncited answer can
   still be checked by searching the id.
2. The acceptance test in 5.6 records, for each test question, whether a citation appeared and
   which document it pointed at. That number is a fact about your workspace, not a claim from a
   help page.

## 5.6 Acceptance test for the connection

Run these after the folder is synced, once per role, and record the result. The pass criteria are
about what comes back, not about how good the prose is.

| # | Ask | Pass |
|---|---|---|
| 1 | "What is our briefing pre-read and when does it go out?" | Answers from an approved method document, cites it |
| 2 | "What do we require in an evidence pack before an evaluation submission?" | Answers from the approved method, cites it |
| 3 | "What does the Library say about positioning for analyst mindshare?" | Answers from the public Library page |
| 4 | "What did we learn from the last discovery call with a client?" | No client name, no individual name. Either the de-identified pattern note, or nothing |
| 5 | "Summarise the renewal risks in our pipeline." | Nothing from the private boards. If anything comes back, stop and check what is connected |
| 6 | Name a specific client of yours and ask what they said | Nothing. This is the test that matters, and it is run by a person, from their own account |
| 7 | The same question as 3, from a contributor account | Public material only |
| 8 | Ask for a document that was withdrawn this morning | Expect the index lag from 5.4. Record how long it takes to disappear |

Test 6 is run from each member's account, not only the administrator's, because the documented
model is per user: *"ChatGPT can only access what each user is already allowed to view."* **[A]**

## 5.7 User guide, one page for the team

- Company Knowledge answers from approved shared knowledge. If something is not in the folder, it
  is not approved yet, and the answer will be silence rather than a guess.
- Never paste client material into a chat to get a better answer. The registry path exists for that:
  put the signal in the review queue and let it come back as a method note.
- Check the citation. An answer without a source link is a draft, not a source.
- If an answer contains a client name, stop and tell the Founder and President the same day. That is
  an incident, and the boundary test in document 7 is what it gets compared against.
- The assistant is not the system of record. The registry is.

## 5.8 Claims this document refuses to make

- That Company Knowledge enforces role based access on a Business workspace. The documented RBAC
  sentence names Enterprise and Edu **[A]**.
- That every answer carries a citation. The help article says "when an answer includes citations"
  **[A]**.
- That Monday.com content can be indexed under an administrator-managed scope. It is listed as an
  MCP access connector **[C]**, and **[B]** warns those are different things.
- That a permission change propagates immediately. **[B]** says the opposite.
- That anything in this plan removes the need for the source's own permissions to be correct.
