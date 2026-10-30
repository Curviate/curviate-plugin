---
name: curviate-unibox
description: "Triage LinkedIn conversations across every connected Account with the Curviate CLI `unibox` commands: list unread chats, read a thread, classify the reply, tag the Contact, enroll a warm chat in a Motion, mark a chat read or unread, send a human-approved reply, refresh. Use when asked to check replies, triage the inbox, hand a conversation to a human or another agent, or explain why the Unibox looks empty or stale."
---

# Curviate: Unibox triage

The Unibox is one inbox over the chats of every Account you may operate, served from Curviate's own
store: listing and reading it makes no LinkedIn call and spends no budget. Use it to find the
conversations that need an answer, decide who answers, and leave each chat in a state the next
person or agent can read.

Established against CLI `0.50.0-next.1`.

## Consent first: what the Unibox holds

An Account shows its whole inbox only while **Sync full inbox** is on. Without it the Unibox holds that
Account's **Motion conversations** only, however many other chats the Account has on LinkedIn. Only
the Account's own person turns Sync full inbox on or off: in the dashboard, over REST, or with
`curviate unibox consent <account_id> --on`. Any other key is refused with exit `5`
(`ACCOUNT_OWNER_ONLY`); ask the Account's person.

1. Run `curviate unibox accounts --json` and read `sync_full_inbox` and `sync` for each Account.
   **Done when** every Account you will triage is classed as: full inbox on and the listing complete,
   full inbox on and still listing (turning it on starts a paced listing that takes hours), or full
   inbox off (Motion conversations only).
2. When an Account lists few or no chats, report it with that class as the reason, and do not
   conclude the person has no conversations. **Done when** the report names the Account and its class.

## Before any command

```bash
npm install -g @curviate/cli && curviate --version    # needs Node 18 or newer
curviate setup                                        # opens the dashboard; or export CURVIATE_API_KEY
curviate unibox accounts                              # the acc_ ids, and what each one shows
```

- A chat is addressed by two arguments, `<account_id> <chat_id>`, exactly as `unibox list` prints
  them. `list`, `unread` and `refresh` span every Account; narrow them with `--accounts`.
- `--preview` renders a write without sending it. `--json` on anything you parse.
- `tag`, `enroll`, `refresh`, `consent` and `do-not-contact add` need the Automate plan: without it they
  exit `5` (`TIER_REQUIRED`). Listing, reading, `mark` and `reply` do not.
- Read `curviate unibox list --help` for the filter limits; they are not restated here.

## The commands

| Command | What it does | Confidence |
|---|---|---|
| `curviate unibox list` | Chats of every Account you may operate, newest activity first, from the store. Filters below. | wired, never live-fired |
| `curviate unibox get <account_id> <chat_id>` | One chat as listed, with `marked_unread` and its Motion context. | wired, never live-fired |
| `curviate unibox unread` | Count of unread chats per Account. | wired, never live-fired |
| `curviate unibox messages <account_id> <chat_id>` | One chat's messages, newest first, each with `origin` when known. | wired, never live-fired |
| `curviate unibox reply <account_id> <chat_id> "<text>"` | Send into the chat from its Account; the send marks it read. | wired, never live-fired |
| `curviate unibox mark <account_id> <chat_id> --read\|--unread` | Set the chat's read state on LinkedIn. | wired, never live-fired |
| `curviate unibox tag <account_id> <chat_id> --tag <tag>` | Save the other person as a Contact and add Tags, never removing any. | wired, never live-fired |
| `curviate unibox enroll <account_id> <chat_id> --motion <mot_id>` | Save the person and enroll them in a Motion through this Account. | wired, never live-fired |
| `curviate unibox refresh` | Sync now: queue a re-read of the newest chats. | wired, never live-fired |
| `curviate unibox accounts` | Per Account: Sync full inbox on or off, and how far the listing is. | wired, never live-fired |
| `curviate unibox consent <account_id> --on\|--off` | Turn Sync full inbox on or off; the Account's own person only. | wired, never live-fired |

