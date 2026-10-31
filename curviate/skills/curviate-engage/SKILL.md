---
name: curviate-engage
description: "Posts, comments, reactions, the home feed, LinkedIn notifications and Drafts with the Curviate CLI. Carries the write-versus-read reaction vocabularies, post-identifier forms and the Draft and scheduling rules. Use when posting, scheduling a post, commenting, reacting, or reading the feed."
---

# Curviate: posts, comments, reactions, feed

Engagement is the cheapest way to be visible, and every write here is public and attributable. Curviate's own
Notifications (a paused Motion, an Account to reconnect): `curviate-accounts`. Two
vocabularies and three identifier forms cause most failures; both are below.

Established against CLI `0.50.0-next.2`.

## Before any command

Setup, credentials, global flags and the exit-code table: `curviate`. Here:

- **Name `--account <acc_id>` on every write**: a comment from the wrong account is public and permanent.
- **`--preview` before every write.**

### Text input

Post and comment text is a positional argument, and `-` reads stdin. **Use a quoted heredoc**: the
quoted delimiter disables every shell expansion, so apostrophes, accents, `$` and backticks survive
intact:

```bash
cat <<'EOF' | curviate core post create - --preview
Line one.

Line two.
EOF
```

## Identifiers

A post id comes in three forms and the commands are not uniformly forgiving:

- The **numeric activity id** (`7459869580333576193`) is the canonical form.
- `urn:li:activity:<N>` works.
- A **full share URL** is accepted and the id extracted from it. If a command ever rejects one,
  extract it yourself: `POST_ID=$(echo "<share_url>" | grep -oP 'activity[-/]\K\d+')`.
- Some builds have rejected the bare numeric id at write time on `post react`, `comment add` and
  `comment list` while `--preview` on the same command rendered fine. If you hit that, pass the
  base64 `id` from whatever `post get`, `post create` or list response you already hold: no extra
  fetch needed.

**In every `comment` command, `<post_id>` is the original post's id, never the comment's.**
`<comment_id>` comes from `comment list <post_id>` as `items[].id`.

**`post get` answers with `social_id` (a URN); the numeric id you passed is not echoed back.**

## `post`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core post get <post_id>` | One post. Adds `is_repost`, `reposted_by`, `user_reacted` and a richer `author` (headline, slug) over what a list carries. | proven |
| `curviate core post create "<text>"` | Publish a post. `--attach` is repeatable for images and takes jpg, png, gif, mp4 or pdf; a single PDF produces a document post. | proven |
| `curviate core post react <post_id> <reaction>` | React to a post. `--as-organization <id>` reacts as a company page you administer. Duplicate reactions succeed silently. | proven |
| `curviate core post unreact <post_id> <reaction>` | Remove your reaction. | proven |
| `curviate core post reactions <post_id>` | Reactions on a post: `{value, author: {id, type, name, headline, profile_url, profile_picture_url, network_distance?}}`. Page default 20, maximum 50. No timestamp exists. | proven |
| `curviate core post delete <post_id>` | Delete a post you own. | proven |
| `curviate core post save <post_id>` | Save to your private bookmark list. Never notifies the author, never visible to anyone else. Idempotent. | proven |
| `curviate core post unsave <post_id>` | Remove from the bookmark list. Idempotent. | proven |
| `curviate core post saved` | Your saved posts, newest first. Each item is a preview with the snippet capped at 140 characters. | proven |
| `curviate core post user-posts <id\|me>` | A member's own posts. Same data as `profile <id> --posts`. | proven |
| `curviate core post user-reactions <id\|me>` | A member's own reactions. Same data as `profile <id> --reactions`. | proven |

### Reaction vocabularies: write is not read

| Write (`post react`, `comment react`, lowercase) | Read (`value`, `user_reacted`) |
|---|---|
| `like` | `LIKE` (confirmed pairing) |
| `celebrate` | `PRAISE` (confirmed pairing) |
| `insightful` | `INTEREST` (confirmed pairing) |
| `support` | `APPRECIATION` (pairing unconfirmed) |
| `love` | `EMPATHY` (pairing unconfirmed) |
| `funny` | `ENTERTAINMENT` (pairing unconfirmed) |

