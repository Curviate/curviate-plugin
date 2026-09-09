---
name: curviate-profile
description: "Read and write LinkedIn profiles and company pages with the Curviate CLI, and resolve human search terms into the opaque filter ids the search commands need. Covers `profile` (me, detail, sections, update, subscription, analytics, visitors, SSI), `company` (detail, employees, posts, jobs, followers, page inbox, follow-invite), `search parameters`, retrieval mode (`--mode`/`--max-age`), and the session/account commands (`login`, `config`, `account`). Use when fetching or updating a member or company profile, resolving a filter id, choosing between a stored copy and a live LinkedIn read, or connecting an account."
---

# Curviate — profiles, companies, and filter ids

Profiles are the entry point for almost every LinkedIn workflow: you resolve a person or a company,
then act. This skill covers that resolution, the company page surface, the parameter lookup every
structured search depends on, and the account plumbing underneath all of it.

Command surface established against CLI `0.30.0`.

## Before any command

```bash
npm install -g @curviate/cli && curviate --version    # needs Node 18 or newer
curviate login --api-key <key>                        # or export CURVIATE_API_KEY
curviate account list --json                          # verify: your connected LinkedIn accounts
```

- **Resolve the binary first.** If `curviate --version` fails, install it. Do not substitute a raw
  HTTP call for a command you could not find; the command surface is the contract.
- **Credentials resolve flag > environment > stored profile.** `CURVIATE_API_KEY`,
  `CURVIATE_BASE_URL` and `CURVIATE_ACCOUNT` are the right path for a scripted run: the key stays out
  of `argv`, out of `ps`, and out of shell history.
- **`--json` on anything you parse.** It is already the default when stdout is not a terminal; ask
  for it explicitly when a human might also be watching.
- **`--preview` before every write.** It renders the resolved request without sending it. On a read
  command it is refused with exit `2`.
- **`--fields a,b,c` to project.** Profile responses carry 18 or more fields; projecting cuts most of
  that away.
- **`--verbose` when a slim response looks suspiciously empty.** An empty slim field is not proof the
  data does not exist — see Traps.
- **Put global flags at the end of the command.** Trailing placement is unambiguous on every version;
  a leading global flag has been dropped silently by older builds, running under whichever account
  was already active rather than the one you named.

### `--profile` and `--account` are different questions

Both exist on every command and they answer different questions. Pass either, both, or neither:

| Flag | Chooses | Reach for it when |
|---|---|---|
| `--profile <name>` | The stored credential set: API key, base URL, and a default account. | You hold several tenants or keys locally, or you want the call site to read as a name rather than an opaque id. |
| `--account <acc_id>` | Which connected LinkedIn account performs this one command, overriding the profile's default. | The tenant has more than one connected account and this command must act as a specific one. |

`--account` takes an account id only — an account *name* comes back `ACCOUNT_NOT_FOUND`, exit `4`.
A structurally malformed value is refused at exit `2` before the request is built. Resolve ids live
with `curviate account list --json`; they change when an account is reconnected, so never hard-code
one.

## Retrieval mode — `--mode` and `--max-age`

Exactly four reads decide between a stored copy and a live LinkedIn call: `profile me`,
`profile <id>`, `inbox get` and `inbox messages`. Two of them are here.

| `--mode` | Behaviour |
|---|---|
| `auto` (default) | A stored copy while it is fresh, otherwise fetch. |
| `live` | Always fetch from LinkedIn. |
| `refill` | A stored copy at any age; fetch only when nothing is stored. |
| `cache_only` | Never fetch. A store miss is refused, not fetched. |

`--max-age <seconds>` (0 to 31536000) overrides those presets in both directions; `--max-age 0` is
the same as `--mode live`.

Every response carries its provenance: `source: store | live` plus `observed_at` under `--json`, and
a `provenance:` line on stderr in human mode. Read `source` rather than assuming.

```bash
curviate profile me --mode live --json          # source: live
curviate profile me --mode cache_only --json    # source: store, with observed_at
```

Three mechanics that decide whether a retrieval-mode call works:

- **`cache_only` with `--max-age` is a usage error, exit `2`**, raised before any network call.
  `cache_only` never reaches LinkedIn at any age, so a freshness threshold cannot change its answer.
  Drop `--max-age`, or use `--mode refill`.
