---
name: curviate-accounts
description: "Connected Accounts and Teams with the Curviate CLI: connect or reconnect an Account, its health and quotas, warm-up, safety limits and Active hours, Teams, roles, invites, seats, the Tier, Notifications, stored profiles. Use when an Account needs connecting or fixing, a limit or role refused something (exit 5, 8, 9, 12, 13), or the user asks what their Team can do."
---

# Curviate: Accounts and Teams

An **Account** is a LinkedIn account connected to a Team, sitting on a **seat**. A **Team** holds the seats, the people
and the data, and has one **Tier**. Setup and the exit-code table: `curviate`.

Established against CLI `0.50.0-next.1`. Commands with no tag ran against a local server with a fake LinkedIn. `live` marks
those proven on a live account.

## Connect or reconnect

**Curviate asks for a LinkedIn sign-in only inside its own dashboard.** Never ask for a password, cookie or verification code
in chat. A connect request hands that to the person:

1. `curviate account connect-request create --json`, or `--reconnect <acc_id>` for one that lost its session. Add
   `--no-warm-up` only if the user asks. Done when it prints `url` and `id`.
2. Give the person the `url`: open it in the browser where they are signed in to Curviate, or open Accounts in the dashboard,
   where it is listed. It expires (`expires_at`, minutes).
3. Poll `curviate account connect-request get <id> --json`. Done when `status` leaves `pending`: `completed` carries
   `account_id`; `expired`, `failed` and `cancelled` are final, so create a fresh one. `connect-request cancel <id>` withdraws it.
4. **Confirm**: `curviate core profile me --account <acc_id> --fields first_name,last_name --json` proves the session
   round-trips (`live`). Then `curviate config set-account <acc_id>` makes it the profile's default.

Needs a free seat: read `curviate account seats`. None free: the user adds one in the dashboard, Settings, Billing; the CLI
cannot buy one. **Keep connected** (automatic re-login) is dashboard-only, enabled by the Account's own person: suggest it
when reconnects recur.

`curviate account link` and `account checkpoint solve` connect from a terminal, with secrets the person types themselves: leave
them to that person at their own terminal, and read their `--help` there. Exit `12` means the next step is due, and `9` that the
challenge died (start over with `--account-id <acc_id>`). `curviate account connect-session poll --session <id>` and `curviate account checkpoint poll <acc_id>` read progress; `curviate account checkpoint request <acc_id>` re-sends, and its `resent` field is
honest.

`curviate account disconnect <acc_id>` is hard and releases the seat: **confirm with the user**. Location:
`curviate account update <acc_id> --country <CC>` makes LinkedIn see a new IP and may ask the owner to verify, so change it only
when wrong. A connect names exactly one location, else `CONNECTION_LOCATION_REQUIRED` (exit `2`).
`CONNECTION_LOCATION_UNAVAILABLE` (exit `8`): a nearby country, or `--allow-country-fallback`. `ACCOUNT_ALREADY_LINKED` (exit `8`):
reconnect that account in place instead.

## Read an Account's health

```bash
curviate account list --fields account_id,status,full_name --json
curviate account get <acc_id> --fields status,quotas,warm_up,activity_window,account_states --json
curviate account overview <acc_id> --json     # status, outcomes, today's rows, Motions, flags with the next command
curviate account metrics <acc_id> --json      # daily: connections, followers, viewers, SSI; empty until synced
```

`status: active` is the only state that works. `reconnect_needed`, `restricted` or `connecting` pause that Account's Motion work and
hold its Enrollments in `waiting.kind: account_unavailable`. After `restricted`, stop its work and wait out LinkedIn's restriction.
**Zero Accounts is a valid state**, not an error.

`quotas[]` is one row per budget row: `used`, `remaining`, `ceiling`, `effective_ceiling` (the one that holds, warm-up applied),
`resets_at`, `halt`. Read `effective_ceiling` when sizing work.

## Limits, warm-up, Active hours

Limits always refuse at the ceiling, for every caller, with `BUDGET_EXHAUSTED`, exit `13`. Nothing reaches LinkedIn. `safetyHint.parameter`
names the setting, such as `profile_views.ceiling`. A Motion waits instead. **Raising a limit is the user's call: name the row, the
number and the risk to their real account, and wait for a go.** Curviate never clamps a value it thinks unsafe.

```bash
curviate account safety get <acc_id> --fields active_hours,warm_up,limit_profile --json
curviate account safety update <acc_id> --file policy.json
curviate account warm-up on <acc_id>
curviate account warm-up off <acc_id>
```

`policy.json` holds only what changes: `{"rows":[{"budget_row":"profile_views","ceiling":40}]}`, or
`{"active_hours":{"days":["mon","tue","wed","thu","fri"],"start":"09:00","end":"17:00"}}`. `null` clears an override back to
the Team's default. It prints the policy: confirm `effective_ceiling` and `active_hours.source` (`account` or `team`).

- **Warm-up** holds ceilings below the limits after a connect or a quiet spell, on by default. `warm_up.factor` is the current
  ramp. Off skips those ramps; recovery after a restriction still applies. Leave it on unless the user decides.
- **Active hours** are per Account, read in its own time zone, which comes from where it connects and nobody sets. Outside them live writes
  refuse with `safetyReason: activity_window` and Motions wait. A Team default and an Account's own value both exist; the CLI
  changes only the Account's. The Team default: the dashboard, Settings.
