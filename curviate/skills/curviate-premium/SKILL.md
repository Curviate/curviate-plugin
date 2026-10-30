---
name: curviate-premium
description: "Drive LinkedIn Sales Navigator and Recruiter through the Curviate CLI. Covers `sales-nav` (search, profile, message, lead and account lists, save-lead, save-account) and `recruiter` (projects, pipeline, talent-search, save-candidate, project jobs, applicants, message, profile, search), and what can refuse them: the LinkedIn subscription on the connected account, the Curviate seat, and the beta-operations gate. These commands carry no Curviate add-on paywall. Use when working a Sales Navigator or Recruiter seat, or when diagnosing why a premium command failed."
---

# Curviate: Sales Navigator and Recruiter

Sales Navigator and Recruiter are **no longer gated by a separate Curviate add-on**: there is one paid
subscription and one seat, and these commands carry no extra Curviate paywall. What can still refuse
them is LinkedIn's own subscription on the connected account, and, where a workspace has not opted
into beta operations, the beta gate.

Every command here is **badged beta**. That badge is a truth claim about stability, not a refusal:
the beta-gated set is empty at launch, so these commands are callable today. If that changes, the
refusal is `BETA_NOT_ENABLED` and the fix is entirely yours; see Gates below, including what that
refusal actually looks like at this CLI version.

Established against CLI `0.50.0-next.0`.

## Before any command

Setup, credentials, global flags and the exit-code table: `curviate`. Here:

- **`curviate core profile subscription --json` reads what LinkedIn grants** the connected account:
  `has_premium` and the plan. A free account is a valid result, not an error. It says nothing about
  the Curviate seat; do this read before assuming a Recruiter command will work.
- **`--account <acc_id>` picks whose subscription is used**: a Team can hold one subscribed account
  among several. `--preview` before every write.
- **`recruiter job publish` has a required `--mode FREE|PROMOTED|PROMOTED_PLUS`**: `PROMOTED` and
  `PROMOTED_PLUS` spend real money. A retrieval value there is refused at exit `2`.

## Gates: what can refuse these commands

| Refusal | `error.code` | Exit | What fixes it |
|---|---|---|---|
| The account is not on an active seat | `NO_ACTIVE_SEAT` | `5` | Attach the account to a seat (freeing or adding capacity if none is spare), then retry. A seat is required for **every** account-scoped command, not just these. |
| The LinkedIn account lacks the subscription | `LINKEDIN_FEATURE_NOT_SUBSCRIBED` | `5` | Activate Sales Navigator or Recruiter **on LinkedIn**. Reconnecting the account will not help. |
| The workspace has not opted into beta operations | `BETA_NOT_ENABLED` | `5` | A human turns on "Allow beta operations" in Settings. Nothing is missing from the seat or from LinkedIn; an unchanged retry is refused identically. |

Read `error.code`; three causes share exit `5` and their fixes have nothing in common.



**Beta consent is an act a person performs**, so no CLI command grants it persistently: someone
turns on "Allow beta operations" in Settings, or a caller sends `PATCH /v1/tenant/beta` over REST.

**For one call, use the global `--beta` flag.** It allows beta operations for that invocation only
and persists nothing; `--beta=false` withholds consent explicitly. A malformed value is a usage
error, exit `2`. So an unattended run that must not depend on a workspace setting can pass `--beta`
per call rather than requiring someone to have flipped the toggle first.

## Validate the request shape first

**An `INVALID_REQUEST` / exit `2` on a premium command says nothing about entitlement.** Request
validation runs before every entitlement check, so exit `2` means the request itself is malformed,
whatever your seat, subscription or beta-consent state. Fix the request.

The converse holds regardless of version: a well-formed request that is refused is refused by a
gate, and exit `2` is never one of those answers. Which gate you can *name* depends on the client:
`LINKEDIN_FEATURE_NOT_SUBSCRIBED` arrives readable at exit `5`, while the seat and beta refusals
arrive as `INTERNAL` at exit `1` on this version (see Gates). Either way the split holds: exit `2`
is a shape problem, and an entitlement problem is never exit `2`.

*Earlier guidance here said the opposite: that an exit `2` on a premium command was worth reading as
a hidden entitlement failure. That was wrong. The observation behind it was real, but those requests
were malformed in a way the caller could not see, and the entitlement was blamed for it.*

