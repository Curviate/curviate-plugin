---
name: curviate-profile
description: "Read and write LinkedIn profiles and company pages with the Curviate CLI, and resolve human search terms into the filter ids search needs. Covers `profile` (me, detail, sections, update, subscription, analytics, visitors, SSI), `company` (detail, employees, posts, jobs, followers, page inbox, follow-invite), `search parameters`, retrieval mode (`--mode`/`--max-age`). Use when fetching or updating a member or company, or resolving a filter id."
---

# Curviate: profiles, companies, and filter ids

Profiles are the entry point for almost every LinkedIn workflow: you resolve a person or a company,
then act. This skill covers that resolution, the company page surface and the parameter lookup every
structured search depends on.

Established against CLI `0.50.0-next.2`.

Setup, credentials, global flags and the exit-code table: `curviate`. Connected Accounts: `curviate-accounts`.

## Retrieval mode: `--mode` and `--max-age`

Four reads decide between a stored copy and a live LinkedIn call. Two are here: `profile me` and
`profile <id>`.

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
curviate core profile me --mode live --json          # source: live
curviate core profile me --mode cache_only --json    # source: store, with observed_at
```

Two mechanics that decide whether a retrieval-mode call works:

- **`cache_only` with `--max-age` is a usage error, exit `2`**, raised before any network call.
  `cache_only` never reaches LinkedIn at any age, so a freshness threshold cannot change its answer.
  Drop `--max-age`, or use `--mode refill`.
- **`cache_only` on a store miss is exit `14` (`NOT_STORED`)**: the profile may exist perfectly well
  on LinkedIn, this API just holds no copy. It is not "not found" (`4`), so re-checking the
  identifier is the wrong move, and it is not retryable as sent. Re-read with `--mode refill` (fetch
  once, store it), `auto`, or `live`.

## `profile`: members

`profile <id>` accepts a vanity slug, a full profile URL (country subdomains such as
`de.linkedin.com` included), a URN, a native member id (`ACoAA…`), or `me`.

| Command | What it does | Confidence |
|---|---|---|
| `curviate core profile <id>` | One member's profile. Accepts `--mode`/`--max-age`, `--sections`, and the activity flags below. | proven |
| `curviate core profile me` | Your own connected profile. Accepts `--mode`/`--max-age`. | proven |
| `curviate core profile <id> --posts` | That member's activity feed (posts and reposts). | proven |
| `curviate core profile <id> --comments` | That member's comments on other people's posts. | proven |
| `curviate core profile <id> --reactions` | That member's reactions. Works on any public profile. Returns `value` and `post_id`; no timestamp exists. | proven |
| `curviate core profile <id> --sections <list>` | LinkedIn sections: `linkedin_experience`, `linkedin_education`, `linkedin_languages`, `linkedin_skills`, `linkedin_certifications`, `linkedin_volunteer_experience`, `linkedin_projects`, `linkedin_recommendations`, `linkedin_interests`, or `linkedin_*` for all. A bare `skills` auto-prefixes. **Pair with `--verbose` every time.** | proven |
| `curviate core profile update [--headline] [--bio] [--first-name] [--last-name] [--skills] [--picture] [--background-picture]` | Update your own profile. Only the flags you pass are sent. | proven |
| `curviate core profile subscription` | Your premium entitlements and plan. A free account is a valid result (`has_premium: false`), not an error. | proven |
| `curviate core profile analytics` | Profile viewers, followers, post impressions and search appearances over LinkedIn's own fixed reporting windows. No window selector exists. | proven |
| `curviate core profile visitors` | Recent profile viewers, classified by disclosure fidelity: identified, semi-anonymous, or aggregate. Premium accounts see more identified viewers. | proven |
| `curviate core profile ssi` | Social Selling Index: overall score, four pillar breakdowns, industry and network percentile ranks. | proven |
| `curviate core profile endorse <id> --endorsement-id <id>` | Endorse a skill. Irreversible: there is no unendorse. | **wired, never live-fired** |

`profile follow`, `unfollow`, `relations`, `followers` and `following` belong to the network
workflow; see `curviate-network`.

### Traps

- **`--sections` returns zero items unless you also pass `--verbose`.** The slim projection strips
  the section payload even when you asked for that exact section. Always pair them.
- **`emails` and `phone_numbers` need `--verbose`, and `--fields` does not escalate for you.**
  `profile <id>` slim strips both; `profile me` slim keeps `emails` and drops `phone_numbers`.
  `--fields emails,phone_numbers` without `--verbose` returns `{}` and a stderr warning, which
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
- **`profile update --headline` reads back on the `description` field, and there is no `--description`
  flag.** The write takes `--headline`; the read response mirrors that text under `description`
  ("NOT the About/Summary section", which is `bio`). `--fields headline` on a read matches nothing and
  is silently dropped like any unmatched path; project it as `--fields description`.
- **A profile write can take minutes to about two and a half hours to appear on read-back.** A
  `profile update` returning exit `0` was accepted. A stale-looking read immediately after is not
  evidence the write failed.
- **A profile fetch is a real, member-visible profile view** and consumes the account's daily
  profile-view allowance. Do not fetch speculatively in a loop.
- **Never write `profile me relations`.** The command is `profile relations`. Older builds silently
  discarded `relations` and answered with your own profile at exit `0`; current builds exit `2`.

## `company`: company pages

`company <id>` takes a slug, URL or numeric id. **Its sub-resources need the numeric provider id**
returned by that first call, so it is always two steps.

| Command | What it does | Confidence |
|---|---|---|
| `curviate core company <id>` | The company profile: name, employee count, website, industry. | proven |
| `curviate core company <id> employees` | People who currently work there. Supports `--keywords`. | proven |
| `curviate core company <id> posts` | The page's posts. | proven |
| `curviate core company <id> jobs` | The page's open postings. | proven |
| `curviate core company managed` | The pages this account administers. An empty result is valid. | proven |
| `curviate core company <id> followers` | A page's followers, newest first. Admin-gated. | proven |
| `curviate core company <id> invitable-followers` | First-degree connections eligible to be invited to follow the page. Items carry no name or headline; hydrate a candidate with `profile <id>` before deciding. `invite_token` is always base64. | proven |
| `curviate core company <id> follow-invite --invitee <member_id>` | Invite those connections to follow the page. Admin-gated write, one `--invitee` per person. | proven |
| `curviate core company <id> chats` | The page's admin message inbox. Admin-gated. Beta. | proven |
| `curviate core company <id> chat <chat_id>` | One conversation from that inbox. Admin-gated. Beta. | proven |
| `curviate core company <id> messages <chat_id>` | A page conversation's messages, newest first. Admin-gated. | proven |
| `curviate core company <id> message <chat_id> <message_id>` | One message from a page conversation. Admin-gated. | proven |
| `curviate core company <id> search-chats [query]` | Search the page inbox. Exactly one mode per call: free text, `--topic`, or `--unread`, mutually exclusive, enforced server-side. Admin-gated. | proven |
| `curviate core company <id> reply <chat_id> <text>` | Reply in a page conversation, as the page. Admin-gated write. Reply-only: it cannot start a conversation. | proven |

**`follow-invite` is all-or-nothing.** A request where every invitee id is valid returns one outcome
per invitee in request order (`invited`, `already_invited`, `ineligible`, `not_found`). A single
invalid id rejects the whole request with a `404` rather than a partial result. Re-inviting someone
already invited is a safe no-op that returns the same invitation id, never a duplicate.

## `search parameters`: turning words into filter ids

Structured search filters take opaque ids, not human text. Resolve first, then search.

```bash
curviate core search parameters --type LOCATION --keywords "Germany" --limit 5 --json
curviate core search people --location <id> --keywords "AI engineer" --json
```

| Command | What it does | Confidence |
|---|---|---|
| `curviate core search parameters --type <T> --keywords "<term>"` | Resolve a term to filter ids. `--type` is one of `LOCATION`, `PEOPLE`, `CONNECTIONS`, `COMPANY`, `SCHOOL`, `INDUSTRY`, `SERVICE`, `JOB_FUNCTION`, `JOB_TITLE`, `EMPLOYMENT_TYPE`, `SKILL`. Both flags required for every type. | proven |
| `curviate core search service-parameters --keywords "<term>" [--type service_category\|location]` | The same resolution for the Services Marketplace filters `search services` accepts. `--type` defaults to `service_category`. | proven |

- **A filter value that is a name rather than an id is silently dropped and the search runs
  unfiltered, at exit `0`.** `--location "Germany"` has returned results from New York, Bengaluru and
  Toronto with no warning at all. Resolve every `--location`, `--industry`, `--company` and
  `--school` value through this command first.
- **`JOB_FUNCTION` returns string tokens** (`eng`, `sale`), not numeric ids, unlike every other type.
  Pass the string straight into `search jobs --function`.
- **`--type PEOPLE` is a working name-to-member lookup** and returns real member profiles; it is also
  how you resolve `search people --followers-of`.
- Results carry both `id` and `public_identifier`, so they chain directly into a connect or a message.

## Exit codes specific here

The full table is in `curviate`.

- **`5`** `LINKEDIN_FEATURE_NOT_SUBSCRIBED` on a read: also what a nonexistent slug returns; see Traps.
- **`14`** `NOT_STORED`: not "not found". Re-read with `refill`, `auto` or `live`, and do not re-check the id.