## Find the chats: filters

`curviate unibox list` takes these filters, which combine:

| To narrow by | Flag |
|---|---|
| Account | `--accounts <acc_ids>` |
| Motion | `--motion <mot_ids>` (`none` for chats no Motion links) |
| Tag | `--tag <tag>` |
| Read state | `--unread` or `--no-unread` |
| Who wrote last | `--last-from me` or `--last-from them` |
| Chat type | `--type classic\|inmail\|sales_navigator\|recruiter` |
| Text | `--query <text>`: person name or message text |
| One person | `--person <con_id or ACo id>` |

`--total` adds the count of every matching chat. `curviate unibox unread` counts unread chats (chats,
not messages) per Account and is cheap enough to poll.

## The triage loop

Run it per chat. Every step ends on something you can observe.

1. **List.** `curviate unibox list --unread --last-from them --json`. **Done when** you hold the
   `(account_id, chat_id)` pairs to work, or each empty Account is explained by the consent step.
2. **Read the thread.** `curviate unibox messages <account_id> <chat_id>` (newest first, each message
   with its `origin`) and `curviate unibox get <account_id> <chat_id>` for `marked_unread` and the
   Motion context. **Done when** you can quote the last inbound message and say who wrote last.
   Reading never marks a chat read.
3. **Classify** as one of: interested, question, not now, opt-out, out of office, other.
   **Done when** one class is chosen and you can quote the words that decided it. When two fit, choose
   the one with the safer action (opt-out beats interested).
4. **Act** for that class (next section). **Done when** the command's output shows the effect: the
   Contact id and Tags, the Enrollment status, the list entry, or the sent message.
5. **Mark it read** with `curviate unibox mark <account_id> <chat_id> --read` once handled; leave it
   unread when a human still has to answer. **Done when** `curviate unibox get <account_id> <chat_id>`
   shows the chat read, or still unread on purpose with `marked_unread` set.

### Humans own replies

Send only text the human approved in this conversation. The one exception is a reply the Motion's
Sequence routes to an agent Step the operator authored, a Step that waits `until event.<name>`; that
Step's text is the operator's, and your part is sending the event. To draft: write the reply, show it,
and send it with `curviate unibox reply <account_id> <chat_id> "<approved text>"` only after a yes.
Run `--preview` first. A retry after a timeout can send twice, so read `unibox messages` before
sending again.

### Actions per class

| Class | Do |
|---|---|
| Interested | Tag the Contact: `curviate unibox tag <account_id> <chat_id> --tag interested` (creates the Contact when needed and returns its `contact_id`). Draft a reply for the human. If the Contact has an Enrollment waiting on an event, send it: `curviate enrollment event <enrollment_id> <name>`. |
| Question | Draft the answer for the human to approve, then send it with `unibox reply`. |
| Not now | Tag the Contact `not-now`; stop its Enrollment with `curviate enrollment stop <enrollment_id>` so no further Step runs. |
| Opt-out | Tag the Contact, then put them on the Do-not-contact list: `curviate do-not-contact add --contact <contact_id> --reason asked_to_stop`. Every Motion then skips them and their open Enrollments end. Stop there; a closing reply is the human's call. |
| Out of office | Resume the Enrollment at a later Step: `curviate enrollment resume <enrollment_id> --at <step_id>`. The jump is not guarded and can send a Step again, so read `curviate enrollment get <enrollment_id>` first. |
| Other | Leave the chat unread and tell the human why. |

Find an Enrollment with `curviate enrollment list --contact <contact_id>`; `unibox get` names the Motion
when there is one. Motion commands in full are in `curviate-motions`.

**Add a warm chat to a Motion**: `curviate unibox enroll <account_id> <chat_id> --motion <mot_id>`
saves the person as a Contact and enrolls them through this chat's Account (it must be one of the
Motion's sending Accounts). It bypasses only the rule that skips people you already chat with; every
other rule applies, and it reaches one person from one Account. A second call answers
`ALREADY_ENROLLED_ON_ACCOUNT` (exit `2`). Undo with `curviate enrollment stop`; what was sent stays sent.

