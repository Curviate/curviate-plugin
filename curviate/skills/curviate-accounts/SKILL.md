---
name: curviate-accounts
description: "Connected Accounts, Mailboxes and Teams with the Curviate CLI: connect or reconnect an Account or a Mailbox, health and quotas, warm-up, safety limits, Active hours, the Activity level, roles, invites, seats, the plan and the spending cap, Notifications, stored profiles. Use when an Account or Mailbox needs connecting or fixing, a limit or role refused something (exit 5, 8, 9, 12, 13), or the user asks what their Team can do."
---

# Curviate: Accounts and Teams

An **Account** is a LinkedIn account connected to a Team, sitting on a **seat**. A **Team** holds the seats, the people
and the data, and holds the **plan** or not. Setup and the exit-code table: `curviate`.

Established against CLI `0.50.0-next.4`, Mailboxes against `0.58.0`. Commands with no tag ran against a local server with a
fake LinkedIn. `live` marks those proven on a live account.

## Connect or reconnect

**Curviate asks for a LinkedIn sign-in only inside its own dashboard.** Never ask for a password, cookie or verification code
in chat. A connect request hands that to the person:

1. `curviate account connect-request create --json`, or `--reconnect <acc_id>` for one that lost its session. Add
   `--warm-up` for a new or little-used LinkedIn account, or if the user asks: warm-up is off by default. Done when it
   prints `url` and `id`.
2. Give the person the `url`: open it in the browser where they are signed in to Curviate, or open Accounts in the dashboard,
   where it is listed. It expires (`expires_at`, minutes).
3. Poll `curviate account connect-request get <id> --json`. Done when `status` leaves `pending`: `completed` carries
   `account_id`; `expired`, `failed` and `cancelled` are final, so create a fresh one. `connect-request cancel <id>` withdraws it.
4. **Read it back**: `curviate core profile me --account <acc_id> --fields first_name,last_name --json` proves the session
   round-trips (`live`). Then `curviate config set-account <acc_id>` makes it the profile's default.

Needs a free seat: read `curviate account seats`. None free: an Owner adds one (see The plan, seats and the spending cap). **Keep connected** (automatic re-login) is dashboard-only, enabled by the Account's own person: suggest it
when reconnects recur.

`curviate account link` and `account checkpoint solve` connect from a terminal, with secrets the person types themselves: leave
them to that person at their own terminal, and read their `--help` there. Exit `12` means the next step is due, and `9` that the
challenge died (start over with `--account-id <acc_id>`). `curviate account connect-session poll --session <id>` and `curviate account checkpoint poll <acc_id>` read progress; `curviate account checkpoint request <acc_id>` re-sends, and its `resent` field is
honest.

`curviate account disconnect <acc_id>` is hard and releases the seat. Location:
`curviate account update <acc_id> --country <CC>` makes LinkedIn see a new IP and may ask the owner to verify, so change it only
when wrong. A connect names exactly one location, else `CONNECTION_LOCATION_REQUIRED` (exit `2`).
`CONNECTION_LOCATION_UNAVAILABLE` (exit `8`): a nearby country, or `--allow-country-fallback`. `ACCOUNT_ALREADY_LINKED` (exit `8`):
reconnect that account in place instead.

## Mailboxes

A **Mailbox** is an email address of the Team that Campaigns send from. It sends for one Account, for any Account
(`shared`) or for none. Every role reads; Owners and Managers change any Mailbox, a Member the ones they connected.
How email is doing: `curviate analytics email --range 30d --json` (`curviate-campaigns`).

```bash
curviate mailbox list --json
curviate mailbox get <mbx_id> --json
curviate domain check <domain>
```

Read `mailbox get` before you explain why an email waits: state, daily cap, sent today, bounces. `ramping` works up to its cap
on its own; `paused` is a person's pause, lifted with `curviate mailbox resume <mbx_id>`; `paused_by_bounces` and
`paused_by_provider` are not yours to lift: tell the user what the read says. `cap_lowered_to` means a spam reading lowered the
cap. `curviate mailbox update <mbx_id>` sets who it sends for, the daily cap, the signature, the From name and warm-up; `--help`
names the ranges. Mailbox warm-up is included in the plan. `landing` on `mailbox get` says where its warm-up mail lands per provider: report the verdict as read. Warm-up `waiting` means on but not running, its day held: `reason` says what lifts it (`reconnect_needed`,
`trial`, `app_password`, `warm_up_app`, `allowance`, `paused_by_curviate`, `address_check`: nothing to do,
`address_unconfirmed`: check the connection settings). `reputation` is 0 to 100, or null: with `reputation_reason` `warm_up_off` there is no score because warm-up is off,
else it is gathering; never say 0. `landing.reason` `warm_up_off`: nothing to read while warm-up is off.