**Sending an uppercase read value as a write returns `INVALID_REQUEST`, exit `2`.** Always write
lowercase. Read-side casing has been observed to vary, so **compare reaction values
case-insensitively** when parsing `post reactions`, `comment reactions`, or `user_reacted`.

### Traps

- **`post reactions` returns `cursor: null` while more reactions remain.** A single page is not the
  reaction list. Use `--all`, and check the final line for
  `{"object": "stream_truncated", …, "has_more": true}`.
- **Check `user_reacted` on `post get` before reacting**: a duplicate reaction succeeds silently and
  tells you nothing.
- **A very recent create or delete can take minutes to appear in `post user-posts`** (LinkedIn-side
  indexing). `post get <post_id>` reflects it immediately.
- **The post list carries no `is_repost` field.** Detect a repost by comparing the item's author name
  against the member you queried, or call `post get <post_id> --fields is_repost,reposted_by`. On a
  repost, `author` is the original creator and `reposted_by` is the sharer.
- **A company reactor carries no `network_distance`**: the key is absent, not null. Treat
  `author.type == "COMPANY"` as its own signal rather than as missing data.
- A list item already carries `id`, `parsed_datetime`, full `text`, `reaction_counter`,
  `comment_counter`, `repost_counter`, `impressions_counter`, `author` and `attachments`, so most
  "read a post" questions need no `post get` at all.

## `comment`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core comment list <post_id>` | Top-level comments. Returns `id` and `social_id` (chain into `comment react`/`reply`), `reply_counter` (above 0 means nested replies exist) and `author.profile_url`. | proven |
| `curviate core comment add <post_id> "<text>"` | Comment on a post. Returns the new comment's id. `--attach` takes at most one image. | proven |
| `curviate core comment reply <post_id> <comment_id> "<text>"` | Reply to a specific comment. | proven |
| `curviate core comment edit <post_id> <comment_id> "<text>"` | Edit your own comment. | proven |
| `curviate core comment delete <post_id> <comment_id>` | Delete your own comment. | proven |
| `curviate core comment replies <post_id> <comment_id>` | Replies to one comment. | proven |
| `curviate core comment react <post_id> <comment_id> <reaction>` | React to a specific comment (not the post). Same lowercase write vocabulary. | proven |
| `curviate core comment unreact <post_id> <comment_id> <reaction>` | Remove that reaction. | proven |
| `curviate core comment reactions <post_id> <comment_id>` | Reactions on one comment. | proven |
| `curviate core comment user <id\|me>` | Comments a member authored. Same data as `profile <id> --comments`; each carries `post_id` for context. | proven |

- **`comment list` returns only what is visible to you.** The post's own `comment_counter` is always
  greater than or equal to the items returned, so a mismatch is not a bug.
- **`parsed_datetime` is always null on a comment**: use `date` for the ISO timestamp.
- **To check whether you already commented on a post, match on `parent_post.share_url`, never on
  ids.** `parent_post.id` is base64 of a *two*-element array (`[comment_activity, post_activity]`)
  while a post's own `id` is a one-element array, so an id comparison is always false. If you need
  the id, decode and take element `[1]`.
- **A very recent add or delete can take minutes to appear in `comment list`.**

## `feed` and `notification`

| Command | What it does | Confidence |
|---|---|---|
| `curviate core feed home` | The connected account's home feed as agent-actionable posts. `--sort recent` (default, reverse-chronological, always available) or `--sort relevant` (LinkedIn's ranked feed, which draws on a shared throttled budget). `--sort` is ignored when `--cursor` is supplied. | proven |
| `curviate core notification list` | Notification cards, newest first, with the unread badge and a poll watermark. `--filter` selects the stream: `all` (default), `jobs`, `mentions`, `my_posts`, `my_posts_comments`, `my_posts_reactions`, `my_posts_reposts`. | proven |
| `curviate core notification delete <card_urn>` | Delete one of your own notification cards. Idempotent, cannot be undone. | proven |
| `curviate core notification show-less <card_urn>` | Apply "show less like this" to a card's source. For network-activity cards this removes the card, the same as delete. Idempotent, cannot be undone. | proven |

