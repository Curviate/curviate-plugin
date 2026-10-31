---
name: curviate-motions
description: "Motions: build, start, pause, edit and read automated LinkedIn outreach with the Curviate CLI. Covers Sequences (steps, delays, conditions, A/B variants, voice note steps and clip uploads, variables and fallbacks), Enrollments, reply handling, custom and incoming events, Analytics. Use when asked to create or change a Motion or Sequence, enroll people, or check how outreach is going."
---

# Curviate: Motions

A **Motion** runs one **Sequence** for the Contacts of its Contact lists, from its sending Accounts, on a schedule. Each Contact on each Account is one **Enrollment**. Curviate paces every action itself.

Established against CLI `0.50.0-next.6`. Every command here ran against a local server with a fake
LinkedIn; none has been live-fired from this skill. `lint` and `init` are offline. Setup and the exit-code
table: `curviate`.

## Preconditions

Each read is free.

| Need | Read | If not |
|---|---|---|
| The Automate Tier | `curviate tier --json`: `features` holds `motions` and `contacts` | `TIER_REQUIRED`. Build can read, stop and delete but not create. |
| Accounts that can send | `curviate account list --json`: `status` is `active` | A connect or reconnect: `curviate-accounts`. An Account with no live seat cannot send. |
| A role that may send | `curviate team get --json`: you must operate every sending Account | `INSUFFICIENT_ROLE`, `ACCOUNT_NOT_SHARED`. |
| Room in the limits | `curviate account get <acc_id> --fields quotas,warm_up,activity_window --json`: read `effective_ceiling`, not `ceiling` | A low `warm_up.factor` means a new or quiet Account: size the list to it. Invitations, InMail and profile views also carry `target` and `effective_target`: Motions aim at the target, the ceiling is only the stop. |
| Anything already wrong | `curviate notification list --unread --json` | Handle a paused Motion or a disconnected Account first (`curviate-accounts`). |
| The people | A Contact list with first names and any per-person text filled in | `curviate-contacts`, before the Motion. |

## Build it: the loop

Each step ends on something you can read.

1. **Start from a template.** `curviate motion init --template connect-and-converse --output motion.json`.
   Done when the file exists. Templates: `connect-and-converse` (strangers: visit, like a recent post,
   blank invitation, two messages), `engage-then-connect` (they post: react, comment, invitation),
   `nurture-connections` (existing Connections). To copy a Motion, save `curviate motion get <motion_id> --json` to a file: `create` and `update` accept it as it is and drop what Curviate sets.
2. **Edit the file.** Fill `contact_list_ids` and `account_ids`; set `schedule` and `settings`
   (`curviate motion create --help` lists every field and bound). Add `{{key}}` values to Contacts first
   (see Variables). Done when no placeholder is left.
3. **Lint until clean.** `curviate motion lint --file motion.json` prints every problem at once, with a hint: fix them all, then lint again. Offline it cannot see the Accounts: read the other warnings at the next step. Done on exit `0`.
4. **Create the draft.** `curviate motion create --file motion.json`. A retry makes a second draft, so
   after a failure check `curviate motion list --status draft` first. Done when `motion get <motion_id> --fields status,warnings` reads `draft` and you can explain each warning (`W3`: see A/B variants).
5. **Preview.** `curviate motion preview <motion_id> --sample 5 --json`: a read, it never reaches LinkedIn.
   Read `samples[].steps[].variants[].rendered` and `used_fallback`, `excluded`, `would_skip`, `warnings`,
   and `projection` (`audience.to_enroll`, `audience.skipped`, `summary`, `binding`). Done when you can
   explain each surprise, such as a fallback used for many, or fewer to enroll than the list holds.
6. **Show the user, then ask.** Show two rendered messages, the fallback, who enrolls, from which Accounts, and the `projection.summary`. Done on a go.
7. **Start.** `curviate motion start <motion_id>`.
8. **Read it back.** `curviate motion get <motion_id> --fields status,started_at,counts` then
   `curviate enrollment list --motion <motion_id> --limit 5 --fields id,status,account_id`. Done when status
   is `active` (or `scheduled`, when `schedule.start_at` is ahead) and Enrollments exist, usually `queued`.

What needs a go is listed in `curviate`. What was sent stays sent.

