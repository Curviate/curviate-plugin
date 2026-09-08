---
name: curviate-premium
description: "Drive LinkedIn Sales Navigator and Recruiter through the Curviate CLI. Covers `sales-nav` (search, profile, message, lead and account lists, save-lead, save-account) and `recruiter` (projects, pipeline, talent-search, save-candidate, project jobs, applicants, message, profile, search), and the two gates every one of them sits behind: the add-on tier and the LinkedIn subscription on the connected account. Use when working a Sales Navigator or Recruiter seat, or when diagnosing why a premium command failed."
---

# Curviate — Sales Navigator and Recruiter

Every command in this skill sits behind **two** gates, and both must be open:

1. The Curviate add-on tier for that surface. Without it: `TIER_NOT_ACTIVE`, exit `5`.
2. An active LinkedIn Sales Navigator or Recruiter subscription **on the connected account**.
   Without it: `LINKEDIN_FEATURE_NOT_SUBSCRIBED`, exit `5`.

**Confidence for this entire skill: wired, never live-fired.** Every command below is real and
correctly wired, and the request bodies are preview-proven — but the whole tier has only ever been
exercised against accounts without the subscription, so every one of them has returned exit `5`
rather than data. Treat the response shapes as documented-not-observed, and smoke-test on a seat you
control before an unattended flow depends on any of them.

Command surface established against CLI `0.30.0`.

## Before any command

```bash
npm install -g @curviate/cli && curviate --version    # needs Node 18 or newer
curviate login --api-key <key>                        # or export CURVIATE_API_KEY
curviate account list --json                          # the acc_id for --account
```

- **Confirm the seat before reaching for these commands.** `curviate profile subscription --json`
  reads the connected account's entitlements back; a free account is a valid result
  (`has_premium: false`), not an error. Do not probe the gate with a write.
- **`--profile <name>` picks the stored credential set; `--account <acc_id>` picks which connected
  LinkedIn account's seat is used.** A tenant can hold one subscribed account among several.
- **`--preview` before every write.** It renders the resolved request without sending. On a read
  command it is refused with exit `2`.
- **`--json` on anything you parse**; **`--fields a,b,c`** to project; **`--verbose`** when a slim
  response looks suspiciously empty.
- **Put global flags at the end of the command.**
- **Branch on the exit code, never on prose.** See the table at the end.
- These are not retrieval-mode commands: `--mode`/`--max-age` are refused here with `unknown flag`,
  exit `2`.

## The trap: exit `5` disguised as exit `2`

On roughly half the tested detail and write commands — `recruiter profile`, `recruiter project`,
`recruiter search <url>`, `recruiter applicants`, `recruiter job create`, `sales-nav profile` — the
server **validates the request body or id shape before it checks the subscription**. So instead of
the expected `LINKEDIN_FEATURE_NOT_SUBSCRIBED` / exit `5`, a perfectly well-formed request comes back
`INVALID_REQUEST` / exit `2`.

**If a premium command exits `2` on a request you are confident is well-formed, suspect the missing
subscription before you suspect your request.** Confirm with `curviate profile subscription --json`
rather than rewriting the call, and never conclude from an exit `2` here that a flag is wrong.

## `sales-nav`

| Command | What it does |
|---|---|
| `curviate sales-nav search people` | Search Sales Navigator member profiles. |
| `curviate sales-nav search companies` | Search Sales Navigator companies. |
| `curviate sales-nav search parameters --type <T>` | Resolve Sales Navigator filter ids. |
| `curviate sales-nav search "<pasted URL>"` | Run a pasted Sales Navigator search or list URL directly. |
| `curviate sales-nav profile <identifier>` | An enriched member profile through the Sales Navigator lens. |
| `curviate sales-nav message new --to <recipient> --subject "<s>" "<text>"` | Start a Sales Navigator chat. Write. |
| `curviate sales-nav lead-lists` | The saved-lead (member) lists on the seat. |
| `curviate sales-nav browse-lead-list <list_id>` | The leads saved in one list. |
| `curviate sales-nav save-lead <user_id> --list <list_id>` | Save a member into a lead list. Write. |
| `curviate sales-nav account-lists` | The saved-account (company) lists on the seat. |
| `curviate sales-nav browse-account-list <list_id>` | The companies saved in one list. |
| `curviate sales-nav save-account <company_id> --list <list_id>` | Save a company into an account list. Write. |