## Read and unread are a hand-off

`curviate unibox mark <account_id> <chat_id> --unread` hands a conversation to a human or another
agent. It marks the chat unread **on LinkedIn too**, for everyone who sees that Account's inbox
(your Team and the Account's own person in the LinkedIn app); the other person in the chat sees
nothing. Marking it back with `--read` is safe to repeat.

- **Who marked it.** `unibox get` carries `marked_unread` as `{origin, at}`, or null; the `list` table
  shows `marked` for a chat made unread without a newer message. The next agent finds it with
  `unibox list --unread` and reads the origin to see who left it.
- **What marks a chat read.** A send from the Unibox or the API (`unibox reply`, `core message send`,
  from the CLI, REST, SDK or MCP) marks the chat read. A Motion send never changes it. Reading a chat
  never does. So a chat you answered is already read; a chat you only read stays unread until you mark it.

## Origin words

`origin` says where a message was sent from, and is absent when unknown (sent before Curviate began
recording, received from the other person, or a send whose answer was lost). Treat absent as
unknown, never as `linkedin`.

| Origin | Sent by |
|---|---|
| `motion` | a Motion's Step |
| `unibox` | a person in the Unibox in the dashboard |
| `api` | an API key or MCP grant: REST, CLI, MCP or SDK alike |
| `linkedin` | the Account's person on LinkedIn itself, outside Curviate |

Read it before you reply: a last message with origin `motion` came from a Sequence, so check what the
Sequence says next before you write to the same person.

## Events instead of polling

Subscribe once and react to a change instead of re-listing:

```bash
curviate webhook create --source messaging --request-url <https url> --events chat.updated --account-ids <acc_ids>
```

`chat.updated` always carries `chat_id`, and carries `unread` and `origin` (`unibox`, `api` or
`linkedin`) whenever the stored read state changed. Exactly one delivery carries each change.
`message.received` announces an inbound message. Read `curviate webhook events` for the catalogue and
`curviate-inbox` for creating and verifying a webhook.

Reading the Unibox from the CLI, REST, SDK or MCP serves the store and never prompts a new read from
LinkedIn, so polling `unibox list` does not make it fresher.

## How fresh the Unibox is

The Unibox is refreshed in the background, inside each Account's active hours and days. Without Sync
full inbox only Motion conversations are polled and kept. On a Team whose active days are Monday to
Friday nothing is polled at the weekend, and a refresh then answers `paused` until the next active day.

A chat read on the phone reaches the store by an event when LinkedIn sends one, and otherwise at the
next poll, so a chat can show unread after it was read. To catch up now, **Sync now**:

1. `curviate unibox refresh --accounts <acc_ids>` queues a re-read of the newest chats. It runs within
   minutes. **Done when** each Account answers `queued`.
2. Per Account the answer can also be `cooldown` (a repeat inside a short cooldown; `next_allowed_at`
   says when to retry), `paused` (outside active hours or days), or `not_synced` (no Sync full inbox
   and no Motion conversation). Branch on that status; none is an error.
3. Re-run `curviate unibox list --unread` after a few minutes. **Done when** the chat's state matches
   LinkedIn, or the Account answered `paused` and you have told the human why.

## Traps

- **A disconnected Account's chats stay listed, read-only**: a write to one exits `8`
  (`REAUTH_REQUIRED`). Reconnect the Account (`curviate-accounts`), then repeat.
- **`tag` and `enroll` need a one-to-one chat**; a group chat exits `2` (`CHAT_NOT_ONE_TO_ONE`).
- **A chat you may not see exits `10`** (`CHAT_NOT_VISIBLE`): it is outside your Accounts or the
  Account's Sync full inbox. Re-list rather than guess an id.
- **`unibox` is the Team view; one Account's live LinkedIn inbox is `curviate-inbox`.** Use that skill
  for a message edit, a delete, a reaction or InMail.