The feed and the notification stream are the two cheapest sources of a genuinely current thing to
engage with: reach for them before searching for something to react to.

## `draft`: prepare a post, schedule it

A Draft is a stored, editable, unpublished post. Give it an account and a time and Curviate publishes
it for you. Use it whenever a post should go out later, or be reviewed first. Established against CLI
`0.47.0`.

| Command | What it does | Confidence |
|---|---|---|
| `curviate core draft create ["<text>"]` | Store a Draft. Every part is optional. `--account <acc_id>`, `--schedule-at <time>`, `--attach <file>` (repeatable). | proven |
| `curviate core draft update <id>` | Change only what you pass: `--text`, `--account`, `--schedule-at`, `--unschedule`, `--attach` (appends). Any update on a `failed` Draft clears its failure. | proven |
| `curviate core draft list` | Drafts, newest first. `--status` a comma list of `draft,scheduled,failed,published` (default without `published`), `--account <acc_id\|none>`, `--from`, `--to`, `--order asc\|desc`, `--all`. | proven |
| `curviate core draft get <id>` | One Draft, with fresh signed links (valid 1 hour) for its attachments. | proven |
| `curviate core draft publish <id>` | Publish now, under the same rules and safety limits as `post create`. Prints the post id; the Draft is deleted. | proven |
| `curviate core draft delete <id>` | Delete a Draft and its media. | proven |

- **`post create` publishes immediately and never schedules.** To schedule, create a Draft with
  `--schedule-at`; the id stays the same through scheduling, unscheduling and edits.
- **`--schedule-at` is ISO 8601 with an offset** (`2026-10-12T09:00:00+02:00`), 5 minutes to 365 days
  ahead, truncated to the minute. It needs an account and non-empty text (up to 3000 characters).
  `update --unschedule` cancels it and the Draft stays a Draft.
- **`--account` is never defaulted**, not from config and not from "the only connected account": a
  Draft without one is valid and sits in its own bucket. Name the account on every Draft you intend
  to publish. `draft list --account none` finds the accountless ones.
- **Limits**: 50 Drafts and 2 GiB of media per account (and per no-account), media per Draft either up
  to 20 images (JPEG, PNG, GIF, WEBP, each up to 5 MiB) or one MP4 video or one PDF (each up to 50 MiB), never mixed. An image over 5 MiB is refused before anything is sent. Two
  scheduled Drafts on one account must be at least 5 minutes apart; actual firing can land up to 20
  seconds off the time you set, and an account's activity window can warn (default) or refuse.
- **`--attach` order is the post order.** Files up to 5 MiB ride inline; larger ones upload one by one
  after the Draft exists. If an upload fails the Draft already exists with the files before it: the
  error names its id, add the rest with `draft update <id> --attach <file>`.
- **A scheduled post that fails becomes a `failed` Draft** with `failure.code`, and a `post.publish_failed`
  webhook (`post.published` on success, only for scheduled firing; `draft publish` has none).
  **`outcome_unknown` means the post may be live: check the account's posts before retrying.** Never
  loop `draft publish` on a timeout.
- **`draft list --status published` lists publish records, not Drafts** (post id, account, time, no
  text). Items there have `object: "publish_record"`.
- **Preview first**: `--preview` renders the request, with attachment names and sizes, and sends nothing.

## Exit codes specific here

The full table is in `curviate`.

- **`2`**: an uppercase reaction value, a malformed post id, more than one attachment on a comment. On a
  Draft also `DRAFT_LIMIT_REACHED`, `MEDIA_QUOTA_EXCEEDED`, `ACCOUNT_REQUIRED`, `DRAFT_NOT_PUBLISHABLE`,
  `SCHEDULE_CONFLICT`.
- **`4`**: usually a wrong identifier *form*, not a missing post. Re-derive the id first.
- **`7` on `draft publish` is the exception to retrying**: a timeout or unknown outcome also exits `7`,
  and the post may be live. List the account's posts first; the Draft is then `failed`
  `outcome_unknown` until you `draft update` it. `DRAFT_PUBLISHING`: a publish is in flight, read it
  again in a few seconds.