## The Sequence

`{"on_reply": "<step or end>", "steps": [...]}`. Steps run in order and fall through; `next`, `then` and
`else` jump to a step id or `end`. Each step has one kind:

| Kind | Example | Notes |
|---|---|---|
| Action | `{"id":"invite","do":"invite.send"}` | `do` is one of `profile.view`, `profile.follow`, `profile.unfollow`, `invite.send`, `invite.withdraw`, `message.send`, `voice.send`, `inmail.send`, `post.react`, `post.comment`, `skill.endorse`. Parameters in `with`. A step that cannot run continues (`else` to branch). `voice.send` plays an uploaded clip: see Voice notes. |
| Delay | `{"id":"w1","wait":"1d"}` | `<n>m`, `<n>h` or `<n>d`. At least that long, with a small random spread added. Curviate's pacing handles safety. |
| Wait for | `{"id":"a","until":"invite.accepted","timeout":"21d","then":"next_step","else":"end"}` | `invite.accepted`, `message.replied`, `message.read`, `event.<name>`. `timeout` is required. |
| Condition | `{"id":"c","if":{"contact.connected":true},"then":"a","else":"b"}` | One predicate per step (`contact.tag`, `contact.degree`, `contact.posted_within`, `contact.<field>`, `contact.extra.<key>`, `message.seen`, `not`, ...). Chain steps for and/or. |
| Tag | `{"id":"t","tag":"no-reply"}` | Adds a Tag to the Contact, creating it if new. |
| Send event | `{"id":"e","emit":"handoff.ready"}` | Delivers `motion.custom_event` by webhook. Or put `"event":"<name>"` on an action or tag step. |

Every path must end explicitly: the last step needs `"next":"end"`. No cycles, no unreachable step. Example: a blank invitation, an A/B opener, one follow-up, a hand-off.

```json
{
  "name": "Q4 founders",
  "contact_list_ids": ["cl_YOUR_LIST_ID"],
  "account_ids": ["acc_YOUR_ACCOUNT_ID"],
  "schedule": { "days": ["mon", "tue", "wed", "thu", "fri"], "hours": { "start": "09:00", "end": "17:00" } },
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

### Voice notes

A `voice.send` step sends a recorded voice message instead of text, to a first-degree Connection, from the
same Message budget as `message.send`. **It plays a clip you upload first**: the Sequence holds only the clip's id.
Nothing reaches LinkedIn until the Motion starts.

1. **Make the audio.** One file per clip: MP3, WAV, M4A, WebM or Ogg, **1 to 120 seconds**, up to 20 MiB. It is
   converted once and the original is discarded; a clip is never shortened, so cut it yourself.
2. **Upload it.** `curviate motion voice-clip upload intro.mp3 --json` prints the clip: `id` (`vc_...`), `duration_ms`,
   `bytes`. Done when `curviate motion voice-clip get <id> --json` reads the same `duration_ms`. It needs Automate,
   counts toward 100 uploads per Team per 24 hours, and a retry stores a second clip. An unused clip is deleted after 30 days.
   `--preview` shows the name and size and uploads nothing.
3. **Put the id in the step**, with a fallback that has no variables (the id below is the shape, not a real clip):

```json
{ "on_reply": "end", "steps": [ { "id": "voice", "do": "voice.send", "next": "end",
  "with": { "clip_id": "vc_01J8Z3K9P0Q1R2S3T4V5W6X7Y8", "fallback": "Hi, glad we are connected. How do you handle outreach today?" } } ] }
