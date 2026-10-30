---
name: curviate-network
description: "Invitations, follows and the synced Network with the Curviate CLI. Covers `connect` (send with a note, sent, received, accept, decline, cancel), `profile follow`, `relations`, `followers`, `following`, and `network` (stored Connections, sync status, export, resync). Use when sending or withdrawing invitations, triaging received ones, following a member, or listing Connections."
---

# Curviate: connections and following

An invitation is the most consequential low-effort write on LinkedIn: it is visible, it is
attributable, and a withdrawn one still leaves a trace. Preview first, de-duplicate before sending.

Established against CLI `0.50.0-next.2`.

## Before any command

Setup, credentials, global flags and the exit-code table: `curviate`. Here:

- **Name `--account <acc_id>` on every write**: an invitation from the wrong account reaches a real
  person as that person. `--preview` renders recipient and note without sending.

## `connect`: invitations

| Command | What it does | Confidence |
|---|---|---|
| `curviate core connect <id> --note "<text>"` | Send a connection request. `<id>` is a slug, profile URL or member id. `--note` is capped at 300 characters by LinkedIn; omit it for a generic request. | proven |
| `curviate core connect sent` | **Pending** sent invitations only: accepted and declined ones are never returned, so this is a lower bound on what you sent. Use `id` with `connect cancel`; `user.id` identifies the recipient (the sent variant carries no public slug). `created_at` is the platform's own timestamp. There is no total count; use `--all` and count client-side. | proven |
| `curviate core connect received` | **Pending** received invitations only. `user.public_identifier`, `display_name`, `first_name`, `last_name` identify the sender. Use `id` with `accept` or `decline`. | proven |
| `curviate core connect cancel <id>` | Withdraw a sent invitation. `<id>` is the `id` from `connect sent`. | proven |
| `curviate core connect accept <id>` | Accept a received invitation. `<id>` is the `id` from `connect received`. | **wired, never live-fired** |
| `curviate core connect decline <id>` | Decline a received invitation. | **wired, never live-fired** |

`connect accept` and `connect decline` are preview-proven (`--preview` renders the correct call and
body), but have never been fired against a live account. They are real, correctly wired commands.
Run your own smoke test on an invitation you are prepared to act on before an unattended flow
depends on either.

### Traps

- **De-duplicate before sending.** A request against a pair already mid-flow or already connected
  returns `CONNECTION_REQUEST_CONFLICT`, exit `8`. That is a clean, routine signal and the only
  reliable de-duplication marker for a connect loop, but check `profile relations` and
  `connect sent --all` first rather than probing with real invitations.
- **Invitations take roughly 10 to 30 seconds to appear on the recipient's side**, and a very recent
  one can take minutes to appear in `connect sent` (LinkedIn-side indexing). An absence right after
  sending is not proof the send failed. Do not resend on that basis.
- **`--note` takes a string, not stdin.** Write the note to a file, confirm it is non-empty, and pass
  `--note "$(cat note.txt)"`. An empty note has gone out as a blank request.
- **There is no idempotency key and no server-side de-duplication.** A send that times out may
  already have landed; re-read `connect sent` before re-issuing.

## Following and connections

| Command | What it does | Confidence |
|---|---|---|
| `curviate core profile relations` | Your first-degree connections. | proven |
| `curviate core profile followers <id\|me>` | A member's followers. `me` is always safe; another member's id also works. | proven |
| `curviate core profile following <id\|me>` | Who a member follows. **Self-only in practice**, see below. | proven |
| `curviate core profile follow <id>` | Follow a member. Sends a connection request instead if their profile is private. Bodyless write; resolves a slug or URL to the member id for you. | proven |
| `curviate core profile unfollow <id>` | Unfollow. Idempotent. | proven |

- **`profile following` is self-only.** Pass `me`. Any other member id (including your own explicit
  member id) returns `LINKEDIN_OPERATION_NOT_SUPPORTED`, exit `8`. That is a permanent platform
  limitation, never retryable. `profile followers` does not share it.
- **Never write `profile me relations`.** The command is `profile relations`. Older builds silently
  discarded `relations` and answered with your own profile at exit `0`; current builds exit `2`.
- Following is the low-consequence alternative to an invitation: it needs no acceptance, is
  reversible, and still surfaces the member's posts in your feed.

## A connect loop that behaves

```bash
# 1. Confirm you are not already connected or already mid-flow.
curviate core profile relations --all --json          # first-degree
curviate core connect sent --all --json               # pending invitations

# 2. Preview the exact request, then send it.
curviate core connect <slug> --note "$(cat note.txt)" --account <acc_id> --preview --json
curviate core connect <slug> --note "$(cat note.txt)" --account <acc_id> --json
```

On exit `8` with `CONNECTION_REQUEST_CONFLICT`, record the pair as already handled and move on. On
exit `13`, stop the loop. For more than a handful of people, use a Motion (`curviate-motions`): it paces and
de-duplicates itself.

## The Network: stored Connections

`network` reads Curviate's own copy of each Account's Connections: no LinkedIn call, no budget. Needs Automate
to keep syncing (`paused_reason: tier_required`). Prefer it to `curviate core profile relations`, which reads one
Account live and spends budget.

```bash
curviate network status --json                                  # state, paused_reason, complete, per Account
curviate network list --query <text> --accounts <acc_id> --fields first_name,public_identifier,account_id
curviate network export --format csv --output connections.csv
curviate network resync <acc_id>                                # once per Account per day; --all for every Account
```

- **Report `network status` verbatim.** `paused` with `paused_reason: disabled` means sync is not enabled for that
  Account, not an empty network. `account_unavailable`: the Account is connecting, needs reconnecting or is restricted;
  fix it first (`curviate-accounts`).
- **"Not connected" holds only for an Account with `complete: true`.** `network list` carries `coverage`: an empty list with
  `complete: false` proves nothing.
- **`network export` warns on stderr and still exits `0`** when coverage is incomplete. Read stderr before handing a file on.
- **To put Connections on a Contact list**: `curviate contact lists add <list_id> --connected-account <acc_id>` (`curviate-contacts`).

## Exit codes specific here

The full table is in `curviate`.

- **`8`** `CONNECTION_REQUEST_CONFLICT`: routine de-duplication, record the pair and move on.
- **`10`** `DO_NOT_CONTACT`: the person is on the Team's Do-not-contact list; drop them.
- **`13`** on invitations: `reset_at` is `null` for `pending_invites`, which acceptances and withdrawals
  free, not time. Withdraw stale invitations (`curviate core connect cancel <id>`).
