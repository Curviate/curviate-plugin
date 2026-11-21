---
name: curviate-leads
description: "Leads and Lead lists with the Curviate CLI: import a file or a LinkedIn search, add people, build and combine lists, Tags, custom fields for Sequence variables, enrichment from LinkedIn profiles, export, the Do-not-contact list, Save Connections as Leads. Use when asked to build or clean a list of people, import a CSV or a search, opt someone out, or get a list ready for a Campaign."
---

# Curviate: Leads and Lead lists

A **Lead** is the Team's record of a person, one per person, keyed on their LinkedIn identity. A **Lead
list** is a named set of Leads, and what a Campaign enrolls from. Nothing here sends anything to LinkedIn or the
person, with one exception: a live enrichment visit.

Checked against CLI `0.66.0`. Every command here ran against a local server with a fake LinkedIn; none
has been live-fired from this skill. Setup and the exit-code table: `curviate`.

**Needs the plan** to create or change anything (`curviate tier --json`). Without it, reads, exports and deletes still work. Campaigns: `curviate-campaigns`.

## Build a list for a Campaign

1. **Create the list.** `curviate lead lists create "Q4 founders" --description "..."`. Done when it prints a
   `cl_` id. (`lead import --list-name` also creates one; `NAME_TAKEN`, exit `2`, if the name exists.)
2. **Fill it**, from whichever source you have:

   ```bash
   curviate lead import --file people.csv --map "LinkedIn Profile=linkedin_url" --list <list_id> --tag conference
   curviate lead create --linkedin-url <url> --first-name <first> --last-name <last> --list <list_id>
   curviate lead lists add <list_id> --ids <lead_id>,<lead_id>
   curviate lead lists add <list_id> --connected-account <acc_id> --tag hot
   curviate lead lists combine "Hot, no customers" --list <list_id> --list <list_id> --not-list <list_id>
   ```

   `curviate lead lists list` shows the lists and their counts; `curviate lead lists update <list_id> --name <new>` renames;
   `curviate lead lists remove <list_id> --ids <lead_id>` (or the filter flags) takes Leads off a list and keeps them.
   Before any filter write, count what it matches: `curviate lead list --tag hot --total --limit 1`, with the same filters.
3. **Read the report.** An import prints `counts` (`created`, `updated`, `unchanged`, `skipped`) and `skipped` rows with a
   `reason`. From a LinkedIn source, `updated` is a Lead the import filled at least one empty field on (never a value
   replaced); a Lead it only added to the list is `unchanged`. `curviate lead imports get <import_id> --outcome skipped` lists them. Done when every skipped row is
   explained, for example `invalid_linkedin_url`.
4. **Check the data a Campaign will use**, with `--verbose` because the slim view hides `first_name`, `last_name` and
   `extra`:

   ```bash
   curviate lead lists get <list_id> --fields name,lead_count
   curviate lead list --list <list_id> --verbose --fields id,first_name,last_name,extra,tags --limit 5
   ```

   Done when `lead_count` is what you expected and first names and custom fields are filled in.

Then build the Campaign: `curviate-campaigns`.

## Import: what to put in the file

- **Formats**: CSV, JSON (an array of objects) or NDJSON, from the extension; with `--file -` pass `--format`. A file
  above the limit in `curviate lead import --help` is split for you.
- **Headers** map by name. `--map "Header=target"` for anything else: `linkedin_url` is what identifies a person, and a
  row without a valid one is skipped. Read `columns.mapped` and `columns.ignored` in the import record.
- **Give `first_name` and `last_name` their own columns.** Splitting a full name breaks on titles and double names, and
  a greeting is the first thing a person reads. `full_name` alone leaves `{{first_name}}` empty.
- **Any other column becomes a custom field**: a column `opener` lands in `extra.opener`, which a Sequence reads as
  `{{opener}}`. This is where text you researched per person goes. An empty cell means the step sends its fallback.
- **Re-importing is safe.** The same person, in any URL spelling, merges: what you supply wins, Tags are added, a second
  run reports `unchanged`. `--remove-tag` removes explicitly.
