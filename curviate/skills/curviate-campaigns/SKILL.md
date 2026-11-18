---
name: curviate-campaigns
description: "Campaigns: build, start, pause, edit and read automated outreach on LinkedIn and email with the Curviate CLI. Covers Sequences (steps, delays, conditions, variants, email steps and the Lead check, variables and fallbacks), Enrollments, reply handling, custom and incoming events, Analytics. Use when asked to create or change a Campaign or Sequence, enroll people, or check how outreach is going."
---

# Curviate: Campaigns

A **Campaign** runs one **Sequence** for the Leads of its Lead lists, from its sending Accounts, on a schedule. Each Lead on each Account is one **Enrollment**. Curviate paces every action itself.

Established against CLI `0.50.0-next.6`, email steps and variants against `0.58.0`. Every command here ran against a local server with a fake
LinkedIn; none has been live-fired from this skill. `lint` and `init` are offline. Setup and the exit-code
table: `curviate`.

## Preconditions

Each read is free.

| Need | Read | If not |
|---|---|---|
| The plan | `curviate tier --json`: `features` holds `campaigns` and `leads` | `TIER_REQUIRED`. Without the plan a Team can read, stop and delete but not create. |
| Accounts that can send | `curviate account list --json`: `status` is `active` | A connect or reconnect: `curviate-accounts`. An Account with no live seat cannot send. |
| A role that may send | `curviate team get --json`: you must operate every sending Account | `INSUFFICIENT_ROLE`, `ACCOUNT_NOT_SHARED`. |
| Room in the limits | `curviate account get <acc_id> --fields quotas,warm_up,activity_window --json`: read `effective_ceiling`, not `ceiling` | A low `warm_up.factor` means the Account is warming up: size the list to it. Invitations, InMail and profile views also carry `target` and `effective_target`: Campaigns aim at the target, the ceiling is only the stop. |
| Anything already wrong | `curviate notification list --unread --json` | Handle a paused Campaign or a disconnected Account first (`curviate-accounts`). |
| The people | A Lead list with first names and any per-person text filled in | `curviate-leads`, before the Campaign. |

## Build it: the loop

Each step ends on something you can read.

1. **Start from a template.** `curviate campaign init --template connect-and-converse --output campaign.json`.
   Done when the file exists. Templates: `connect-and-converse` (strangers: visit, like a recent post,
   blank invitation, two messages), `engage-then-connect` (they post: react, comment, invitation),
   `nurture-connections` (existing Connections). To copy a Campaign, save `curviate campaign get <campaign_id> --json` to a file: `create` and `update` accept it as it is and drop what Curviate sets.
2. **Edit the file.** Fill `lead_list_ids` and `account_ids`; set `settings`; leave `schedule` out unless this Campaign must be narrower than the Team's days and hours
   (`curviate campaign create --help` lists every field and bound). Add `{{key}}` values to Leads first
   (see Variables). Done when no placeholder is left.
3. **Lint until clean.** `curviate campaign lint --file campaign.json` prints every problem at once, with a hint: fix them all, then lint again. Offline it cannot see the Accounts: read the other warnings at the next step. Done on exit `0`.
4. **Create the draft.** `curviate campaign create --file campaign.json`. A retry makes a second draft, so
   after a failure check `curviate campaign list --status draft` first. Done when `campaign get <campaign_id> --fields status,warnings` reads `draft` and you can explain each warning (`W3`: see Variants).
5. **Preview.** `curviate campaign preview <campaign_id> --sample 5 --json`: a read, it never reaches LinkedIn.
   Read `samples[].steps[].variants[].rendered` and `used_fallback`, `excluded`, `would_skip`, `warnings`,
   and `projection` (`audience.to_enroll`, `audience.skipped`, `summary`, `binding`). Done when you can
   explain each surprise, such as a fallback used for many, or fewer to enroll than the list holds.