- **`limit_profile`** (`basic`, `premium`, `sales_navigator`, `recruiter`) is what LinkedIn grants, detected at connect. It is not a Tier.
- **Why was this refused?** The list of limit hits is REST-only today (`GET /v1/<account_id>/safety-events`): say so, or read `quotas[]`.

## The Tier, and what Locked means

`curviate tier --json` reads `tier`, `features`, `trial`, `pending`. **Build** is core: profiles, messages, search, posts, connections, webhooks,
Accounts, Notifications, safety, Analytics reads, Teams. **Automate** adds `motions`, `contacts`, `unibox`, `network`, `drafts`, `keep_connected`.

A feature the Team lacks shows as **Locked** in the dashboard. Through the CLI it answers `TIER_REQUIRED`, exit `5`, with `feature`, `requiredTier`,
`currentTier` and `upgradeUrl`, on every create, edit, start, resume, import and enrich. Reads, exports, deletes, stops and withdrawing consent still
pass, so stored data is never held hostage. Motions pause when the Tier is lost (`tier_required`) and never restart alone. **Tell the user and give
the link: upgrades happen in the dashboard, and no command buys one.** `curviate billing invoices` lists invoices for Owners.
Beta: `curviate beta status`; `BETA_NOT_ENABLED`, exit `5`: `curviate beta update --enabled true` (an Owner), or `--beta` for one call.

## Teams and roles

```bash
curviate team list --counts --json
curviate team get --json
curviate team members --fields user_id,role,name --json
curviate team switch <team>
curviate team create "New team"
curviate team invites create a@example.com --role member
curviate team invites list
curviate team role <user_id> manager
curviate team seats lend --to <team_id>
```

| | Owner | Manager | Member |
|---|---|---|---|
| Read the Team's data, members, seats | yes | yes | yes |
| Operate Accounts; write a Motion that sends from them | own and shared | own and shared | own |
| Delete Contacts or Tags; remove from Do-not-contact | yes | yes | no |
| Change one Account's limits and Active hours | shared | no | own |
| Team name, logo, Team limits | yes | yes | no |
| Invite and remove | everyone | Members only | no |
| Disconnect someone else's Account; roles, billing, beta consent, lend seats | yes | no | no |

Only the **Account's own person** can turn on Sync full inbox, enable Keep connected, finish a reconnect, and flip
`curviate account team-access off <acc_id>`, which keeps the Account to that person and takes it out of every Motion (`ACCOUNT_OWNER_ONLY`, exit `5`).

**A role refusal is exit `5` (`INSUFFICIENT_ROLE`, `ACCOUNT_NOT_SHARED`): a person with the right role acts, and the key stays.** Never rotate a key
for it. `curviate team remove <user_id>` and `curviate team leave` disconnect that person's Accounts: confirm first. A new Team has no seat or Tier:
`team create` prints `next_step`.

## Notifications

Run `curviate notification list --unread --json` at the start of a session (`curviate notification count` is cheap). Mark with `curviate notification read <id>`, `curviate notification read-all`, `curviate notification archive <id>`. LinkedIn's own feed cards are `curviate-engage`.

| Type | Do |
|---|---|
| `account.reconnect_needed` | A connect request with `--reconnect`. |
| `account.restricted` | Stop that Account's work, read `account get`, wait out LinkedIn's restriction. |
| `account.keep_connected_failed` | The Account's person, in the dashboard. |
| `motion.auto_paused` | The acceptance floor fired: review the list and copy with the user before resuming. |
| `motion.no_sending_account` | Reconnect or add an Account; it resumes itself. |
| `motion.completed` | Read its results (`curviate-motions`). |
| `contacts.import_finished` | Read the report (`curviate-contacts`). |
| `export.finished` | `curviate export download <id> --output <file>`. |
| `team.invite_accepted`, `team.member_left` | Inform the user. |

## Stored profiles

`--profile <name>` picks a stored credential set; `--account` picks who acts on one call. `curviate config list` (keys redacted), `curviate config path`,
`curviate config use <name>`, `curviate config rename <old> <new>`, `curviate config set-account <acc_id>`, `curviate config set-base-url <url>`,
`curviate config reset`. `config set-account` needs a stored profile: with `CURVIATE_API_KEY` alone it exits `2`, so use `--account` or `CURVIATE_ACCOUNT`.
`curviate login` prompts on a terminal; an agent uses `curviate setup`.

## Errors in these flows

| Code | Exit | Do |
|---|---|---|
| `NO_ACTIVE_SEAT` | `5` | The Account is on no live seat: a person attaches or buys one. Re-running `setup` changes nothing. |
| `LINKEDIN_FEATURE_NOT_SUBSCRIBED` | `5` | LinkedIn's own plan lacks it. `curviate core profile subscription` reads what it grants. |
| `TIER_REQUIRED`, `INSUFFICIENT_ROLE`, `ACCOUNT_OWNER_ONLY` | `5` | See above. The key is fine. |
| `ACCOUNT_RESTRICTED`, `LINKEDIN_AUTH_FAILED`, `LINKEDIN_COOKIE_INVALID`, `REAUTH_REQUIRED` | `8` | A connect request with `--reconnect`. |
| `CHECKPOINT_*` | `9` | The challenge is dead: connect again. |
| `BUDGET_EXHAUSTED` | `13` | See Limits. |