`curviate mailbox test <mbx_id> --subject <s> --body-file <file>` sends the user's exact email to 12 test inboxes and reads where
each copy lands; `curviate mailbox tests <mbx_id> [<test_id>]` reads the verdicts within the hour. Each test spends 12 of today's
cap and one of the Team's monthly tests (10 per paid seat), so it waits for a go. Exit `5` with
`PLACEMENT_TEST_ALLOWANCE_EXHAUSTED`: the month's tests are used; never retry it. `curviate campaign placement <mot_id>` reads a
Campaign's weekly checks.

### Buy Mailboxes from Curviate

Curviate sells Mailboxes, never domains: they go on a domain the user already owns and brings, a separate one from the
domain their company email runs on. Never offer to buy or register a domain. Only a Team Owner's key buys.

1. Ask the user for the count, the domain (a whole domain they own, never a subdomain such as `mail.acme.com`) and each
   Mailbox's address part and name. Never state a price of your own, from memory, help text or an earlier answer.
2. `curviate billing cap --json`: `mailbox_cap` holds `cap`, `count` and `room`. More than `room` is refused: say so and
   stop. Never split an order to fit; only an Owner raises the cap, in the dashboard. No `mailbox_cap` means orders are
   closed right now.
3. `curviate mailbox quote <count> --json`: the server's price for this Team, now. `orderable: false` stops here with its
   `not_orderable_reason`. Show it as served: `amount` and `unit_amount` (minor units) for `billing_period`, plus tax
   where `plus_tax`, and when it is `charged`. A yearly Team (`annual`, `when_records_found`) pays the rest of its
   billing year the day the records are found, not a monthly amount: say so in those words. `charge_waits_for` says the
   charge waits for a payment or a subscription.
4. Show the count, the domain, the addresses and that quote, and wait for an explicit go for exactly that.
5. On the go, run one `curviate mailbox buy --domain <d> --mailbox local:Name ... --yes --expect-amount <amount>`, the
   quote's `amount`. Exit `11` means the order's `price` was not the quote: the CLI cancelled it while it waited for its
   records (nothing charged). Report both prices; a new order needs a new quote and a new go. Otherwise compare the
   order's `price.amount` and `billing_period` with the quote yourself; a difference the CLI did not catch: cancel it
   with `curviate mailbox purchase cancel <id>` and report it. Report any notice (`SPENDING_CAP_NEAR`). Show the six
   records it prints (`verify` among them) for the user to add at their DNS host exactly as shown; nothing is charged
   until they are found.
   `curviate mailbox purchase check <id>` looks now.

Every refusal is reported as it reads and never worked around or retried: `MAILBOX_SALES_PAUSED` (orders closed right
now), `SPENDING_CAP_REACHED` (exit `5`, the cap), `INSUFFICIENT_ROLE` (exit `5`: only an Owner's key buys Mailboxes
from Curviate), `MAILBOX_PURCHASE_TRIAL` (a Team on a trial cannot buy), `DOMAIN_IS_COMPANY_EMAIL`,
`MAILBOX_PURCHASE_PENDING`, and `MAILBOX_STATE_CONFLICT` "still settling with billing": tell the user they may try
again later; you do not resend it. `curviate mailbox purchase list` reads the orders. `provisioning` means charged and
being set up; `cancelled` with `host_failed` means setting up failed and Curviate undid the charge in full. Neither is
a reason to retry or to order again. `curviate mailbox purchase cancel <id>` ends an order still waiting; exit `8`
while it is being charged is neither a failure nor done: read it again later and never repeat the cancel. No password
of these Mailboxes ever reaches you.

### Connect or reconnect a Mailbox

The person signs in on Google's, Microsoft's or Curviate's own page. You prepare the request and hand over its link; the
password goes from the person straight to that page.