- **`cache_only` on a store miss is exit `14` (`NOT_STORED`)** — the profile may exist perfectly well
  on LinkedIn, this API just holds no copy. It is not "not found" (`4`), so re-checking the
  identifier is the wrong move, and it is not retryable as sent. Re-read with `--mode refill` (fetch
  once, store it), `auto`, or `live`.
- **Every other command refuses the flags outright rather than ignoring them**: `unknown flag
  --mode`, exit `2`. A retrieval-mode habit applied to `search people` fails loudly, which is the
  good case — you are never silently served an unintended freshness.

One same-named flag is unrelated: `job publish --mode FREE|PROMOTED|PROMOTED_PLUS` selects a
publishing tier and spends money. It has nothing to do with retrieval.

## `profile` — members

`profile <id>` accepts a vanity slug, a full profile URL (country subdomains such as
`de.linkedin.com` included), a URN, a native member id (`ACoAA…`), or `me`.

| Command | What it does | Confidence |
|---|---|---|
| `curviate profile <id>` | One member's profile. Accepts `--mode`/`--max-age`, `--sections`, and the activity flags below. | proven |
| `curviate profile me` | Your own connected profile. Accepts `--mode`/`--max-age`. | proven |
| `curviate profile <id> --posts` | That member's activity feed (posts and reposts). Same data as `post user-posts <id>`. | proven |
| `curviate profile <id> --comments` | That member's comments on other people's posts. Same data as `comment user <id>`. | proven |
| `curviate profile <id> --reactions` | That member's reactions. Works on any public profile. Returns `value` and `post_id`; no timestamp exists. | proven |
| `curviate profile <id> --sections <list>` | LinkedIn sections: `linkedin_experience`, `linkedin_education`, `linkedin_languages`, `linkedin_skills`, `linkedin_certifications`, `linkedin_volunteer_experience`, `linkedin_projects`, `linkedin_recommendations`, `linkedin_interests`, or `linkedin_*` for all. A bare `skills` auto-prefixes. **Pair with `--verbose` every time.** | proven |
| `curviate profile update [--headline] [--bio] [--first-name] [--last-name] [--skills] [--picture] [--background-picture]` | Update your own profile. Only the flags you pass are sent. | proven |
| `curviate profile subscription` | Your premium entitlements and plan. A free account is a valid result (`has_premium: false`), not an error. | proven |
| `curviate profile analytics` | Profile viewers, followers, post impressions and search appearances over LinkedIn's own fixed reporting windows. No window selector exists. | proven |
| `curviate profile visitors` | Recent profile viewers, classified by disclosure fidelity: identified, semi-anonymous, or aggregate. Premium accounts see more identified viewers. | proven |
| `curviate profile ssi` | Social Selling Index: overall score, four pillar breakdowns, industry and network percentile ranks. | proven |
| `curviate profile endorse <id> --endorsement-id <id>` | Endorse a skill. Irreversible — there is no unendorse. | **wired, never live-fired** |

`profile follow`, `unfollow`, `relations`, `followers` and `following` belong to the network
workflow — see `curviate-network`.

### Traps

- **`--sections` returns zero items unless you also pass `--verbose`.** The slim projection strips
  the section payload even when you asked for that exact section. Always pair them.
- **`emails` and `phone_numbers` need `--verbose`, and `--fields` does not escalate for you.**
  `profile <id>` slim strips both; `profile me` slim keeps `emails` and drops `phone_numbers`.
  `--fields emails,phone_numbers` without `--verbose` returns `{}` and a stderr warning — which
  reads exactly like "this member published no contact details". It is not.
- **Contact fields are gated on first-degree connection, and absent rather than empty below it.** At
  second degree `emails` and `social_handles` are missing from the response entirely and
  `phone_numbers` is `[]`. Fetch from whichever account is actually connected, and re-fetch after an
  invitation is accepted. A profile read costs the same either way, so pass `--verbose` up front
  rather than paying for two reads.
- **`specifics.throttled_sections` is `--verbose`-only, and it is a correctness signal.** It names
  the sections LinkedIn rate-limited on this request. Without it you cannot tell "this member has no
  listed experience" from "the experience section was throttled, retry it". Read it before treating
  an empty section as ground truth, and requery only sections that actually appear in it.
- **A missing member and a premium-gated member are indistinguishable on a non-premium account.** A
  nonexistent slug returns `LINKEDIN_FEATURE_NOT_SUBSCRIBED`, exit `5`, never `404`/exit `4`. Deep
  reads of some out-of-network members hit the same gate even though the search that found them
  needed no subscription at all. Verify a handle through `search people` before concluding that a
  subscription would fix it.
