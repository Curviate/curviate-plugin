---
name: curviate-contacts
description: "Contacts and Contact lists with the Curviate CLI: import a file, add people, build and combine lists, Tags, custom fields for Sequence variables, enrichment from LinkedIn profiles, export, the Do-not-contact list, Save Connections as Contacts. Use when asked to build or clean a list of people, import a CSV, opt someone out, or get a list ready for a Motion."
---

# Curviate: Contacts and Contact lists

A **Contact** is the Team's record of a person, one per person, keyed on their LinkedIn identity. A **Contact
list** is a named set of Contacts, and what a Motion enrolls from. Nothing here sends anything to LinkedIn or the
person, with one exception: a live enrichment visit.

Established against CLI `0.50.0-next.0`. Every command here ran against a local server with a fake LinkedIn; none
has been live-fired from this skill. Setup and the exit-code table: `curviate`.

**Needs Automate** to create or change anything (`TIER_REQUIRED`, exit `5`; check `curviate tier --json`). Below it,
reads, exports and deletes still work, so a Team that left Automate keeps its data. Motions: `curviate-motions`.

## Build a list for a Motion

1. **Create the list.** `curviate contact lists create "Q4 founders" --description "..."`. Done when it prints a
   `cl_` id. (`contact import --list-name` also creates one; `NAME_TAKEN`, exit `2`, if the name exists.)
2. **Fill it**, from whichever source you have:

   ```bash
   curviate contact import --file people.csv --map "LinkedIn Profile=linkedin_url" --list <list_id> --tag conference
   curviate contact create --linkedin-url <url> --first-name <first> --last-name <last> --list <list_id>
   curviate contact lists add <list_id> --ids <contact_id>,<contact_id>
   curviate contact lists add <list_id> --connected-account <acc_id> --tag hot
   curviate contact lists combine "Hot, no customers" --list <list_id> --list <list_id> --not-list <list_id>
   ```

   Before any filter write, count what it matches: `curviate contact list --tag hot --total --limit 1`, with the same filters.
3. **Read the report.** An import prints `counts` (`created`, `updated`, `unchanged`, `skipped`) and `skipped` rows with a
   `reason`. `curviate contact imports get <import_id> --outcome skipped` lists them. Done when every skipped row is
   explained, for example `invalid_linkedin_url`.
4. **Check the data a Motion will use**, with `--verbose` because the slim view hides `first_name`, `last_name` and
   `extra`:

   ```bash
   curviate contact lists get <list_id> --fields name,contact_count
   curviate contact list --list <list_id> --verbose --fields id,first_name,last_name,extra,tags --limit 5
   ```

   Done when `contact_count` is what you expected and first names and custom fields are filled in.

Then build the Motion: `curviate-motions`.

## Import: what to put in the file

- **Formats**: CSV, JSON (an array of objects) or NDJSON, from the extension; with `--file -` pass `--format`. A file
  above the limit in `curviate contact import --help` is split for you.
- **Headers** map by name. `--map "Header=target"` for anything else: `linkedin_url` is what identifies a person, and a
  row without a valid one is skipped. Read `columns.mapped` and `columns.ignored` in the import record.
- **Give `first_name` and `last_name` their own columns.** Splitting a full name breaks on titles and double names, and
  a greeting is the first thing a person reads. `full_name` alone leaves `{{first_name}}` empty.
- **Any other column becomes a custom field**: a column `opener` lands in `extra.opener`, which a Sequence reads as
  `{{opener}}`. This is where text you researched per person goes. An empty cell means the step sends its fallback.
- **Re-importing is safe.** The same person, in any URL spelling, merges: what you supply wins, Tags are added, a second
  run reports `unchanged`. `--remove-tag` removes explicitly.
- **Undo is partial.** `curviate contact delete --import <import_id>` deletes every Contact in that report, including
  ones it only updated. Confirm first.
- A run that stopped part way: `curviate contact imports list`, then import the rest.

## Connections become Contacts

By default each Account's Connections are saved as Contacts. **Save Connections as Contacts** is per Account:
`curviate account update <acc_id> --no-save-connections-as-contacts` stops it and keeps what is saved. If
`curviate account get <acc_id> --fields save_connections_as_contacts,save_connections_paused_reason` reads
`contact_limit_reached`, delete Contacts and saving resumes. A Contact is not necessarily a Connection:
`connected_account_ids` says which Accounts are. List them with `--connected`, or `--connected-account <acc_id>`.
The synced Connections themselves: `curviate-network`.

## Filters

`curviate contact list` takes `--list`, `--list-match any|all`, `--not-list`, `--tag`, `--motion` with `--status`,
`--connected`, `--connected-account`, `--import`, `--enrichment-status`, `--query`, `--linkedin-url`, `--has-email`,
`--no-email`, combined with AND. The same flags work on `contact export`, `contact delete`, `contact tags add`,
`contact lists add` (where `--from-list` names the source list), and `contact lists combine`.