- **Moving Leads with their lists** (another Team, another tool): export with the `lists` column (a CSV has it; for
  JSON add `--fields linkedin_url,...,tags,lists`), then `curviate lead import --file <export> --apply-lists`. Each
  Lead joins the lists its `lists` names, missing lists are created by name, nothing is removed. Without the flag
  `lists` is ignored. A row past the Team's list limit is skipped as `list_limit_reached`.
- **Undo is partial.** `curviate lead delete --import <import_id>` deletes every Lead in that report, including
  ones it only updated.
- A run that stopped part way: `curviate lead imports list`, then import the rest.
- **A timeout or dropped connection does not mean nothing was imported.** The CLI then reads the Team's newest imports and
  reports the one this request made (`completed` with its counts, or `running`/`queued`, which it keeps waiting on); do not
  run the file again. Only when none exists does it say nothing was imported, and then read `lead imports list` before a
  re-run: a slow import may still appear. `--json` prints one document on stdout; waits and progress go to stderr.
- **A busy Team waits for you.** `RATE_LIMIT_TENANT` (429, nothing imported) makes the CLI wait the advertised `Retry-After`
  (up to 60 s) and send that import again; a longer wait stops the run, exit `6`.

## Import from LinkedIn

"Import the people of this search": one `lead import` with a source, never a search you page and add by hand. The
import reads the source itself from one Account, inside that Account's limits and Active hours. It spends the
Account's search allowance and paces itself on purpose: minutes for a short search, days for a large one. **Ask first, even when the
request names the search, the Account and the list**: show the source, the Account, `--max`, the list it fills and
what it spends, and send the create only on a go in a later message.

```bash
curviate lead import --source-url "<pasted LinkedIn search URL>" --account <acc_id> --max 200 --list-name "CTOs" --json
curviate lead import --source company_people --filter keywords=fintech --titles CTO --account <acc_id> --json
curviate lead imports get <import_id> --json
```