- **A profile write can take minutes to about two and a half hours to appear on read-back.** A
  `profile update` returning exit `0` was accepted. A stale-looking read immediately after is not
  evidence the write failed.
- **A profile fetch is a real, member-visible profile view** and consumes the account's daily
  profile-view allowance. Do not fetch speculatively in a loop.
- **Never write `profile me relations`.** The command is `profile relations`. Older builds silently
  discarded `relations` and answered with your own profile at exit `0`; current builds exit `2`.

## `company` — company pages

`company <id>` takes a slug, URL or numeric id. **Its sub-resources need the numeric provider id**
returned by that first call, so it is always two steps.

| Command | What it does | Confidence |
|---|---|---|
| `curviate company <id>` | The company profile: name, employee count, website, industry. | proven |
| `curviate company <id> employees` | People who currently work there. Supports `--keywords`. | proven |
| `curviate company <id> posts` | The page's posts. | proven |
| `curviate company <id> jobs` | The page's open postings. | proven |
| `curviate company managed` | The pages this account administers. An empty result is valid. | proven |
| `curviate company <id> followers` | A page's followers, newest first. Admin-gated. | proven |
| `curviate company <id> invitable-followers` | First-degree connections eligible to be invited to follow the page. Items carry no name or headline — hydrate a candidate with `profile <id>` before deciding. `invite_token` is always base64. | proven |
| `curviate company <id> follow-invite --invitee <member_id>` | Invite those connections to follow the page. Admin-gated write, one `--invitee` per person. | proven |
| `curviate company <id> chats` | The page's admin message inbox. Admin-gated. Beta. | proven |
| `curviate company <id> chat <chat_id>` | One conversation from that inbox. Admin-gated. Beta. | proven |
| `curviate company <id> messages <chat_id>` | A page conversation's messages, newest first. Admin-gated. | proven |
| `curviate company <id> message <chat_id> <message_id>` | One message from a page conversation. Admin-gated. | proven |
| `curviate company <id> search-chats [query]` | Search the page inbox. Exactly one mode per call: free text, `--topic`, or `--unread` — mutually exclusive, enforced server-side. Admin-gated. | proven |
| `curviate company <id> reply <chat_id> <text>` | Reply in a page conversation, as the page. Admin-gated write. Reply-only: it cannot start a conversation. | proven |

**`follow-invite` is all-or-nothing.** A request where every invitee id is valid returns one outcome
per invitee in request order (`invited`, `already_invited`, `ineligible`, `not_found`). A single
invalid id rejects the whole request with a `404` rather than a partial result. Re-inviting someone
already invited is a safe no-op that returns the same invitation id, never a duplicate.

## `search parameters` — turning words into filter ids

Structured search filters take opaque ids, not human text. Resolve first, then search.

```bash
curviate search parameters --type LOCATION --keywords "Germany" --limit 5 --json
curviate search people --location <id> --keywords "AI engineer" --json
```

| Command | What it does | Confidence |
|---|---|---|
| `curviate search parameters --type <T> --keywords "<term>"` | Resolve a term to filter ids. `--type` is one of `LOCATION`, `PEOPLE`, `CONNECTIONS`, `COMPANY`, `SCHOOL`, `INDUSTRY`, `SERVICE`, `JOB_FUNCTION`, `JOB_TITLE`, `EMPLOYMENT_TYPE`, `SKILL`. Both flags required for every type. | proven |
| `curviate search service-parameters --keywords "<term>" [--type service_category\|location]` | The same resolution for the Services Marketplace filters `search services` accepts. `--type` defaults to `service_category`. | proven |

- **A filter value that is a name rather than an id is silently dropped and the search runs
  unfiltered, at exit `0`.** `--location "Germany"` has returned results from New York, Bengaluru and
  Toronto with no warning at all. Resolve every `--location`, `--industry`, `--company` and
  `--school` value through this command first.
- **`JOB_FUNCTION` returns string tokens** (`eng`, `sale`), not numeric ids, unlike every other type.
  Pass the string straight into `search jobs --function`.
- **`--type PEOPLE` is a working name-to-member lookup** and returns real member profiles; it is also
  how you resolve `search people --followers-of`.
- Results carry both `id` and `public_identifier`, so they chain directly into a connect or a message.

## Session and connected accounts

