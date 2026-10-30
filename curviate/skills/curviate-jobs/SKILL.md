---
name: curviate-jobs
description: "Create, publish and manage classic LinkedIn job postings with the Curviate CLI, and read their applicants. Covers `job` (get, list, create, update, budget, publish, close) and `job applicants` / `job applicant get|resume`, the draft-then-publish flow, the subscription gate that stops a publish even on the free mode, and the read-back delay after an update. Use when drafting or updating a posting, pricing or publishing one, closing one, or pulling applicants and résumés."
---

# Curviate: job postings and applicants

Every posting starts as a draft. Drafts are free and reversible; publishing is neither. The two
things that surprise agents here are that **a free publish is still subscription-gated** and that
**an update's read-back lags the write**.

Established against CLI `0.50.0-next.0`.

## Before any command

Setup, credentials, global flags and the exit-code table: `curviate`. Here:

- **`--account <acc_id>` picks the account that owns the posting. `--preview` before every write**,
  above all before a publish.
- **`job publish --mode` is not retrieval mode**: it selects a publishing mode and can spend real money.

## The commands

| Command | What it does | Confidence |
|---|---|---|
| `curviate core job get <id>` | One public posting's full detail. Takes a job URL or a bare numeric id. No seat needed. | proven |
| `curviate core job list --state <DRAFT\|OPEN\|CLOSED\|REVIEW\|SUSPENDED>` | Your own postings by state. `--state` is required. | proven |
| `curviate core job create …` | Create a **draft**. Never publishes, never spends. | proven |
| `curviate core job update <id> …` | Partial update to a posting you own; same flags as `create`. | proven |
| `curviate core job budget <id>` | Price a publish before committing any money. | proven |
| `curviate core job publish <id> --mode FREE\|PROMOTED\|PROMOTED_PLUS` | Publish a draft. `PROMOTED` and `PROMOTED_PLUS` spend real money and additionally require `--budget-currency` (ISO-4217), `--budget-amount` and `--budget-scope` (`DAILY` or `TOTAL`). | wired, never live-fired |
| `curviate core job close <id>` | Stop a posting accepting applications. **Irreversible once listed.** | wired, never live-fired |
| `curviate core job applicants <id>` | Applicants to a posting you own. | proven (shape only, exercised on a draft with no applicants) |
| `curviate core job applicant get <id> <applicant_id>` | One applicant's full detail, including contact information. | proven (shape only) |
| `curviate core job applicant resume <id> <applicant_id>` | Download an applicant's résumé. Binary, write it with `-o <file>`. | proven (shape only) |

### `job create`: the required set

`--description` (minimum 200 characters, enforced server-side), `--workplace-type`
(`ON_SITE|HYBRID|REMOTE`), `--location` (a `LOCATION` parameter id, resolved via
`curviate core search parameters --type LOCATION`), `--employment-status`
(`FULL_TIME|PART_TIME|CONTRACT|TEMPORARY|OTHER|VOLUNTEER|INTERNSHIP`), `--apply-method`
(`linkedin` or `external`), plus a title and a company.

- Title: `--job-title` as free text, or `--job-title-id` for an existing LinkedIn title.
- Company: `--company` as free text, or `--company-id`.
- `--apply-method linkedin` requires `--notification-email`; `--apply-method external` requires
  `--website-url`.
- `--skills` takes comma-separated skill parameter ids and is optional.

Run `curviate core job create --help` for the current required set before building a call.

### Traps

- **A publish is subscription-gated in practice, not just on the paid modes.** `--mode FREE` (the
  money-free mode) still returns `LINKEDIN_FEATURE_NOT_SUBSCRIBED`, exit `5`, on an account with no
  LinkedIn job-posting subscription. On that error nothing goes public and the draft stays a draft.
  Expect exit `5` unless you have confirmed the subscription; do not read it as a malformed request.
- **`publish` and `close` are wired, never live-fired.** Every test account run against this surface
  hit the subscription gate above before a posting ever went public, so a live `200` from either
  command has not been observed; `close`'s happy path is unreachable the same way, since nothing gets
  published to close. The response shapes are cross-checked against the substrate's own types rather
  than an observed call. The read and draft surface above `publish` (list/get/budget/create/update,
  plus the three applicant reads) does not depend on that subscription and is proven.
- **An update lands before the read-back reflects it.** `job update` returning exit `0` was applied,
  but its own response and an immediate `job get` can both still show the old value, while
  `job list` (the owner view, checked minutes later) shows the update did land. Do not conclude a
  silent no-op from a stale-looking immediate read.
- **`job list --state` filters client-side and says so on stderr.** LinkedIn's own state filter is
  best-effort, so the CLI re-fetches the unfiltered page walk and drops non-matching items itself,
  logging what it dropped. Read stdout for data and stderr for what was dropped, and note that
  `--all` may walk far more upstream pages than the filtered item count suggests.
- **`job close` is irreversible once the posting is listed.** Preview it, and be sure.
- **Price before you publish.** `job budget <id>` costs nothing and is the only way to know what a
  promoted publish will spend.

## A safe posting flow

```bash
curviate core job create --job-title "…" --company "…" --workplace-type REMOTE \
  --location <loc_id> --employment-status FULL_TIME --description "$(cat jd.md)" \
  --apply-method linkedin --notification-email <email> --account <acc_id> --preview --json
# re-run without --preview to create the draft, then:
curviate core job get <id> --account <acc_id> --json          # confirm the draft
curviate core job budget <id> --account <acc_id> --json       # price it
curviate core job publish <id> --mode FREE --account <acc_id> --preview --json
```

## Exit codes specific here

The full table is in `curviate`.

- **`2`**: a missing required flag, a description under 200 characters, a location passed as a name
  rather than an id.
- **`11`**: payment, a cancelled seat or a subscription lock. `SUBSCRIPTION_BUSY` is retry-likely; check
  the envelope.