6. **Show the user, then ask.** Show two rendered messages, the fallback, who enrolls, from which Accounts, and the `projection.summary`. Done on a go.
7. **Start.** `curviate campaign start <campaign_id>`.
8. **Read it back.** `curviate campaign get <campaign_id> --fields status,started_at,counts` then
   `curviate enrollment list --campaign <campaign_id> --limit 5 --fields id,status,account_id`. Done when status
   is `active` (or `scheduled`, when `schedule.start_at` is ahead) and Enrollments exist, usually `queued`.

What needs a go is listed in `curviate`. What was sent stays sent.

## The Sequence

`{"on_reply": "<step or end>", "steps": [...]}`. Steps run in order and fall through; `next`, `then` and
`else` jump to a step id or `end`. Each step has one kind:

| Kind | Example | Notes |
|---|---|---|
| Action | `{"id":"invite","do":"invite.send"}` | `do` is one of `profile.view`, `profile.follow`, `profile.unfollow`, `invite.send`, `invite.withdraw`, `message.send`, `voice.send`, `email.send`, `inmail.send`, `post.react`, `post.comment`, `skill.endorse`. Parameters in `with`. A step that cannot run continues (`else` to branch). `voice.send` plays an uploaded clip: `curviate-voice`. `email.send`: see Email steps. |
| Delay | `{"id":"w1","wait":"1d"}` | `<n>m`, `<n>h`, `<n>d`, or `<n>bd` (business days of the Campaign's schedule). At least that long, with a small random spread added. |
| Wait for | `{"id":"a","until":"invite.accepted","timeout":"21d","then":"next_step","else":"end"}` | `invite.accepted`, `message.replied`, `message.read`, `event.<name>`. `timeout` is required. |
| Condition | `{"id":"c","if":{"lead.connected":true},"then":"a","else":"b"}` | One predicate per step (`lead.tag`, `lead.degree`, `lead.posted_within`, `lead.<field>`, `lead.extra.<key>`, `message.seen`, `not`, ...). Chain steps for and/or. |
| Tag | `{"id":"t","tag":"no-reply"}` | Adds a Tag to the Lead, creating it if new. |
| Send event | `{"id":"e","emit":"handoff.ready"}` | Delivers `campaign.custom_event` by webhook. Or put `"event":"<name>"` on an action or tag step. |

Every path must end explicitly: the last step needs `"next":"end"`. No cycles, no unreachable step. Example: a blank invitation, two opener variants, one follow-up, a hand-off.

```json
{
  "name": "Q4 founders",
  "lead_list_ids": ["cl_YOUR_LIST_ID"],
  "account_ids": ["acc_YOUR_ACCOUNT_ID"],
  "settings": { "priority": "normal" },
  "sequence": {
    "on_reply": "replied",
    "steps": [
      { "id": "invite", "do": "invite.send", "with": { "withdraw_after": "21d" } },
      { "id": "accepted", "until": "invite.accepted", "timeout": "21d", "then": "w_opener", "else": "end" },
      { "id": "w_opener", "wait": "1d" },
      { "id": "opener", "do": "message.send",
        "variants": [
          { "id": "opener_a", "text": "Hi {{first_name}}, {{opener}}" },
          { "id": "opener_b", "text": "{{opener}} How do you handle this today?" }
        ],
        "with": { "fallback": "Hi, glad we are connected. How do you handle outreach today?" } },
      { "id": "r_opener", "until": "message.replied", "timeout": "5d", "then": "replied" },
      { "id": "followup", "do": "message.send",
        "with": { "text": "Quick follow-up in case this got buried, {{first_name}}.", "fallback": "Quick follow-up in case this got buried." } },
      { "id": "r_followup", "until": "message.replied", "timeout": "7d", "then": "replied" },
      { "id": "silent", "tag": "no-reply", "next": "end" },
      { "id": "replied", "tag": "in-conversation", "event": "handoff.reply", "next": "end" }
    ]
  }
}
```

### Email steps

An `email.send` step emails the Lead from a Mailbox (`curviate-accounts`). `curviate campaign create --help` lists its
fields (`on_missing`, `thread`, `opt_out` and its texts, `track_opens`, `attachment_ids`); the Mailbox's signature is a
variable of email steps only, as in the example:

```json
{ "on_reply": "end", "steps": [ { "id": "mail", "do": "email.send", "next": "end",
  "with": { "subject": "Quick question, {{first_name|there}}", "text": "Hi {{first_name|there}},\n\nHow do you handle outreach today?\n\n{{mailbox.signature}}", "opt_out": "link" } } ] }
```

- **Which Mailbox sends**: one that sends for the Lead's Account, taken in turn; a Mailbox in `shared_mailbox_ids` adds
  volume. Email steps keep the Campaign's `schedule`; Active hours hold back LinkedIn actions only.
- **One address per Lead.** A Lead without one is never enrolled (`skip_reason` `no_email_address`); filling addresses is
  `curviate-find-emails`. Opt-out and "No email" come from the Lead's own `do_not_contact` (`scope: email_only` is "No
  email"), which the Lead check counts: never page the Do-not-contact list for it.
- **A hard bounce ends email for that Lead** (`enrollment.email_bounced`). An address a tool found stays unverified until
  its first email goes out without a bounce.
- **Waits**: `no_mailbox`, `mailbox_cap` (the Mailboxes' daily caps are spent; it continues the next day),
  `email_unavailable`, `field_missing` (an `on_missing: hold`), `out_of_office`. `settings.reply_scope` decides whether a
  reply on one channel ends the other.

**Starting a Campaign with an email step** replaces steps 6 and 7 of the loop:

1. `curviate campaign check <campaign_id> --json` after the last edit: `leads`, `without_email`, `email_bounced`,
   `no_email` and the variables Leads lack. It sends nothing. Done when you can state each count.
2. `curviate campaign preview <campaign_id> --json` shows each email as the recipient sees it: subject, text, opt-out
   line. Show the user two.
3. Report the check. With Leads lacking an address, offer the choice: fill them first (`curviate-find-emails`), or start
   without them, who are then never enrolled. Done on the user's choice and go.
4. `curviate campaign start <campaign_id>`, adding `--skip-missing-email` only when the user chose to start without them.
   `CAMPAIGN_NOT_STARTABLE` lists each gap: report every one, fix it, run the check again and ask again. `resume` runs the
   same checks.

### Variables and fallbacks

Double braces only. `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{company}}`, `{{job_title}}`,
`{{headline}}`, `{{location}}`; `{{my_first_name}}` is the sending Account. Any other key is a Lead custom
field: `{{opener}}` reads `lead.extra.opener`. 

**Per-person text you researched goes on the Lead before the Campaign starts**, as a column named for the
key in an import (`curviate-leads`). Every messaging text with a variable needs a variable-free fallback
on its step: `with.fallback` (message, comment), `with.note_fallback` (invitation note: text or `drop`),
`with.fallback` as `{subject,text}` (InMail). A comment's fallback should be `skip`, not generic text. `used_fallback` in the preview tells you who gets the generic text.

A single brace around a variable is the classic mistake (`R18`).

### Variants

Replace `with.text` (or an invitation's `with.note`) with `variants`: 2 to 5, each `{id, text}` with an `id` unique in the document, on messaging steps only, sharing one fallback. An optional integer `weight` on every variant (all or none) skews the split; without it the split is even. A variant's key is `text` on an invitation too; `note` fails lint (`R23`, `R13`). InMail variants add `subject`. The split is sticky per Enrollment. Results: `curviate analytics get --campaign <campaign_id> --json`; one arm: `curviate enrollment list --campaign <campaign_id> --variant opener_a`.

```json
{ "on_reply": "end", "steps": [ { "id": "invite", "do": "invite.send", "next": "end",
  "variants": [ { "id": "note_a", "text": "Hi {{first_name}}, we met at the meetup." }, { "id": "note_b", "text": "Hi {{first_name}}, I liked your talk." } ],
  "with": { "note_fallback": "drop" } } ] }
```

**Noted invitations are scarce.** A `basic` Account has 3 a month, each up to 200 characters (`curviate account safety get <acc_id>`, row `connection_requests_with_note`). `campaign create`, `campaign update` and `campaign preview` warn `W3` when a note has no `note_fallback: "drop"`; `lint` cannot, because it never sees the Account. With the 3 spent, `drop` sends the invitation blank. 

### Replies

The Sequence decides what a reply does. Waiting in `until message.replied`, it takes that step's `then`;
anywhere else it jumps to `on_reply`, once per Enrollment. A target of `end` finishes the Enrollment as
`replied`. Route it: tag and hand off, as above.

**Humans own replies** (`curviate-unibox`), unless their Sequence routes the reply to a step they wrote.

### Waiting on an outside signal

- **Your agent.** A step `{"id":"wait_copy","until":"event.researched","timeout":"3d","then":"opener"}`, then
  `curviate enrollment event <enrollment_id> researched` once the text is on the Lead. A Sequence with no such step answers `INVALID_REQUEST`; a `queued` Enrollment, `ENROLLMENT_NOT_ACTIVE`.
- **Another tool.** `curviate incoming create --event-name booked --campaign <campaign_id> --match-linkedin-url <path>` prints a private URL once: treat it like a password. It starts `enabled: false`: run `curviate incoming capture <id>`, have the tool post once, check `curviate incoming get <id>`, then `curviate incoming update <id> --enabled`. `incoming arrivals` shows matches.
- **Tell another tool.** A webhook: choosing its source and event is in `curviate-inbox`.

### Settings worth deciding on purpose

- `priority`: `normal` (default, weight 1) or `prioritized` (weight 1.5). Every Campaign on an Account shares each of its budgets (invitations, InMail, messages, profile views, reactions, follows, comments), split by weight on every budget; a prioritized Campaign gets 3 slots for every 2 a normal one gets. Every Campaign with work due still progresses, no limit is ever passed, and a share nobody uses flows to the others the same day. There is no start cap to set: how fast people start follows the Campaign's share. The preview's `projection.accounts[]` says what limits it (`binding`) and the `expected_actions_per_day`. `new_enrollments_per_account_per_day` is retired: the API still accepts and ignores it for a while, and prints a notice.
- `accounts_per_lead`: above 1, each Account runs its own Enrollment, `account_gap` apart, and `on_reply_elsewhere` (`stop` by default) ends the others on a reply.
- `assign` picks each Lead's Account. `auto`, the default and right for any Campaign with a connect request: an Account already connected or in a chat with the Lead keeps them; everyone else waits unassigned in the Campaign's pool (`account_id` is null) until an Account with room takes them, and stays on it. `even` is retired (the API ignores it and prints a notice). `already_connected`: only an Account already connected; **everyone else is skipped, so no invitation ever goes out to them** (warning `W17`). Warm-only Campaigns alone.
- `exclude.other_campaigns`, `exclude.known_chats`: on by default. The Do-not-contact list always applies.
  `exclusion_list_ids` subtracts a Lead list; one list cannot be both source and exclusion.
- `exclude.pending_invites`: on by default. A Lead any Team Account has a pending invitation to, sent from Curviate or not, is skipped (`skip_reason` `pending_invite`; the preview counts it under `skipped.pending_invite`).
- `where`: stored-data filters, one predicate each. Skipped counts show in the preview.
- `acceptance_floor`: off by default; on, a low acceptance pauses the Campaign.
- `schedule`: days and hours, read in the Account's own time zone, which comes from where it connects.
  **Leave `schedule` out** (as the example above does) and the Team's days and hours apply; set `days` or `hours` only when this Campaign must run in a narrower window than the Team's, and never copy a window from an example. `schedule.timezone` is refused (exit `2`). Active hours (`curviate-accounts`) also hold a Campaign back.

## Run it

| To | Command | Read back |
|---|---|---|
| Hold everything | `curviate campaign pause <campaign_id>` | `status: paused`, `pause_reason: user`; waits keep their time |
| Continue | `curviate campaign resume <campaign_id>` (re-runs the start checks) | `status: active` |
| End it for good | `curviate campaign archive <campaign_id>` | `status: archived`; Enrollments finish `campaign_archived` |
| Delete a draft | `curviate campaign delete <campaign_id>` | `campaign get` exits `4`. Not a draft: archive it |
| Add people | `curviate campaign add <campaign_id> --lead <lead_id>`, or add to its Lead list | each `outcome` (`already_enrolled`, ...) |
| Take people out | `curviate campaign remove <campaign_id> --lead <lead_id>` | `removed`; `not_found` holds one with no open Enrollment. They do not come back while on the list: one Enrollment per Lead, Campaign and Account, ever. `campaign add` re-queues only one that never started; a started one answers `already_enrolled` |
| One person | `curviate enrollment pause\|resume\|stop <enrollment_id>` | `enrollment get <enrollment_id> --fields status,waiting,finish_reason` |
| A failed Step | `curviate enrollment retry <enrollment_id>` acts only on a failure, so it never re-sends | `NOTHING_TO_RETRY` if none failed |
| Jump | `curviate enrollment resume <enrollment_id> --at <step_id>` | **Not guarded: a Step that already sent sends again.** Read `enrollment get` first |
| Another Account | `curviate enrollment reassign <enrollment_id> --account <acc_id>` must be a sending Account; restarts at the first Step | Refused: `ACCOUNT_ALREADY_ENGAGED`, `ALREADY_ENROLLED_ON_ACCOUNT`, `KNOWN_CHAT` (exit `2`) |
| Many | `curviate enrollment bulk --action stop --campaign <campaign_id> --status queued`. List with the same filters first | one line per Enrollment; `matched` |

**Campaign status**: `draft`, `scheduled`, `active`, `paused`, `completed`, `archived`. `pause_reason`: `user`,
`acceptance_floor`, `no_sending_account` (fix an Account, it resumes itself), `tier_required` (never restarts on
its own). **Enrollment status**: `queued` (the filter also takes `pending`), `active`, `paused`, `finished`,
`failed`, `skipped`; `waiting.kind` says why it is not moving, and `finish_reason`, `skip_reason` say why it ended,
each with a sentence beside it. A stopped Enrollment takes only `resume --at`.

**Editing** is `curviate campaign update <campaign_id> --file <file> --if-revision <n>`: read the `sequence_revision` from `campaign get` first, and a stale save is refused with `SEQUENCE_CONFLICT`. Objects merge by key; arrays and the Sequence replace whole. The file holds only what changes. **A draft** edits freely: `sequence_version` stays 1 and `sequence_change` reads `none`; lint and preview again after. **After start**, a text, wait or timeout change is `sequence_change: copy` and
applies to Steps not yet reached. Anything else is `structural`: a new `sequence_version`, and running Enrollments
finish on theirs. `curviate campaign get <campaign_id> --version <n>` reads an old one and its `open_enrollments`.

### Why an Enrollment is not moving

Where to look, not a diagnosis.

1. **The Campaign.** `curviate campaign get <campaign_id> --fields status,pause_reason,schedule`. Not `active`: that is the answer. Steps run only inside `schedule` and the Account's Active hours, both in its own zone.
2. **The Enrollment.** `curviate enrollment get <enrollment_id> --fields status,waiting,account_id,history`. `queued` has not started, and a long queue is normal: Accounts take people as their share allows. A queued Enrollment with `account_id: null` is in the pool, not stuck. `waiting.kind`: `wait` and `event` run until `waiting.until`; `budget` is the Account's allowance spent for today or not yet this Campaign's turn, and `waiting.until` is its next session; `queue` waits its turn for pacing or a limit; `account_unavailable` is the Account (`curviate-accounts`); `campaign_paused`; `paused_by_user`; `halt` is LinkedIn refusing a row; `kill_switch` is Curviate holding Campaign work, so tell the user.
3. **The limits.** `curviate account get <acc_id> --fields status,quotas,warm_up`: a row at `effective_ceiling`, or a `halt`.
4. **Failures.** `curviate analytics events list --campaign <campaign_id> --kind step.failed --limit 20`, each with its reason.
5. **All skipped, Campaign `completed` at once.** `curviate enrollment list --campaign <campaign_id> --status skipped --limit 100 --fields lead_id,skip_reason`. `no_connected_account` means `assign: already_connected`. Update with `{"settings":{"assign":"auto"}}`, then `curviate campaign add <campaign_id> --lead <ids>` (comma list) returns it to `active`; a list scan never re-checks a skip. Or start a new Campaign on the list: a skip does not count for `exclude.other_campaigns`.

**The ceiling is the stop, not the target.** Campaigns aim at each row's target, spread over the day in sessions, and wait at a ceiling. **Curviate sees only what it sends.** Invitations or messages sent by hand on LinkedIn, or by another automation tool on the same Account, are invisible to it and to every limit here: do not run another tool on a connected Account. Core writes on the same Account spend the same budgets, so do not run a loop beside it. A crashed Step is never repeated: never re-send it by hand through core.

## How it is going

```bash
curviate analytics get --range 30d --json                      # every Campaign
curviate analytics get --campaign <campaign_id> --range 30d --json   # Steps, paths, Accounts
curviate analytics get --include forecast --forecast-days 14 --json   # expected sends and replies per day from today (CLI 0.53.0)
curviate analytics events list --campaign <campaign_id> --kind step.failed --limit 20   # why, one record each
curviate analytics email --range 30d --include mailboxes,domains   # email: sent, reply, open, bounce, opt-out rates
curviate analytics attention                                    # Needs a fix: each email problem and the command to its fix

curviate analytics export --table daily --format csv --range 30d
```

`acceptance.pending` and `low_sample` mean the rate is not settled: say so. An email rate is "still maturing" while
emails sent under 7 days ago are over a third of it; the bounce rate shows from 50 emails sent.
`--include forecast` is a simulation of Campaigns only, from their observed rates and the configuration as it is now (no new Enrollments, no edits): say "expected", never "will". `--forecast-days` is 1 to 365 (default 30) and the forecast ends sooner when activity does; `status: computing` means an Account has no simulation yet, not zero. It works with `--campaign <campaign_id>` and on `account overview`.
`--job` builds in the background, one per Team at a time: `curviate export get <id>`, then `curviate export download <id> --output <file>`.

## Errors in these flows

Plan, role and limit refusals: `curviate`.

| Code | Exit | Means | Do |
|---|---|---|---|
| `SEQUENCE_INVALID` | `2` | Every error listed as `<file>:<line>:<col> error R12 <path>: ...` | Fix all, lint again. |
| `CAMPAIGN_NOT_STARTABLE` | `2` | `errors[]` lists each gap: Lead list, sending Account, Sequence, the Lead check, Leads without an address | Report each to the user, fix it, then ask again; never a blind retry. |
| `CAMPAIGN_STATUS_CONFLICT` | `2` | Wrong status; the message says what is allowed now | Re-read `status`. A second start is this: nothing ran twice. |
| `SEQUENCE_CONFLICT` | `2` | Someone saved since your revision | `campaign get`, merge, send with the new `--if-revision`. |
| `ENROLLMENT_NOT_ACTIVE`, `NOTHING_TO_RETRY` | `2` | Its status does not take this | `enrollment get`; nothing was sent. |


| `STEP_IN_FLIGHT` | `7` | A Step is sending right now | Read again in a minute. |
