---
name: curviate-inbox
description: "One Account's live LinkedIn messages with the Curviate CLI: `inbox`, `inboxes`, `message` (new, send, edit, delete, react, InMail), replying as a company page, retrieval mode, and `webhook` for event delivery. Use when reading a thread, sending a DM or InMail, or wiring webhooks. Replies across every Account: `curviate-unibox`."
---

# Curviate: inbox and messaging

Messaging is the highest-consequence surface here: every send lands in a real person's inbox and
cannot be unsent. Preview first, always.

Established against CLI `0.50.0-next.1`.

## Before any command

Setup, credentials, global flags and the exit-code table: `curviate`. Here:

- **Name `--account <acc_id>` on every send**: on a multi-account Team a wrong one sends as the wrong
  person. `--preview` renders recipient, text and acting account without sending.
- A message carries 22 fields: project with `--fields`.

### Text input

Message text is a positional argument, and `-` reads stdin. **Use a quoted heredoc**: the quoted
delimiter disables every shell expansion, so apostrophes, accents, `$` and backticks survive intact.
An unquoted heredoc has produced an empty message that went out blank.

```bash
cat <<'EOF' | curviate core message send "<chat_id>" - --preview
Hi Thomas,

thanks for connecting. I saw the work you shared last week.
EOF
```

## Retrieval mode: `--mode` and `--max-age`

Exactly four reads decide between a stored copy and a live LinkedIn call: `profile me`,
`profile <id>`, `inbox get` and `inbox messages`. Two of them are here.

| `--mode` | Behaviour |
|---|---|
| `auto` (default) | A stored copy while it is fresh, otherwise fetch. |
| `live` | Always fetch from LinkedIn. |
| `refill` | A stored copy at any age; fetch only when nothing is stored. |
| `cache_only` | Never fetch. A store miss is refused, not fetched. |

`--max-age <seconds>` (0 to 31536000) overrides those presets in both directions; `--max-age 0` is
the same as `--mode live`. Every response carries `source: store | live` plus `observed_at` under
`--json`, and a `provenance:` line on stderr in human mode. Read `source` rather than assuming.

- **`cache_only` with `--max-age` is a usage error, exit `2`**, raised before any network call.
  `cache_only` never reaches LinkedIn at any age, so a freshness threshold cannot change its answer.
  Drop `--max-age`, or use `--mode refill`.
- **`cache_only` on a store miss is exit `14` (`NOT_STORED`)**: the chat may exist perfectly well on
  LinkedIn, this API just holds no copy. It is not "not found" (`4`), so re-checking the chat id is
  the wrong move, and it is not retryable as sent. Re-read with `refill`, `auto` or `live`.
- **`inbox messages`: one bare `--mode live` page restarts the chat walk and leaves it unservable by
  `cache_only` afterwards.** A listing is served from the store only over a *closed* walk.
  `inbox messages --all` walks to `cursor: null` and closes it. When you need a chat to be
  `cache_only`-servable later, reach for `--all` rather than a single live page.
- **Every other command refuses the flags outright rather than ignoring them**: `unknown flag --mode`, exit `2`.

## Reading: `inbox`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core inbox list` | Conversations, newest activity first, 20 by default. `--unread` / `--no-unread` filter by read state; `--inbox <folder>` selects `primary` (default), `inmail`, `archived`, `spam`, `jobs` or `starred`. | proven |
| `curviate core inbox get <chat_id>` | One chat's detail including `last_message` (full text and sender), the cheap triage read. Accepts `--mode`/`--max-age`. | proven |
| `curviate core inbox messages <chat_id>` | The messages in one chat. Full `text` per message; `is_sender` (0 or 1) says who sent each. `--before`/`--after` take ISO-8601 UTC with a `Z` suffix. Accepts `--mode`/`--max-age`. | proven |
| `curviate core inbox search "<query>"` | Free-text search of the account's own inbox: participant names and message content. | proven |
| `curviate core inbox mark-read <chat_id>` | Mark a chat read. | proven |

**Listing chats does not mark anything read**, so triage freely.

A chat item already carries the counterpart's identity: `user_id` (the `ACoAA…` member id), an
embedded `user{}` (`id`, `type`, `display_name`, `profile_url`, `public_picture_url`), and `name`,
the chat's own display name, which is populated on direct messages. Escalate to `curviate core profile <user_id>` only for what `user{}` does not carry: headline, network distance, the full profile.

### Traps

- **`--limit` on `inbox list` and `inbox messages` is validated client-side to 1-25** (default 20).
  Outside that range the command exits `2`.
- **Neither `inbox list` nor `inbox search` reliably answers "does a chat with X exist".** A single
  `inbox list --limit 25` call has repeatedly omitted a chat created seconds earlier, across
  candidates, not a one-off race. `inbox search` has a different defect: its result set is ranked
  and capped rather than exhaustive, so a common first name can omit an exact match that a rarer name
  finds immediately. When the answer matters, walk `inbox list` by `--cursor` to exhaustion (or a
  generous `--max-pages`) rather than trusting one page or the search.