Sales Navigator filter ids are **not** interchangeable with the classic ones from
`curviate search parameters` — resolve them through `sales-nav search parameters`.

## `recruiter`

| Command | What it does |
|---|---|
| `curviate recruiter search people` | Search Recruiter member profiles. |
| `curviate recruiter search parameters --source <s> --type <T>` | Resolve Recruiter filter ids. Source-scoped, and a POST. |
| `curviate recruiter search "<pasted URL>"` | Run a pasted Recruiter search, talent-pool or applicant URL directly. |
| `curviate recruiter profile <identifier>` | An enriched member profile through the Recruiter lens. |
| `curviate recruiter message new --to <recipient> --subject "<s>" --signature "<sig>" "<text>"` | Start a Recruiter chat. Write. |
| `curviate recruiter projects` | Hiring projects on the seat. |
| `curviate recruiter project <project_id>` | One project. |
| `curviate recruiter project <project_id> update` | Edit a project's configuration. All fields optional; omitted fields are unchanged. Write. |
| `curviate recruiter pipeline <project_id>` | Candidates in a project's pipeline. |
| `curviate recruiter talent-search <project_id> --channel-id <id>` | Search a project's talent pool. |
| `curviate recruiter save-candidate <project_id> --stage-id <id> --candidate-id <id>` | Save a candidate into a pipeline stage. Write. |
| `curviate recruiter applicants <project_id> --channel-id <id>` | Applicants in a project's talent pool. |
| `curviate recruiter applicant resume <project_id> <applicant_id>` | Download an applicant's résumé. Binary — write it with `-o <file>`. |
| `curviate recruiter jobs` | Recruiter job postings. |
| `curviate recruiter job get <job_id>` | Any public posting through the Recruiter lens, not only your own. |
| `curviate recruiter job create --project-name "<name>"` | Create a posting draft, opening a new hiring project. Write. |
| `curviate recruiter job publish <project_id> <job_id> --mode FREE\|PROMOTED\|PROMOTED_PLUS` | Publish a draft. `PROMOTED` and `PROMOTED_PLUS` **spend real money** and require `--budget-amount`, `--budget-currency` and `--budget-scope`. Write. |
| `curviate recruiter job close <project_id> <job_id>` | Stop a project's posting accepting applications. **Irreversible once listed.** Write. |
| `curviate recruiter project-job get <project_id>` | The single posting attached to a project (a `404` when none is). |
| `curviate recruiter project-job create <project_id>` | Create a draft attached to an existing project. Write. |
| `curviate recruiter project-job budget <project_id> <job_id>` | Price a publish of that posting. |
| `curviate recruiter project-job update <project_id> <job_id>` | Partial update to that posting. Write. |

A project is the organising unit: a project holds one job posting, one pipeline and one talent pool.
`recruiter job create` opens a new project; `recruiter project-job create` attaches a draft to a
project that already exists.

## Exit codes to branch on here

| Code | Meaning | What to do |
|---|---|---|
| `2` | `INVALID_REQUEST`. | On this tier, **first suspect the missing subscription** — see the trap above — then the request. |
| `4` | Not found — a wrong project, list or member identifier. | Re-resolve the id. |
| `5` | `TIER_NOT_ACTIVE` (no add-on) or `LINKEDIN_FEATURE_NOT_SUBSCRIBED` (the account has no seat). Two different causes, one code. | Read `error.code` to tell them apart. Neither is fixed by retrying; escalate to whoever owns the subscription. |
| `6` | `PLATFORM_RATE_LIMIT` and its siblings. Carries `retry_after` in whole seconds. | **Back off and retry** after that many seconds. |
| `11` | Billing — payment, a cancelled seat, or a subscription lock. | Resolve it in the dashboard. |
| `13` | `BUDGET_EXHAUSTED` — a ceiling of your own refused the action. **Nothing reached LinkedIn and nothing was spent.** `reset_at` can be weeks out, and may be `null` where no clock frees it — an InMail allowance, for instance, is regranted on LinkedIn's own schedule. | **Do not back off and retry.** Read `quotas[]` via `curviate account get <acc_id> --json`, then wait for the named reset or raise the ceiling. |
