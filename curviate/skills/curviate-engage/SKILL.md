---
name: curviate-engage
description: "Create and engage with LinkedIn content using the Curviate CLI. Covers `post` (get, create, react, unreact, reactions, delete, save, saved, unsave, user-posts, user-reactions), `comment` (list, add, reply, edit, delete, replies, react, unreact, reactions, user), `feed home` and `notification`, and `draft` (list, get, create, update, delete, publish: stored posts you can schedule). Carries the write-versus-read reaction vocabularies, post-identifier forms, the pagination trap on reaction lists, and the Draft and scheduling rules. Use when posting, scheduling a post for later, commenting, reacting, reading the home feed, or working through notifications."
---

# Curviate: posts, comments, reactions, feed

Engagement is the cheapest way to be visible, and every write here is public and attributable. Two
vocabularies and three identifier forms cause most failures; both are below.

Command surface established against CLI `0.33.0`.

## Before any command

```bash
npm install -g @curviate/cli && curviate --version    # needs Node 18 or newer
curviate login --api-key <key>                        # or export CURVIATE_API_KEY
curviate account list --json                          # the acc_id for --account
```

- **Credentials resolve flag > environment > stored profile** (`CURVIATE_API_KEY`,
  `CURVIATE_BASE_URL`, `CURVIATE_ACCOUNT`).
- **`--profile <name>` picks the stored credential set; `--account <acc_id>` picks which connected
  LinkedIn account posts, comments or reacts.** Name it explicitly on every write: a comment from
  the wrong account is public and permanent.
- **`--preview` before every write.** It renders the resolved request without sending. On a read
  command it is refused with exit `2`.
- **`--json` on anything you parse**; **`--fields a,b,c`** to project; **`--verbose`** when a slim
  response looks suspiciously empty.
- **Put global flags at the end of the command.**
- **Branch on the exit code, never on prose.** See the table at the end.
- These are not retrieval-mode commands: `--mode`/`--max-age` are refused here with `unknown flag`,
  exit `2` (see `curviate-profile` for the four commands that do accept them).

### Text input

Post and comment text is a positional argument, and `-` reads stdin. **Use a quoted heredoc**: the
quoted delimiter disables every shell expansion, so apostrophes, accents, `$` and backticks survive
intact:

```bash
cat <<'EOF' | curviate post create - --preview
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
| `curviate post get <post_id>` | One post. Adds `is_repost`, `reposted_by`, `user_reacted` and a richer `author` (headline, slug) over what a list carries. | proven |
| `curviate post create "<text>"` | Publish a post. `--attach` is repeatable for images and takes jpg, png, gif, mp4 or pdf; a single PDF produces a document post. | proven |
| `curviate post react <post_id> <reaction>` | React to a post. `--as-organization <id>` reacts as a company page you administer. Duplicate reactions succeed silently. | proven |
| `curviate post unreact <post_id> <reaction>` | Remove your reaction. | proven |
| `curviate post reactions <post_id>` | Reactions on a post: `{value, author: {id, type, name, headline, profile_url, profile_picture_url, network_distance?}}`. Page default 20, maximum 50. No timestamp exists. | proven |
| `curviate post delete <post_id>` | Delete a post you own. | proven |
| `curviate post save <post_id>` | Save to your private bookmark list. Never notifies the author, never visible to anyone else. Idempotent. | proven |
| `curviate post unsave <post_id>` | Remove from the bookmark list. Idempotent. | proven |
| `curviate post saved` | Your saved posts, newest first. Each item is a preview with the snippet capped at 140 characters. | proven |
| `curviate post user-posts <id\|me>` | A member's own posts. Same data as `profile <id> --posts`. | proven |
| `curviate post user-reactions <id\|me>` | A member's own reactions. Same data as `profile <id> --reactions`. | proven |

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
| `curviate comment list <post_id>` | Top-level comments. Returns `id` and `social_id` (chain into `comment react`/`reply`), `reply_counter` (above 0 means nested replies exist) and `author.profile_url`. | proven |
| `curviate comment add <post_id> "<text>"` | Comment on a post. Returns the new comment's id. `--attach` takes at most one image. | proven |
| `curviate comment reply <post_id> <comment_id> "<text>"` | Reply to a specific comment. | proven |
| `curviate comment edit <post_id> <comment_id> "<text>"` | Edit your own comment. | proven |
| `curviate comment delete <post_id> <comment_id>` | Delete your own comment. | proven |
| `curviate comment replies <post_id> <comment_id>` | Replies to one comment. | proven |
| `curviate comment react <post_id> <comment_id> <reaction>` | React to a specific comment (not the post). Same lowercase write vocabulary. | proven |
| `curviate comment unreact <post_id> <comment_id> <reaction>` | Remove that reaction. | proven |
| `curviate comment reactions <post_id> <comment_id>` | Reactions on one comment. | proven |
| `curviate comment user <id\|me>` | Comments a member authored. Same data as `profile <id> --comments`; each carries `post_id` for context. | proven |

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
| `curviate feed home` | The connected account's home feed as agent-actionable posts. `--sort recent` (default, reverse-chronological, always available) or `--sort relevant` (LinkedIn's ranked feed, which draws on a shared throttled budget). `--sort` is ignored when `--cursor` is supplied. | proven |
| `curviate notification list` | Notification cards, newest first, with the unread badge and a poll watermark. `--filter` selects the stream: `all` (default), `jobs`, `mentions`, `my_posts`, `my_posts_comments`, `my_posts_reactions`, `my_posts_reposts`. | proven |
| `curviate notification delete <card_urn>` | Delete one of your own notification cards. Idempotent, cannot be undone. | proven |
| `curviate notification show-less <card_urn>` | Apply "show less like this" to a card's source. For network-activity cards this removes the card, the same as delete. Idempotent, cannot be undone. | proven |

The feed and the notification stream are the two cheapest sources of a genuinely current thing to
engage with: reach for them before searching for something to react to.

## `draft`: prepare a post, schedule it

A Draft is a stored, editable, unpublished post. Give it an account and a time and Curviate publishes
it for you. Use it whenever a post should go out later, or be reviewed first. Established against CLI
`0.47.0`.

| Command | What it does | Confidence |
|---|---|---|
| `curviate draft create ["<text>"]` | Store a Draft. Every part is optional. `--account <acc_id>`, `--schedule-at <time>`, `--attach <file>` (repeatable). | proven |
| `curviate draft update <id>` | Change only what you pass: `--text`, `--account`, `--schedule-at`, `--unschedule`, `--attach` (appends). Any update on a `failed` Draft clears its failure. | proven |
| `curviate draft list` | Drafts, newest first. `--status` a comma list of `draft,scheduled,failed,published` (default without `published`), `--account <acc_id\|none>`, `--from`, `--to`, `--order asc\|desc`, `--all`. | proven |
| `curviate draft get <id>` | One Draft, with fresh signed links (valid 1 hour) for its attachments. | proven |
| `curviate draft publish <id>` | Publish now, under the same rules and safety limits as `post create`. Prints the post id; the Draft is deleted. | proven |
| `curviate draft delete <id>` | Delete a Draft and its media. | proven |

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

## Full command surface

<!-- generated: command surface, CLI 0.47.0 -->

Read from the CLI's own `--help` at version 0.47.0. Descriptions, traps and confidence
tags elsewhere in this skill are hand-written and carry the version they were established against.

Every command below that takes flags at all also accepts `--account`, `--api-key`, `--base-url`, `--beta`, `--json`, `--profile`, `--timeout`, `--verbose`.

| Command | Arguments | Flags |
|---|---|---|
| `curviate post get` | `POSTID` | `--fields` |
| `curviate post create` | `TEXT` | `--preview`, `--attach` |
| `curviate post react` | `POSTID` `REACTION` | `--preview`, `-reaction, --reactionAlias`, `--as-organization` |
| `curviate post reactions` | `POSTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate post delete` | `POSTID` | `--fields`, `--preview` |
| `curviate post unreact` | `POSTID` `REACTION` | `--fields`, `--preview` |
| `curviate post saved` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate post save` | `POSTID` | `--fields`, `--preview` |
| `curviate post unsave` | `POSTID` | `--fields`, `--preview` |
| `curviate post user-posts` | `USERID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate post user-reactions` | `USERID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate comment list` | `POSTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate comment add` | `POSTID` `TEXT` | `--fields`, `--preview`, `--attach` |
| `curviate comment reply` | `POSTID` `COMMENTID` `TEXT` | `--fields`, `--preview`, `--attach` |
| `curviate comment edit` | `POSTID` `COMMENTID` `TEXT` | `--fields`, `--preview` |
| `curviate comment delete` | `POSTID` `COMMENTID` | `--fields`, `--preview` |
| `curviate comment replies` | `POSTID` `COMMENTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate comment react` | `POSTID` `COMMENTID` `REACTION` | `--fields`, `--preview` |
| `curviate comment reactions` | `POSTID` `COMMENTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate comment unreact` | `POSTID` `COMMENTID` `REACTION` | `--fields`, `--preview` |
| `curviate comment user` | `USERID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate draft list` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--status`, `--from`, `--to`, `--order` |
| `curviate draft get` | `ID` | `--fields` |
| `curviate draft create` | `TEXT` | `--fields`, `--preview`, `--schedule-at`, `--attach` |
| `curviate draft update` | `ID` | `--fields`, `--preview`, `--text`, `--schedule-at`, `--unschedule`, `--attach` |
| `curviate draft delete` | `ID` | `--fields`, `--preview` |
| `curviate draft publish` | `ID` | `--fields`, `--preview` |
| `curviate feed home` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--sort` |
| `curviate notification list` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--filter` |
| `curviate notification delete` | `CARDURN` | `--fields`, `--preview` |
| `curviate notification show-less` | `CARDURN` | `--fields`, `--preview` |

<!-- /generated -->

## Exit codes to branch on here

| Code | Meaning | What to do |
|---|---|---|
| `1` | `INTERNAL` from the server itself: a genuine bug on the platform side. | Worth one retry; if it repeats it is a bug to report, not a state to work around. |
| `2` | Usage or invalid input, often raised before any network call: an uppercase reaction value, a malformed post id, more than one attachment on a comment. On a Draft the API's own refusals land here too, each with its code: `DRAFT_LIMIT_REACHED`, `MEDIA_QUOTA_EXCEEDED`, `ACCOUNT_REQUIRED`, `DRAFT_NOT_PUBLISHABLE`, `SCHEDULE_CONFLICT`. | Fix the invocation. Never retry unchanged. |
| `4` | Not found, usually a wrong identifier *form* rather than a missing post. | Re-derive the id before concluding the post is gone. |
| `5` | Three causes, one code: read `error.code`. `NO_ACTIVE_SEAT`: the account is on no active seat. `LINKEDIN_FEATURE_NOT_SUBSCRIBED`: LinkedIn itself lacks the feature. `BETA_NOT_ENABLED`: the operation is beta-gated and this workspace has not opted in (pass `--beta` for one call, or a human enables it in Settings). | Branch on `error.code`: the three fixes have nothing in common, and none is fixed by retrying unchanged. |
| `6` | `PLATFORM_RATE_LIMIT` and its siblings. Carries `retry_after` in whole seconds. A response naming `budgetRow` means only that row is paused; every other row on the account keeps working. | **Back off and retry** after that many seconds. On a named `budgetRow`, switch to other work on the account rather than backing off across the board. |
| `7` | **`draft publish` is the exception to retrying: a timeout or unknown outcome also exits `7`, and the post may be live.** Never retry `draft publish` blindly; if the message says the outcome is unknown (or to check the account's posts), list the account's posts first, and note the Draft is then `failed` `outcome_unknown` until you `draft update` it. `DRAFT_PUBLISHING` (a publish of that Draft is in flight): read it again in a few seconds. Every other transient platform fault: a hiccup, or a request that got no response at all (network error, DNS failure, timeout) or one that came back as something other than a valid API answer. Carries `retryLikelyToSucceed: true`. | Retry with backoff, except `draft publish`: check the account's posts first. |
| `8` | Account or connection state. Read `error.code`. | `LINKEDIN_OPERATION_NOT_SUPPORTED` is permanent and never retryable; a session error needs a reconnect. |
| `13` | `BUDGET_EXHAUSTED`: a safety rule of your own refused the action, not LinkedIn. Read `error.safetyReason`: `ceiling` means the row named in `error.budgetRow` hit its configured limit; `activity_window` means the account is outside the hours it works in (no `budgetRow` on that one). **Nothing reached LinkedIn and nothing was spent; nothing was posted.** `reset_at` can be weeks out, and may be `null` where no clock frees it. | **Do not back off and retry.** `error.safetyHint.parameter` names the exact setting to change. Read `quotas[]` via `curviate account get <acc_id> --json`, then wait for the named reset or change that setting. |