## Change one Contact, or Tags

```bash
curviate contact get <contact_id> --verbose
curviate contact update <contact_id> --job-title "CTO" --clear headline
curviate contact tags add hot --list <list_id> --query Acme
curviate contact tags remove hot <contact_id>
curviate contact tags list
```

Tags are created on first use. `contact update` leaves fields you do not name alone. Custom fields change through a
re-import, not `contact update`.

## Enrich from LinkedIn

`curviate contact enrich --list <list_id> --mode cache_only` fills from what Curviate already holds and never
visits. **Use it first.** Read `counts` (`from_store`, `not_stored`).

Other modes (`auto`, `refill`, `live`) queue a real profile visit from an Account: **the person can see it in their
profile visitors, and it spends `profile_views`**. It cannot be undone. Tell the user both before you run one, and pick
the Account on purpose:

```bash
curviate contact enrich --list <list_id> --account <acc_id> --mode auto
curviate contact list --list <list_id> --enrichment-status queued --total --limit 1
```

Curviate never fills an email: it comes from the user's own tools. `enrichment.status` is `none`, `queued`, `done` or
`failed`; a visit is paced, so `queued` is normal for a while.

## Do-not-contact

The Team's **one** list of people nobody contacts. Every Motion skips them, and writes toward them are refused with
`DO_NOT_CONTACT`, exit `10`; a reply in a conversation they wrote in stays allowed. Adding someone ends their open
Enrollments.

```bash
curviate do-not-contact add --contact <contact_id> --reason asked_to_stop
curviate do-not-contact add --linkedin-url <url> --reason competitor
curviate do-not-contact list --query <name>
curviate do-not-contact update <entry_id> --reason other
curviate do-not-contact remove <entry_id>
```

Confirm the effect: `curviate enrollment list --contact <contact_id> --fields status,finish_reason` reads
`finished`, `do_not_contact`, and the next Motion preview counts them in `audience.skipped.do_not_contact`.

Anyone in the Team may add, and adding needs no confirmation when the person asked to stop. One person per call: loop for
many. **Removing is for Owners and Managers, and needs the user's explicit go**: Motions may reach them again.

**Exclusion list or Do-not-contact?** An Exclusion list is a Contact list one Motion subtracts
(`exclusion_list_ids`, `curviate-motions`): "not our customers, for this Motion". Do-not-contact is for every Motion and
every write: "they asked us to stop".

## Export

```bash
curviate contact export --list <list_id> --format csv --output contacts.csv
curviate contact export --tag hot --fields linkedin_url,email
```

`csv`, `json` or `ndjson` (the default); `--fields` picks and orders columns. Stdout carries data only, counts go to
stderr, and `--output` leaves a file readable only by you. A CSV re-imports unchanged. Takes no `--json`.

## Delete

Deleting is permanent. Contacts and Tags are for **Owners and Managers** (a Member gets `INSUFFICIENT_ROLE`, exit `5`); anyone may delete a Contact list.

| Command | Effect |
|---|---|
| `curviate contact delete <contact_id>` | Also ends that Contact's Enrollments (`contact_deleted`). Filters delete every match: count first, confirm with the user. `--preview` shows the filter it would send. |
| `curviate contact lists delete <list_id>` | The Contacts stay. Refused with `RESOURCE_IN_USE`, exit `2`, while a Motion uses it: read the Motion in the message, then remove the list from it or archive it. |
| `curviate contact tags delete <tag_id>` | Takes it off everyone. `curviate contact tags update <tag_id> --name <new>` renames. |

Confirm with `curviate contact list --list <list_id> --total --limit 1`.

## Errors in these flows

| Code | Exit | Means | Do |
|---|---|---|---|
| `TIER_REQUIRED` | `5` | Automate needed | Tell the user; `upgradeUrl` is in the error. |
| `INSUFFICIENT_ROLE` | `5` | Deleting Contacts or Tags needs an Owner or Manager | Ask one. The key is fine. |
| `CONTACT_LIMIT_REACHED` | `2` | At the Team's cap; rows past it are skipped, or a Contact is under `refused` | Delete Contacts or reduce the file. |
| `NAME_TAKEN` | `2` | That list name exists | Use `--list <id>`. |
| `RESOURCE_IN_USE` | `2` | A Motion uses that list | See Delete. |
| `RESOURCE_NOT_FOUND` | `4` | A wrong id, or a `--tag` nobody carries | `contact tags list`. Nothing was changed. |
| `IMPORT_QUEUE_FULL` | `6` | Too many imports queued | Wait, run it again: it is safe to repeat. |
| `DO_NOT_CONTACT` | `10` | A write toward someone on the list | Drop them. Never remove them to get a send through. |

Bulk writes answer `updated`, `unchanged`, `not_found` and `refused`: a `0` exit can still hold ids that did nothing.