- **Sources and "Build a search" filters**: `curviate lead import --help` names every `--source` kind, the `--filter`
  keys each kind offers and the caps. A key it does not offer is refused before anything runs. `location`, `industry`,
  `current_company`, `past_company` and `school` take ids, resolved first with `curviate core search parameters`
  (`curviate-search`), never a name; a job title goes as text in `advanced_keywords`. "30 heads of sales in Berlin":

  ```bash
  curviate core search parameters --type LOCATION --keywords "Berlin" --limit 5 --json
  curviate lead import --source people_search --filters-json '{"advanced_keywords":{"title":"Head of Sales"},"location":["<location_id>"]}' --max 30 --list-name "Heads of sales Berlin" --account <acc_id> --json
  ```

  On a free Account search pages are few (an hour, a day and LinkedIn's month, `curviate account safety get <acc_id>
  --fields search_pacing --json`), so say the estimate before the go.
- **Start once, report, come back later.** The answer is the import (`imp_`, `queued`); read it once with
  `lead imports get` and give the user its `progress` line (without `--json`; with it, the same sentence on stderr):
  when the next page is read and how long is left. Do not wait or poll in a loop: `next_page_at` (or `waiting.until`)
  says when anything changes, so look again then or when the user asks. `estimate.seconds_min`/`seconds_max` is the
  time left (`working_days_*` are deprecated); a finished one took `finished_at` minus `started_at`. `waiting` says
  why no page is read now, and each resumes on its own: `budget` (a search limit of the Account, named by
  `waiting.budget`: `hour`, `day`, `lines`, `month`, or `warm_up` while warm-up holds the Account's search at 0
  pages; while an import runs, it and the Account's plain searches each are sure of half the hour's and the day's pages),
  `active_hours`, `pushback` (LinkedIn slowed this search down), `search_limited` (LinkedIn shows the Account only a
  few results for now; at the latest `until`), `halt` (a safety pause), `import_ahead` (queued behind
  `waiting.import_id`, another import of the same Account; `next_page_at` is its first page). Only two need anyone:
  `account_unavailable` (reconnect the Account, `curviate-accounts`) and, if the user wants it faster, a `budget`
  limit raised with `curviate account safety update <acc_id> --search-pages-per-day <n>` (`-per-hour`, `-per-month`)
  on their go (`curviate-accounts`, search pages).
- `curviate lead imports pause|resume|stop <import_id>`. A stopped or finished one goes on with
  `--continue <import_id>` on the same source; `IMPORT_STATUS_CONFLICT` means one of that source is still open.

## Connections become Leads

By default each Account's Connections are saved as Leads. **Save Connections as Leads** is per Account:
`curviate account update <acc_id> --no-save-connections-as-leads` stops it and keeps what is saved. If
`curviate account get <acc_id> --fields save_connections_as_leads,save_connections_paused_reason` reads
`lead_limit_reached`, delete Leads and saving resumes. A Lead is not necessarily a Connection:
`connected_account_ids` says which Accounts are. List them with `--connected`, or `--connected-account <acc_id>`.
The synced Connections themselves: `curviate-network`.

## Filters

`curviate lead list` takes `--list`, `--list-match any|all`, `--not-list`, `--tag`, `--campaign` with `--status`,
`--connected`, `--connected-account`, `--import`, `--enrichment-status`, `--query`, `--linkedin-url`, `--has-email`,
`--no-email`, combined with AND. The same flags work on `lead export`, `lead delete`, `lead tags add`,
`lead lists add` (where `--from-list` names the source list), and `lead lists combine`.

## Change one Lead, or Tags

```bash
curviate lead get <lead_id> --verbose
curviate lead update <lead_id> --job-title "CTO" --clear headline
curviate lead tags add hot --list <list_id> --query Acme
curviate lead tags remove hot <lead_id>
curviate lead tags list
```

Tags are created on first use. `lead update` leaves fields you do not name alone. Custom fields change through a
re-import, not `lead update`.

## Company fields

Your Team's own fields for a company (numeric LinkedIn id), shared by every Lead who works there and read in a Sequence as
`{{company.extra.<key>}}`. Stored data only: no LinkedIn call.

```bash
curviate company get <company_id> --json                     # the stored record and its extra
curviate company fields <company_id> --set tier=A --unset owner
curviate company fields --file companies.csv                 # header company_id, then one column per key
```

`--file` sends one request per company, in file order, and stops at the first refusal: the companies before it are set.
A company no Lead of the Team works at and the Team never read is `RESOURCE_NOT_FOUND` (exit `4`).

## Enrich from LinkedIn

`curviate lead enrich --list <list_id> --mode cache_only` fills from what Curviate already holds and never
visits. **Use it first.** Read `counts` (`from_store`, `not_stored`).

Other modes (`auto`, `refill`, `live`) queue a real profile visit from an Account: **the person can see it in their profile visitors, and it spends `profile_views`**. It cannot be undone, so pick the Account on purpose:

```bash
curviate lead enrich --list <list_id> --account <acc_id> --mode auto
curviate lead list --list <list_id> --enrichment-status queued --total --limit 1
```

**Email**: a profile read, an enrich visit included, fills an empty `email` from the first of the profile's `emails[]`; LinkedIn shows those only to a Connection. It never overwrites one your Team supplied. Anything else comes from the user's own tools. `enrichment.status` is `none`, `queued`, `done` or
`failed`; a visit is paced, so `queued` is normal for a while.

## Do-not-contact

The Team's **one** list of people nobody leads. Every Campaign skips them, and writes toward them are refused with
`DO_NOT_CONTACT`, exit `10`; a reply in a conversation they wrote in stays allowed. Adding someone ends their open
Enrollments.

```bash
curviate do-not-contact add --lead <lead_id> --reason asked_to_stop
curviate do-not-contact add --linkedin-url <url> --reason competitor   # asked_to_stop, existing_customer, competitor, partner, employee, other
curviate do-not-contact list --query <name>
curviate do-not-contact update <entry_id> --reason other
curviate do-not-contact remove <entry_id>
curviate do-not-contact import --file do-not-contact.csv   # many people: linkedin_url, optional reason
curviate do-not-contact export --format csv --output do-not-contact.csv
```

Read it back: `curviate enrollment list --lead <lead_id> --fields status,finish_reason` reads
`finished`, `do_not_contact`, and the next Campaign preview counts them in `audience.skipped.do_not_contact`.

Anyone in the Team may add, with no go needed when the person asked to stop. For many people use `import`: a CSV, JSON or NDJSON file with a `linkedin_url` and an optional `reason` per row.
Each row works as `add`: a person already listed is reported `unchanged` and keeps their reason, a bad URL or reason
skips its row, and the report gives the row, reason and field. An exported file imports as it is, so `export` from
one Team and `import` into another moves the list. The people need no Lead first; check the report's `skipped` rows. Exporting and removing are for Owners and Managers: removed, Campaigns may reach them again.

**"No email"** is an entry with `--scope email_only`: email steps skip the person, LinkedIn steps and writes still reach
them (`everything`, the default, stops both). **"Can I email or message this Lead?"** is one read of the Lead itself:
`do_not_contact` on `curviate lead get <lead_id>` (or a `lead list` page) is `null` or `{scope, reason, how, at}`. Answer
from that field; never page `do-not-contact list` for it. A Lead holds one `email`; `lead list --no-email` finds those
without one.

**Exclusion list or Do-not-contact?** An Exclusion list is a Lead list one Campaign subtracts
(`exclusion_list_ids`, `curviate-campaigns`): "not our customers, for this Campaign". Do-not-contact is for every Campaign and
every write: "they asked us to stop".

## Export

```bash
curviate lead export --list <list_id> --format csv --output leads.csv
curviate lead export --tag hot --fields linkedin_url,email
```

`--format csv` for CSV, or `json`; the default is `ndjson`, whatever `--output` is called. `--fields` picks and orders columns. Stdout carries data only, counts go to
stderr, and `--output` leaves a file readable only by you. A CSV re-imports unchanged; add `--apply-lists` on import to bring its `lists` along. Takes no `--json`.

## Delete

Deleting is permanent. Leads and Tags are for Owners and Managers; anyone may delete a Lead list.

| Command | Effect |
|---|---|
| `curviate lead delete <lead_id>` | Also ends that Lead's Enrollments (`contact_deleted`). Filters delete every match: count first. `--preview` shows the filter it would send. |
| `curviate lead lists delete <list_id>` | The Leads stay. Refused with `RESOURCE_IN_USE`, exit `2`, while a Campaign uses it: read the Campaign in the message, then remove the list from it or archive it. |
| `curviate lead tags delete <tag_id>` | Takes it off everyone. `curviate lead tags update <tag_id> --name <new>` renames. |

Read back with `curviate lead list --list <list_id> --total --limit 1`.

## Errors in these flows

Plan and role refusals: `curviate`.

| Code | Exit | Means | Do |
|---|---|---|---|
| `LEAD_LIMIT_REACHED` | `2` | At the Team's cap; rows past it are skipped, or a Lead is under `refused` | Delete Leads or reduce the file. |
| `NAME_TAKEN` | `2` | That list name exists | Use `--list <id>`. |
| `RESOURCE_IN_USE` | `2` | A Campaign uses that list | See Delete. |
| `RESOURCE_NOT_FOUND` | `4` | A wrong id, or a `--tag` nobody carries | `lead tags list`. Nothing was changed. |
| `IMPORT_QUEUE_FULL` | `6` | Too many imports queued | Wait, run it again: it is safe to repeat. |
| `RATE_LIMIT_TENANT` | `6` | The Team has other Lead or Campaign writes running; nothing imported | Import waits and resends itself (up to 60 s); past that, wait and run again. |
| `CLIENT_TIMEOUT` | `7` | No answer within `--timeout`; the write may have landed | On `import` the CLI reports the import it made. Anywhere else read the state before repeating. |
| `DO_NOT_CONTACT` | `10` | A write toward someone on the list | Drop them. Never remove them to get a send through. |

Bulk writes answer `updated`, `unchanged`, `not_found` and `refused`: a `0` exit can still hold ids that did nothing.