| Command | What it does | Confidence |
|---|---|---|
| `curviate login --api-key <key>` | Store an API key in a local profile. | proven |
| `curviate config list` | Every stored profile and the active one. Keys are redacted. | proven |
| `curviate config path` | The config file path. | proven |
| `curviate config use <name>` | Set the active profile. | proven |
| `curviate config rename <old> <new>` | Rename a profile. | proven |
| `curviate config set-account <acc_id>` | Set a profile's default acting account. | proven |
| `curviate config set-base-url [url]` | Set or clear a profile's base URL. | proven |
| `curviate config reset` | Remove the config file, or one profile. | proven |
| `curviate account list` | Connected LinkedIn accounts — where an `acc_id` comes from. | proven |
| `curviate account get <acc_id>` | One account, including `quotas[]`: per-action daily allowances with their reset times. **This is the one command that reads your remaining allowance back.** The id is positional even when the profile has a default. | proven |
| `curviate account link --seat-id <id> --auth-method <m>` | Connect a LinkedIn account to an empty seat. Prompts for a verification code interactively; a non-interactive shell exits `12` and you finish with `account checkpoint solve`. | proven |
| `curviate account connect-session poll --session <id>` | Poll an in-progress connect. `status` is `pending`, `resolved`, `expired` or `failed`. `--wait` blocks until a terminal state. | proven |
| `curviate account checkpoint solve <acc_id> --code <otp>` | Answer a checkpoint challenge with a one-time code. | proven |
| `curviate account checkpoint poll <acc_id>` | Poll for mobile-app approval of a pending challenge. `--wait` blocks. | proven |
| `curviate account checkpoint request <acc_id>` | Re-send the challenge notification. Not every challenge type can — an authenticator-app code has nothing to re-send. The response's `resent` boolean is honest; the command exits `0` either way, so read the field. | proven |
| `curviate account update <acc_id>` | Update account metadata or custom-proxy configuration. | proven |
| `curviate account disconnect <acc_id>` | Hard-disconnect an account and release its seat. | proven |

**Zero connected accounts is a valid state**, not an error: a fresh tenant authenticates fine and
`account list` returns an empty list. Every account-scoped command is unusable until an account is
connected.

**Verify each account, not just the first.** `account list` proves an account exists and reads
`status: "active"`; it does not prove the session round-trips. For each id:

```bash
curviate profile me --account <acc_id> --fields first_name,last_name,headline --json
```

Exit `0` with a populated name proves auth, account scoping and field projection work together.

## Exit codes to branch on here

Branch on the exit code, never on the message text. Under `--json` an error prints
`{"error": {"code", "message", …}}`.

| Code | Meaning | What to do |
|---|---|---|
| `2` | Usage or invalid input, often raised before any network call. | Fix the invocation. Never retry unchanged. |
| `4` | Not found. | Wrong identifier, or the resource is gone. |
| `5` | Three causes share this code — read `error.code`. `NO_ACTIVE_SEAT`: the account is not on an active seat (attach or buy one, then retry). `LINKEDIN_FEATURE_NOT_SUBSCRIBED`: the LinkedIn account itself lacks the feature. `BETA_NOT_ENABLED`: the operation is beta-gated and this workspace has not opted in. | Branch on `error.code`. On a non-premium account a nonexistent handle also returns this — verify the handle before assuming a subscription is the fix. |
| `6` | `PLATFORM_RATE_LIMIT` and its siblings. Carries `retry_after` in whole seconds. | **Back off and retry** after that many seconds. |
| `8` | Account or connection state. Read `error.code`: `ACCOUNT_RESTRICTED`, `LINKEDIN_AUTH_FAILED` and `LINKEDIN_COOKIE_INVALID` need a reconnect; `LINKEDIN_OPERATION_NOT_SUPPORTED` is a permanent platform limitation and never retryable. | Depends on `error.code` — do not assume "reconnect" covers all of them. |
| `12` | A connect flow needs its next authentication step. | Run the checkpoint flow, or poll the connect session. Distinct from `9`, a checkpoint *failure*. |
| `13` | `BUDGET_EXHAUSTED` — a ceiling of your own refused the action. **Nothing reached LinkedIn and nothing was spent.** `reset_at` can be weeks out, and may be `null` where no clock frees it. | **Do not back off and retry.** Read `quotas[]` via `account get`, then either wait for the named reset or raise the ceiling. A retry loop here only burns time. |
| `14` | `NOT_STORED` — a `cache_only` read the store cannot answer. | Re-read with `refill`, `auto` or `live`. Re-checking the id is the wrong move. |