1. `curviate mailbox discover <address> --json`: the connection the address takes (Google sign-in, Microsoft sign-in, a
   Google app password, or IMAP and SMTP settings). Show settings marked `confirm_required` to the person and use them only as
   confirmed. Done when the person agrees on the connection.
2. `curviate mailbox connect <address> --connection <connection> --json`, for IMAP with the six server flags as confirmed.
   Done when it prints the request `id` and `url`.
3. Give the person the `url`. On that page they sign in with Google or Microsoft, or type the app password or IMAP password
   themselves. A private Gmail address takes an app password, which the person creates in their own Google account. A request
   that carries `admin_consent_url` goes to the Microsoft administrator of that domain, through the person.
4. Poll `curviate account connect-request get <id> --json` until `status` leaves `pending`; `completed` carries `mailbox_id`.
   Read it back with `curviate mailbox get <mailbox_id>`.

**A password stays with its person.** When the user offers a password in the chat, give them the link instead. A person who
prefers their own terminal reads `curviate mailbox connect --help` there and runs it themselves, typing the password into that
terminal; it never passes through you, a file you wrote or a command you compose.

A Mailbox in `reconnect_needed` comes back like an Account: `curviate mailbox reconnect <mbx_id> --json`, then steps 3 and 4.
`curviate mailbox remove <mbx_id>` deletes the Mailbox and its stored credentials and drops every email due from it; there is
no undo but connecting again, so it waits for a go.

## Read an Account's health

```bash
curviate account list --fields account_id,status,full_name --json
curviate account get <acc_id> --fields status,quotas,health,warm_up,activity_window,account_states --json
curviate account overview <acc_id> --json     # status, outcomes, today's rows, Campaigns, flags with the next command
curviate account metrics <acc_id> --json      # daily: connections, followers, viewers, SSI; empty until synced
```

`status: active` is the only state that works. `reconnect_needed`, `restricted` or `connecting` pause that Account's Campaign work and
hold its Enrollments in `waiting.kind: account_unavailable`. After `restricted`, stop its work and wait out LinkedIn's restriction.
**Zero Accounts is a valid state**, not an error.

`quotas[]` is one row per budget row: `used`, `remaining`, `ceiling`, `effective_ceiling` (the one that holds, warm-up applied),
`resets_at`, `halt`. Read `effective_ceiling` when sizing work. Rows with a limit also carry `target` and
`effective_target` (target with warm-up and health applied): what the Account aims at today, below the ceiling. The target is drawn per day from the Account's own limit and the Activity level (see below), so it differs from day to day. **Same name, new
meaning:** `connection_requests_no_note` counts every invitation, noted or not, so its `used` is the invitation total;
`connection_requests_with_note` is only the noted limit a free profile carries.

`health` is Curviate's inference of how LinkedIn sees the Account: `state` is `healthy`, `watch`, `slowed` or `stopped`, with
`factor`, `reasons` and `until`. It multiplies with warm-up: a `slowed` Account gets fewer invitations and views, nothing moves
work between Campaigns by itself. A restriction stops all Campaign work; a very large pending pile stops new invitations while
withdrawals continue. It is absent on an Account the user can see but not operate.

**Curviate sees only what it sends.** Actions sent by hand on LinkedIn, or by another automation tool on the same Account, are
invisible to it and to every limit and to `health`; LinkedIn's refusal is the only sign. Do not run another tool on a connected Account.

## Limits, warm-up, Active hours

Limits always refuse at the ceiling, for every caller, with `BUDGET_EXHAUSTED`, exit `13`. Nothing reaches LinkedIn. `safetyHint.parameter`
names the setting, such as `profile_views.ceiling`. A Campaign waits instead. Raising a limit is the user's call: name the row, the number and the risk to their real account. A value is stored as set; above Curviate's default the update warns, and what is enforced is held at the row's hard maximum (`hard_maximum`; `above_hard_maximum` says when the value is above it).
`profile_views` is one limit for Campaigns, imports, the Signal watch and direct calls: `used_by_cause` on that row splits today's use into `campaign`, `import`, `signal_watch` and `api`. Read it before you blame one of them. `curviate account safety events <acc_id>` lists what was refused, newest first.