- **Inbox threads carry no vanity slug.** `user.profile_url` is built from the member id and
  `public_identifier` is absent even under `--verbose`. Join inbox-driven flows on the member id.
- **`inbox list` has no date-range flags.** `--before`/`--after` exist on `inbox messages` only, and
  filter messages within one chat. Filter a chat list client-side on `last_message_timestamp`.
- **A very recent send or delete can take minutes to appear in `inbox messages`** (LinkedIn-side
  indexing). `message get <chat_id> <message_id>` reflects it immediately, use that to confirm a
  send, not a re-list.

## Discovering inboxes: `inboxes`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core inboxes list` | Every inbox the account can act in: its own, plus the company pages it administers. `--kind personal\|company` and `--company-id <id>` narrow it. Beta. | proven |
| `curviate core inboxes chats <inbox_id>` | One inbox's conversations. Each chat id is send-ready. Beta. | proven |

**A `COMPANY_…` chat id sends as that page, with no extra flag.** Pass it to `message send` and the
message goes out from the page rather than from you; the output confirms with
`Sent as <name> (company page)`. Company inboxes are reply-only: they cannot start a conversation.
The page's own admin inbox has a second, richer surface under `company` (see `curviate-profile`).

## Sending: `message`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core message new --to <recipient> "<text>"` | Start a new chat. `--to` takes a profile URL, a bare slug or a member id, and resolves it for you. `--attach <file>` is repeatable. | proven |
| `curviate core message send <chat_id> "<text>"` | Reply in an existing chat. A `COMPANY_` chat id sends as that page. | proven |
| `curviate core message get <chat_id> <message_id>` | One message. Reflects a very recent send immediately, unlike the thread listing. | proven |
| `curviate core message edit <chat_id> <message_id> "<text>"` | Edit a message within LinkedIn's allowed window. | proven |
| `curviate core message delete <chat_id> <message_id>` | Delete a message. | proven |
| `curviate core message react <chat_id> <message_id> <emoji>` | Add an emoji reaction to a message. | proven |
| `curviate core message attachment <chat_id> <message_id> <attachment_id>` | Download an attachment. | proven |
| `curviate core message inmail --to <recipient> --subject "<subject>" "<text>"` | Send an InMail. Both `--to` and `--subject` are required. Consumes an InMail credit. | proven |
| `curviate core message inmail-balance` | Remaining InMail credits. Check before a run that depends on them. | proven |

**Chat ids** look like `CLASSIC_2-MzJmZTg1…` for a personal chat and `COMPANY_<id>_2-…` for a page.

**There is no idempotency key and no server-side de-duplication.** A send that times out may already
have landed. Re-read the thread (`inbox messages`, or `message get` for the id you just wrote)
before re-issuing anything.

## Event delivery: `webhook`

Message and account events arrive by webhook rather than by polling.

| Command | What it does | Confidence |
|---|---|---|
| `curviate webhook create --source <s> --request-url <https url> --account-ids <ids>` | Register an endpoint. `--source` is `messaging`, `user`, `account_status` or `post` (scheduled-post results: `post.published`, `post.publish_failed`). `--account-ids` is required for `messaging`, `user` and `post`; an `account_status` webhook may omit it to cover every current and future account. Also `--name`, `--events`, `--data`, `--no-enabled`. | proven |
| `curviate webhook list` | Registered webhooks. | proven |
| `curviate webhook events` | The canonical event catalogue, read it before subscribing to a name. | proven |
| `curviate webhook get <id>` | One webhook. | proven |
| `curviate webhook update <id>` | Update in place. `--request-url`, `--name`, `--enabled`, `--events`, `--data`, `--account-ids`. The source is immutable. | proven |
| `curviate webhook delete <id>` | Remove a subscription permanently. | proven |
| `curviate webhook verify --secret <s> --header <sig> --file <path\|->` | Verify a delivery signature offline, no network call. `--file` is the raw body, byte for byte. `--max-age-secs` rejects a replay older than the given age (default 300). | proven |

Verify the signature on every delivery before acting on its body. Operating one: `curviate webhook test <id>`,
`curviate webhook deliveries <id> --failed`, `curviate webhook redeliver <id> <delivery_id>`, `curviate webhook rotate <id>` (a new
secret, printed once); body templates: `curviate webhook lint`, `curviate webhook variables --source <s>`. Motion events
(`--source motion`): `curviate-motions`. Cross-Account triage: `curviate-unibox`.

## Exit codes specific here

The full table is in `curviate`.

- **`2`**: a `--limit` outside 1-25, `cache_only` with `--max-age`, a missing `--subject` on an InMail.
- **`10`**: the edit or delete window expired, the recipient is unreachable, or `DO_NOT_CONTACT`. Do not
  resend.
- **`14`** `NOT_STORED`: re-read with `refill`, `auto` or `live`.