```

   A/B: `variants` of two `{id, clip_id}` instead of `with.clip_id`, one shared `with.fallback`. No `text`, no
   variable, no mix of a text arm and a clip arm. The fallback is sent as text when the audio cannot go (the clip
   was removed, or LinkedIn states it was not sent); `used_fallback` then reads `true` on that step. If the send
   outcome is unknown, nothing further is sent.
4. **Lint, create, preview.** `lint` checks the id's shape (`R13`) and the fallback (`R19`) offline; whether the clip
   is your Team's is checked when the Motion is saved, and an unknown id answers the same as another Team's.
   `motion preview` shows each variant's `clip_id` and `clip_duration_ms` (null: no such clip) and the fallback, and
   renders no text. Show the user the duration and the fallback before the go.
5. **Start** as above. The step shows as "Voice note" in analytics, apart from messages, and counts as a message.

| Refused | Code | Exit | Do |
|---|---|---|---|
| Not audio, empty, undecodable, under 1 s or over 120 s | `VOICE_CLIP_INVALID` | `2` | The message names the reason and the limit. Fix the file; nothing was stored. |
| Over 20 MiB | `PAYLOAD_TOO_LARGE` | `2` | Cut or compress the audio. |
| The 101st upload in 24 hours | `RATE_LIMIT_TENANT` | `6` | Wait the `Retry-After`. Reuse a clip: one clip serves any number of steps and Motions. |
| `clip_id` malformed, or not a clip of your Team | `SEQUENCE_INVALID` (`R13`) | `2` | Upload it on this Team, then use the id it prints. |
| No `fallback` | `SEQUENCE_INVALID` (`R19`) | `2` | Add a variable-free fallback. |

Voice goes only in Motions to Connections. It cannot go in a group, InMail or a company chat. A single voice note
by hand: `curviate-inbox`.

### Variables and fallbacks

Double braces only. `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{company}}`, `{{job_title}}`,
`{{headline}}`, `{{location}}`; `{{my_first_name}}` is the sending Account. Any other key is a Contact custom
field: `{{opener}}` reads `contact.extra.opener`. 

**Per-person text you researched goes on the Contact before the Motion starts**, as a column named for the
key in an import (`curviate-contacts`). Every messaging text with a variable needs a variable-free fallback
on its step: `with.fallback` (message, comment), `with.note_fallback` (invitation note: text or `drop`),
`with.fallback` as `{subject,text}` (InMail). A comment's fallback should be `skip`, not generic text. `used_fallback` in the preview tells you who gets the generic text.

A single brace around a variable is the classic mistake (`R18`).

### A/B variants

Replace `with.text` (or an invitation's `with.note`) with `variants`: exactly two, each `{id, text}` with an `id` unique in the document, on messaging steps only, sharing one fallback. A variant's key is `text` on an invitation too; `note` fails lint (`R23`, `R13`). InMail variants add `subject`. The split is even and sticky per Enrollment. Results: `curviate analytics get --motion <motion_id> --json`; one arm: `curviate enrollment list --motion <motion_id> --variant opener_a`.

```json
{ "on_reply": "end", "steps": [ { "id": "invite", "do": "invite.send", "next": "end",
  "variants": [ { "id": "note_a", "text": "Hi {{first_name}}, we met at the meetup." }, { "id": "note_b", "text": "Hi {{first_name}}, I liked your talk." } ],
  "with": { "note_fallback": "drop" } } ] }