```bash
curviate account safety get <acc_id> --fields active_hours,warm_up,limit_profile --json
curviate account safety update <acc_id> --file policy.json
curviate account safety update <acc_id> --activity-level increased
curviate account warm-up on <acc_id>
curviate account warm-up off <acc_id>
```

`policy.json` holds only what changes: `{"rows":[{"budget_row":"profile_views","ceiling":40}]}`, or
`{"active_hours":{"days":["mon","tue","wed","thu","fri"],"start":"09:00","end":"17:00"}}`, or `{"auto_withdraw":false}`. A row's `green` is its target; raising a ceiling alone moves the target too. `null` clears an override back to
the Team's default. It prints the policy: confirm `effective_ceiling` and `active_hours.source` (`account` or `team`).

- **Warm-up** is off by default: full limits from the start. On, ceilings start at 15% and rise to full over 5 weeks, from
  the connect or from the moment it is turned on; `warm_up.factor` is the current ramp. Turn it on (`--warm-up` at connect,
  or `account warm-up on`) for a new or little-used LinkedIn account, or when the user asks. Recovery after a restriction
  applies either way.
- **Activity level** (`activity_level`, `normal` by default, or `increased`) sets how close the Account's daily targets sit to its limits: `normal` aims about midway between the green figure and the limit, `increased` close to the limit, never past it, and it raises the chance LinkedIn notices the activity. Set it with `curviate account safety update <acc_id> --activity-level increased` (or `activity_level` in `policy.json`), only when the user decides, naming the risk to their real account. It falls back on its own: while warm-up is on or `health.state` is not `healthy`, the Account runs as `normal` and the setting stays. `account safety get` shows `activity_level_effective` (what is in force) and `activity_level_reason` (why it differs, else `null`); one `account.activity_level_fallback` Notification says when it falls back, none when it returns. Read `activity_level_effective` before telling the user which level runs. The limits and the breakers are unchanged.
- **`auto_withdraw`** (on by default): when the pending pile grows past what LinkedIn tolerates, Curviate withdraws its own old, unanswered invitations a few at a time and never re-invites them. Invitations sent by hand are never touched. Turn it off only if the user decides.
- **Active hours** are per Account, read in its own time zone, which comes from where it connects and nobody sets. Outside them live writes
  refuse with `safetyReason: activity_window` and Campaigns wait. **A direct message is the exception**: send, new chat, edit,
  delete, reaction, read mark, by the user or by you on their behalf, go at any hour on any day. Limits, warm-up, halts and
  do-not-contact still apply, and so does the wait after a location change. A Team default and an Account's own value both exist; the CLI
  changes only the Account's. The Team default: the dashboard, Settings.
- **`limit_profile`** (`basic`, `premium`, `sales_navigator`, `recruiter`) is what LinkedIn grants, detected at connect. It is not the plan.
- **Why was this refused?** The list of limit hits is REST-only today (`GET /v1/<account_id>/safety-events`): say so, or read `quotas[]`.

## The plan, seats and the spending cap

One plan includes everything; `curviate tier --json` says whether the Team holds it now, and any trial. Without it, every create, edit, start, resume, import and enrich answers `TIER_REQUIRED` (exit `5`): the Team has no subscription, and a person subscribes in the dashboard. Reads, exports, deletes, stops and withdrawing consent still pass. Campaigns pause when the plan is lost (`tier_required`) and never restart alone.

Owners only. A seat costs the price of the step it falls in, and the **spending cap** is the most seats an agent may bring
the Team to; its unit and default are in `curviate billing cap --help`, and no command sets it. To add or remove a seat:

1. **Read the cap first**: `curviate billing cap --json` (`cap_seats`, `seats`, `room_seats`). Too little room: tell the
   user now that the Owner raises the cap in the dashboard (Settings, Billing), and stop: no quote, no add.
2. **The price**: `curviate billing quote --seats <total> --period monthly`.
3. **Show and ask**: the seats, the price, the room left; the add waits for the user's go. Done on that go.
4. **One call**: `curviate billing seats add <qty> --yes` (`--yes` because no terminal can ask; your go is the
   confirmation). Never repeat it: every call buys. After a timeout, read `curviate account seats` first.

