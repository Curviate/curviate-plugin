---
name: curviate-search
description: "Find people, companies, posts, jobs, service providers and groups on LinkedIn with the Curviate CLI: `search`, a pasted LinkedIn search URL, `group`, pagination with `--all`, and the filter traps that silently return unfiltered results. Use when sourcing people, qualifying companies, or finding posts and postings."
---

# Curviate: search and discovery

Search is where most workflows start: find the person, the company, the post or the posting, then
act on it. Two rules decide whether a search is trustworthy, and both fail silently when broken:
**structured filters take opaque ids, never human text**, and **a single page is not the result set**.

Established against CLI `0.50.0-next.0`.

## Before any command

Setup, credentials, global flags and the exit-code table: `curviate`. Here:

- `--account <acc_id>` picks who searches; it takes an id, never a name. `--fields` keeps result sets small.
- Search is a read and takes no `--mode`.

## Resolve filter terms first

Every id-taking filter (`--location`, `--industry`, `--company`, `--school`, `--title` on jobs,
`--service-category`) must be resolved before use:

```bash
curviate core search parameters --type LOCATION --keywords "Germany" --limit 5 --json
curviate core search people --keywords "AI engineer" --location <id> --limit 25 --json
```

**A filter value that is a name rather than an id is silently dropped and the search runs
unfiltered, at exit `0`.** `--location "Germany"` has returned New York, Bengaluru and Toronto with
no warning. There is no error to branch on; the only defence is resolving first. Full parameter-type
list and the resolution quirks are in `curviate-profile`.

## The search commands

| Command | What it does | Confidence |
|---|---|---|
| `curviate core search people --keywords "…"` | Member search. Filters: `--industry`, `--location`, `--company`, `--past-company`, `--school`, `--network-distance` (1-3), `--connections-of`, `--followers-of`, `--title` (free text), `--profile-language`. | proven |
| `curviate core search companies --keywords "…"` | Company search. Filters: `--industry`, `--location`, `--has-job-offers`, `--headcount`. | proven |
| `curviate core search posts --keywords "…"` | Post search. Filters: `--sort-by`, `--date-posted` (`past_day`, `past_week`, `past_month`), `--content-type` (`videos`, `images`, `live_videos`, `collaborative_articles`, `documents`), `--posted-by-member`, `--posted-by-company`, `--posted-by-me`, `--mentioning-member`, `--mentioning-company`, `--author-industry`, `--author-company`, `--author-keywords`. | proven |
| `curviate core search jobs --keywords "…"` | Job-posting search. Filters: `--location` (single id) or `--region`, `--location-within-area <miles>`, `--industry`, `--seniority`, `--function`, `--job-type`, `--company`, `--title` (**ids**), `--presence` (`on_site`, `hybrid`, `remote`), `--benefits`, `--commitments`, `--date-posted` (a number of days), `--has-verifications`, `--under-10-applicants`, `--in-your-network`, `--fair-chance-employer`, `--sort-by`. | proven |
| `curviate core search services --keywords "…"` | Services Marketplace providers. At least one of `--keywords`, `--service-category` or `--location` is required. Also `--connections` (1, 2, 3) and `--language`. | proven |
| `curviate core search groups "<query>"` | Keyword search for groups. A no-match search returns an empty list, not an error. | proven |
| `curviate core search "<pasted URL>"` | Runs a pasted LinkedIn search, saved-search or lead-list URL directly. Reach for it when you already built the filters in the LinkedIn UI. | proven |

`--filters '<json>'`, `--filters-file <path>` and `--filters -` (stdin) submit a raw filter body on
`people`, `companies`, `posts` and `jobs`. Named flags win on conflict, and **the server body schema
is strict**: an unknown field is a `400`, not an ignored key.

### Traps

- **`--industry` is a company's *registered* LinkedIn industry, not a topic.** Pairing it with a
  cross-cutting technology theme silently excludes nearly everything relevant: adding an
  AI-flavoured industry filter to an otherwise identical function-plus-keywords search dropped a
  result set from 6,360 to 18. Most companies hiring for an AI role are registered under "Software
  Development" or "IT Services". Use `--keywords` and `--function` for themes; keep `--industry` for
  genuine vertical targeting (healthcare, financial services, construction).
- **`search people --title` is free-text; `search jobs --title` is id-based.** Resolving a job-title
  id and passing it to `search people --title` silently has no effect: the id is treated as a
  substring that matches nothing useful.
- **`--network-distance` and `--location` together have returned a `400` on `search people`.** Pick
  one or the other however the values were resolved.
- **A salary threshold in the raw filter body is unreliable in low-transparency markets.** In
  Germany, three drastically different thresholds against the same search returned identical,
  unfiltered counts with no error; LinkedIn's salary data is too sparse there to filter against.
  Spot-check a filtered against an unfiltered count before qualifying leads by salary.
- **Job postings can carry `company: null`**, even under `--verbose`; agency and confidential
  listings are a legitimate LinkedIn state. Skip them rather than assuming every result has a
  company.
- **Classic job search has no company-size filter.** For "mid-size-or-larger companies hiring for X",
  qualify by size first and then scope the job search to those companies:

  ```bash
  curviate core search companies --headcount 201-500,501-1000 --location <loc_id> --json
  curviate core search jobs --company <id1>,<id2>,<id3> --function eng --json
  ```

  The reverse direction (search jobs, then fetch each company to check size) works but is an N+1
  with no batch lookup. Use it only when the posting itself is the entry point.
- **`--headcount 10001+` is not yet supported.** Omit that bucket.

## Groups

| Command | What it does | Confidence |
|---|---|---|
| `curviate core group list` | Groups the connected account belongs to: a complete read. `--target <slug\|URL>` enumerates another member's groups instead, which is a partial, interests-only read. | proven |
| `curviate core group get <group_id>` | One group's detail: name, member count, description, admin contact, and the write-feasibility gates. | proven |
| `curviate core group members <group_id>` | The member roster: id, profile URL, name, headline, relationship signal. `--name` filters by prefix or substring, case-insensitively. Requires that the connected account is a member of the group. | proven |

## Pagination: one page is not the result set

There is no `--page N`.

| Flag | Effect |
|---|---|
| `--limit N` | Items per page. |
| `--cursor <c>` | Resume from a cursor returned by a previous response. |
| `--all` | Stream every page as NDJSON, one object per line. |
| `--max-pages N` | Cap how many pages `--all` fetches. |
| `--page-delay <ms>` | Pause between pages (default 400; `0` disables). A modest delay keeps a long stream under the platform rate gate. |

Two output shapes, and they parse differently: a single page is an envelope
(`{"object": "…_list", "items": [...], "cursor": …}`), while `--all` is NDJSON. Some searches add
`paging.total_count`.

**`--all` can stop early.** Its last stdout line is then
`{"object": "stream_truncated", "pages_fetched": N, "has_more": true}`. Check for that line before
treating a stream as exhaustive.

## Exit codes specific here

The full table is in `curviate`.

- **`2`**: an unknown flag, a malformed id, a filter body the strict schema rejected.
- **`6`**: a long `--all` walk is the usual cause; raise `--page-delay`.