```

**Noted invitations are scarce.** A `basic` Account has 3 a month, each up to 200 characters (`curviate account safety get <acc_id>`, row `connection_requests_with_note`). `motion create`, `motion update` and `motion preview` warn `W3` when a note has no `note_fallback: "drop"`; `lint` cannot, because it never sees the Account. With the 3 spent, `drop` sends the invitation blank. 

### Replies

The Sequence decides what a reply does. Waiting in `until message.replied`, it takes that step's `then`;
anywhere else it jumps to `on_reply`, once per Enrollment. A target of `end` finishes the Enrollment as
`replied`. Route it: tag and hand off, as above.

**Humans own replies** (`curviate-unibox`), unless their Sequence routes the reply to a step they wrote.

### Waiting on an outside signal

- **Your agent.** A step `{"id":"wait_copy","until":"event.researched","timeout":"3d","then":"opener"}`, then
  `curviate enrollment event <enrollment_id> researched` once the text is on the Contact. A Sequence with no such step answers `INVALID_REQUEST`; a `queued` Enrollment, `ENROLLMENT_NOT_ACTIVE`.
- **Another tool.** `curviate incoming create --event-name booked --motion <motion_id> --match-linkedin-url <path>` prints a private URL once: treat it like a password. It starts `enabled: false`: run `curviate incoming capture <id>`, have the tool post once, check `curviate incoming get <id>`, then `curviate incoming update <id> --enabled`. `incoming arrivals` shows matches.
- **Tell another tool.** A webhook: choosing its source and event is in `curviate-inbox`.

### Settings worth deciding on purpose

- `priority`: `normal` (default) or `prioritized`. Every Motion on an Account shares one allowance of invitations, InMail and profile views, split by weight; a prioritized Motion gets a larger share, and a share nobody uses flows to the others the same day. There is no start cap to set: how fast people start follows the Motion's share. The preview's `projection.accounts[]` says what limits it (`binding`) and the `expected_actions_per_day`. `new_enrollments_per_account_per_day` is retired: the API still accepts and ignores it for a while, and prints a notice.
- `accounts_per_contact`: above 1, each Account runs its own Enrollment, `account_gap` apart, and `on_reply_elsewhere` (`stop` by default) ends the others on a reply.
- `assign` picks each Contact's Account. `auto`, the default and right for any Motion with a connect request: an Account already connected or in a chat with the Contact keeps them; everyone else waits unassigned in the Motion's pool (`account_id` is null) until an Account with room takes them, and stays on it. `even` is retired (the API ignores it and prints a notice). `already_connected`: only an Account already connected; **everyone else is skipped, so no invitation ever goes out to them** (warning `W17`). Warm-only Motions alone.
- `exclude.other_motions`, `exclude.known_chats`: on by default. The Do-not-contact list always applies.
  `exclusion_list_ids` subtracts a Contact list; one list cannot be both source and exclusion.
- `where`: stored-data filters, one predicate each. Skipped counts show in the preview.
- `acceptance_floor`: off by default; on, a low acceptance pauses the Motion.
- `schedule`: days and hours, read in the Account's own time zone, which comes from where it connects.
  `schedule.timezone` is refused (exit `2`). Active hours (`curviate-accounts`) also hold a Motion back.

## Run it

| To | Command | Read back |
|---|---|---|
| Hold everything | `curviate motion pause <motion_id>` | `status: paused`, `pause_reason: user`; waits keep their time |
| Continue | `curviate motion resume <motion_id>` (re-runs the start checks) | `status: active` |
| End it for good | `curviate motion archive <motion_id>` | `status: archived`; Enrollments finish `motion_archived` |
| Delete a draft | `curviate motion delete <motion_id>` | `motion get` exits `4`. Not a draft: archive it |
| Add people | `curviate motion add <motion_id> --contact <contact_id>`, or add to its Contact list | each `outcome` (`already_enrolled`, ...) |
| Take people out | `curviate motion remove <motion_id> --contact <contact_id>` | `removed`; `not_found` holds one with no open Enrollment. They do not come back while on the list: one Enrollment per Contact, Motion and Account, ever. `motion add` re-queues only one that never started; a started one answers `already_enrolled` |
| One person | `curviate enrollment pause\|resume\|stop <enrollment_id>` | `enrollment get <enrollment_id> --fields status,waiting,finish_reason` |
| A failed Step | `curviate enrollment retry <enrollment_id>` acts only on a failure, so it never re-sends | `NOTHING_TO_RETRY` if none failed |
| Jump | `curviate enrollment resume <enrollment_id> --at <step_id>` | **Not guarded: a Step that already sent sends again.** Read `enrollment get` first |
| Another Account | `curviate enrollment reassign <enrollment_id> --account <acc_id>` must be a sending Account; restarts at the first Step | Refused: `ACCOUNT_ALREADY_ENGAGED`, `ALREADY_ENROLLED_ON_ACCOUNT`, `KNOWN_CHAT` (exit `2`) |
| Many | `curviate enrollment bulk --action stop --motion <motion_id> --status queued`. List with the same filters first | one line per Enrollment; `matched` |

**Motion status**: `draft`, `scheduled`, `active`, `paused`, `completed`, `archived`. `pause_reason`: `user`,
`acceptance_floor`, `no_sending_account` (fix an Account, it resumes itself), `tier_required` (never restarts on
its own). **Enrollment status**: `queued` (the filter also takes `pending`), `active`, `paused`, `finished`,
`failed`, `skipped`; `waiting.kind` says why it is not moving, and `finish_reason`, `skip_reason` say why it ended,
each with a sentence beside it. A stopped Enrollment takes only `resume --at`.

**Editing** is `curviate motion update <motion_id> --file <file> --if-revision <n>`: read the `sequence_revision` from `motion get` first, and a stale save is refused with `SEQUENCE_CONFLICT`. Objects merge by key; arrays and the Sequence replace whole. The file holds only what changes. **A draft** edits freely: `sequence_version` stays 1 and `sequence_change` reads `none`; lint and preview again after. **After start**, a text, wait or timeout change is `sequence_change: copy` and
applies to Steps not yet reached. Anything else is `structural`: a new `sequence_version`, and running Enrollments
finish on theirs. `curviate motion get <motion_id> --version <n>` reads an old one and its `open_enrollments`.

### Why an Enrollment is not moving

Where to look, not a diagnosis.

1. **The Motion.** `curviate motion get <motion_id> --fields status,pause_reason,schedule`. Not `active`: that is the answer. Steps run only inside `schedule` and the Account's Active hours, both in its own zone.
2. **The Enrollment.** `curviate enrollment get <enrollment_id> --fields status,waiting,account_id,history`. `queued` has not started, and a long queue is normal: Accounts take people as their share allows. A queued Enrollment with `account_id: null` is in the pool, not stuck. `waiting.kind`: `wait` and `event` run until `waiting.until`; `budget` is the Account's allowance spent for today or not yet this Motion's turn, and `waiting.until` is its next session; `queue` waits its turn for pacing or a limit; `account_unavailable` is the Account (`curviate-accounts`); `motion_paused`; `paused_by_user`; `halt` is LinkedIn refusing a row; `kill_switch` is Curviate holding Motion work, so tell the user.
3. **The limits.** `curviate account get <acc_id> --fields status,quotas,warm_up`: a row at `effective_ceiling`, or a `halt`.
4. **Failures.** `curviate analytics events list --motion <motion_id> --kind step.failed --limit 20`, each with its reason.
5. **All skipped, Motion `completed` at once.** `curviate enrollment list --motion <motion_id> --status skipped --limit 100 --fields contact_id,skip_reason`. `no_connected_account` means `assign: already_connected`. Update with `{"settings":{"assign":"auto"}}`, then `curviate motion add <motion_id> --contact <ids>` (comma list) returns it to `active`; a list scan never re-checks a skip. Or start a new Motion on the list: a skip does not count for `exclude.other_motions`.

**The ceiling is the stop, not the target.** Motions aim at each row's target, spread over the day in sessions, and wait at a ceiling. **Curviate sees only what it sends.** Invitations or messages sent by hand on LinkedIn, or by another automation tool on the same Account, are invisible to it and to every limit here: do not run another tool on a connected Account. Core writes on the same Account spend the same budgets, so do not run a loop beside it. A crashed Step is never repeated: never re-send it by hand through core.

## How it is going

```bash
curviate analytics get --range 30d --json                      # every Motion
curviate analytics get --motion <motion_id> --range 30d --json   # Steps, paths, Accounts
curviate analytics events list --motion <motion_id> --kind step.failed --limit 20   # why, one record each

curviate analytics export --table daily --format csv --range 30d
```

`acceptance.pending` and `low_sample` mean the rate is not settled: say so.
`--job` builds in the background, one per Team at a time: `curviate export get <id>`, then `curviate export download <id> --output <file>`.

## Errors in these flows

Tier, role and limit refusals: `curviate`.

| Code | Exit | Means | Do |
|---|---|---|---|
| `SEQUENCE_INVALID` | `2` | Every error listed as `<file>:<line>:<col> error R12 <path>: ...` | Fix all, lint again. |
| `MOTION_NOT_STARTABLE` | `2` | `errors[]` lists each gap: Contact list, sending Account, Sequence | Fix each, then start again; no retry. |
| `MOTION_STATUS_CONFLICT` | `2` | Wrong status; the message says what is allowed now | Re-read `status`. A second start is this: nothing ran twice. |
| `SEQUENCE_CONFLICT` | `2` | Someone saved since your revision | `motion get`, merge, send with the new `--if-revision`. |
| `ENROLLMENT_NOT_ACTIVE`, `NOTHING_TO_RETRY` | `2` | Its status does not take this | `enrollment get`; nothing was sent. |


| `STEP_IN_FLIGHT` | `7` | A Step is sending right now | Read again in a minute. |