```bash
curviate billing quote --seats 12 --period monthly
curviate billing cap --json
curviate billing seats add 2 --yes
curviate billing seats remove <seat_id> --yes
curviate billing changes
```

`billing seats add`, `billing seats remove` and `billing period set annual` move money: run them only on the user's go for that change. An add past the cap is `SPENDING_CAP_REACHED` (exit `5`, nothing bought): tell the user the Owner raises the cap in the dashboard (Settings, Billing), and leave it there: no second add, no smaller add the user did not ask for. A `SPENDING_CAP_NEAR` notice on a successful add means the Team is close: say so. A removal ends the seat at the period end; the Team's last paid seat is `CANCEL_IN_DASHBOARD` (exit `5`): cancelling the subscription is a person's act in the dashboard, never an agent's. `curviate billing invoices` lists invoices.
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
| Operate Accounts; write a Campaign that sends from them | own and shared | own and shared | own |
| Delete Leads or Tags; remove from Do-not-contact | yes | yes | no |
| Change one Account's limits and Active hours | shared | no | own |
| Team name, logo, Team limits | yes | yes | no |
| Invite and remove | everyone | Members only | no |
| Disconnect someone else's Account; roles, billing, beta consent, lend seats | yes | no | no |

Only the **Account's own person** can turn on Sync full inbox, enable Keep connected, finish a reconnect, and flip
`curviate account team-access off <acc_id>`, which keeps the Account to that person and takes it out of every Campaign; `curviate account team-access on <acc_id>` shares it again and does not rejoin a Campaign. Read it with `curviate account list --verbose --fields account_id,team_access`.

**An invitee has no role until they accept**, in the dashboard, from the link in their email: until then `team invites list` reads `pending` and `team members` omits them. `curviate team remove <user_id>` and `curviate team leave` disconnect that person's Accounts. A new Team has no seat or plan:
`team create` prints `next_step`.

## Notifications

Run `curviate notification list --unread --json` at the start of a session (`curviate notification count` is cheap). Mark with `curviate notification read <id>`, `curviate notification read-all`, `curviate notification archive <id>`. LinkedIn's own feed cards are `curviate-engage`.

| Type | Do |
|---|---|
| `account.reconnect_needed` | A connect request with `--reconnect`. |
| `account.restricted` | Stop that Account's work, read `account get`, wait out LinkedIn's restriction. |
| `account.keep_connected_failed` | The Account's person, in the dashboard. |
| `account.health_worsened` | Read `account get <acc_id> --fields health`; the Notification names the Campaign with the lowest acceptance. Review its list and copy with the user. |
| `account.campaign_work_paused` | A safety breaker paused that Account's Campaign work for an hour. Nothing to retry; it resumes by itself. Tell the user. |
| `account.activity_level_fallback` | `increased` runs as `normal` for now (warm-up is on, or health shows warning signs). The setting stays and returns on its own. Read `account safety get <acc_id> --fields activity_level,activity_level_effective,activity_level_reason`. |
| `campaign.auto_paused` | The acceptance floor fired: review the list and copy with the user before resuming. |
| `campaign.no_sending_account` | Reconnect or add an Account; it resumes itself. |
| `campaign.completed` | Read its results (`curviate-campaigns`). |
| `leads.import_finished` | Read the report (`curviate-leads`). |
| `export.finished` | `curviate export download <id> --output <file>`. |
| `team.invite_accepted`, `team.member_left` | Inform the user. |
| `mailbox.auto_paused`, `mailbox.provider_paused`, `mailbox.reconnect_needed`, `domain.dmarc_missing`, `domain.dkim_failing`, `provider.spam_high`, `account.no_mailbox` | An email problem that stops sending, delivered unread. Read `mailbox get` or `domain check`; a reconnect is the Mailbox flow above. |
| `mailbox.warm_up_off`, `campaign.variant_behind`, `campaign.emails_too_close` | Advice, delivered already read. Mention it when the user asks how email is doing. |

`--channel email|linkedin|team` filters the list.

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
| `ACCOUNT_RESTRICTED`, `LINKEDIN_AUTH_FAILED`, `LINKEDIN_COOKIE_INVALID`, `REAUTH_REQUIRED` | `8` | A connect request with `--reconnect`. |
| `CHECKPOINT_*` | `9` | The challenge is dead: connect again. |