## `sales-nav`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core sales-nav search people` | Search Sales Navigator member profiles. | wired, never live-fired |
| `curviate core sales-nav search companies` | Search Sales Navigator companies. | wired, never live-fired |
| `curviate core sales-nav search parameters --type <T>` | Resolve Sales Navigator filter ids. | wired, never live-fired |
| `curviate core sales-nav search "<pasted URL>"` | Run a pasted Sales Navigator search or list URL directly. | wired, never live-fired |
| `curviate core sales-nav profile <identifier>` | An enriched member profile through the Sales Navigator lens. | wired, never live-fired |
| `curviate core sales-nav message new --to <recipient> --subject "<s>" "<text>"` | Start a Sales Navigator chat. Write. | wired, never live-fired |
| `curviate core sales-nav lead-lists` | The saved-lead (member) lists on the seat. | wired, never live-fired |
| `curviate core sales-nav browse-lead-list <list_id>` | The leads saved in one list. | wired, never live-fired |
| `curviate core sales-nav save-lead <user_id> --list <list_id>` | Save a member into a lead list. Write. | wired, never live-fired |
| `curviate core sales-nav account-lists` | The saved-account (company) lists on the seat. | wired, never live-fired |
| `curviate core sales-nav browse-account-list <list_id>` | The companies saved in one list. | wired, never live-fired |
| `curviate core sales-nav save-account <company_id> --list <list_id>` | Save a company into an account list. Write. | wired, never live-fired |

Sales Navigator filter ids are **not** interchangeable with the classic ones from
`curviate core search parameters`; resolve them through `sales-nav search parameters`.

## `recruiter`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core recruiter search people` | Search Recruiter member profiles. | wired, never live-fired |
| `curviate core recruiter search parameters --source <s> --type <T>` | Resolve Recruiter filter ids. Source-scoped, and a POST. | wired, never live-fired |
| `curviate core recruiter search "<pasted URL>"` | Run a pasted Recruiter search, talent-pool or applicant URL directly. | wired, never live-fired |
| `curviate core recruiter profile <identifier>` | An enriched member profile through the Recruiter lens. | wired, never live-fired |
| `curviate core recruiter message new --to <recipient> --subject "<s>" --signature "<sig>" "<text>"` | Start a Recruiter chat. Write. | wired, never live-fired |
| `curviate core recruiter projects` | Hiring projects on the seat. | wired, never live-fired |
| `curviate core recruiter project <project_id>` | One project. | wired, never live-fired |
| `curviate core recruiter project <project_id> update` | Edit a project's configuration. All fields optional; omitted fields are unchanged. Write. | wired, never live-fired |
| `curviate core recruiter pipeline <project_id>` | Candidates in a project's pipeline. | wired, never live-fired |
| `curviate core recruiter talent-search <project_id> --channel-id <id>` | Search a project's talent pool. | wired, never live-fired |
| `curviate core recruiter save-candidate <project_id> --stage-id <id> --candidate-id <id>` | Save a candidate into a pipeline stage. Write. | wired, never live-fired |
| `curviate core recruiter applicants <project_id> --channel-id <id>` | Applicants in a project's talent pool. | wired, never live-fired |
| `curviate core recruiter applicant resume <project_id> <applicant_id>` | Download an applicant's résumé. Binary, write it with `-o <file>`. | wired, never live-fired |
| `curviate core recruiter jobs` | Recruiter job postings. | wired, never live-fired |
| `curviate core recruiter job get <job_id>` | Any public posting through the Recruiter lens, not only your own. | wired, never live-fired |
| `curviate core recruiter job create --project-name "<name>"` | Create a posting draft, opening a new hiring project. Write. | wired, never live-fired |
| `curviate core recruiter job publish <project_id> <job_id> --mode FREE\|PROMOTED\|PROMOTED_PLUS` | Publish a draft. `PROMOTED` and `PROMOTED_PLUS` **spend real money** and require `--budget-amount`, `--budget-currency` and `--budget-scope`. Write. | wired, never live-fired |
| `curviate core recruiter job close <project_id> <job_id>` | Stop a project's posting accepting applications. **Irreversible once listed.** Write. | wired, never live-fired |
| `curviate core recruiter project-job get <project_id>` | The single posting attached to a project (a `404` when none is). | wired, never live-fired |
| `curviate core recruiter project-job create <project_id>` | Create a draft attached to an existing project. Write. | wired, never live-fired |
| `curviate core recruiter project-job budget <project_id> <job_id>` | Price a publish of that posting. | wired, never live-fired |
| `curviate core recruiter project-job update <project_id> <job_id>` | Partial update to that posting. Write. | wired, never live-fired |

A project is the organising unit: a project holds one job posting, one pipeline and one talent pool.
`recruiter job create` opens a new project; `recruiter project-job create` attaches a draft to a
project that already exists.

## Exit codes specific here

The full table is in `curviate`.

- **`2`** `INVALID_REQUEST`: validation runs before every entitlement check, so this says **nothing** about
  your seat, subscription or beta consent.
- **`13`** on InMail: `reset_at` may be `null`; LinkedIn regrants the allowance on its own schedule.
