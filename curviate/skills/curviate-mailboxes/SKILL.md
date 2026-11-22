---
name: curviate-mailboxes
description: "Mailboxes with the Curviate CLI: connect the Team's own Gmail, Microsoft or IMAP address, reconnect, read a Mailbox's state, cap and pauses, Mailbox warm-up and where its mail lands, placement tests, sending domains and their checks, the Team's email defaults, and Mailboxes from Curviate: the quote, the order, its DNS records, what an order waits for, how it ends, removal. Use when a Mailbox needs connecting or fixing, the user wants to buy Mailboxes, or asks why an email waits."
---

# Curviate: Mailboxes

A **Mailbox** is an email address of the Team that Campaigns and the Unibox send from and read replies in. It sends for
one Account, for any Account (`shared`) or for none (then it sends nothing). It takes no seat and is never billed, except
**Mailboxes from Curviate**, which Curviate sets up on a domain the Team owns. Email is part of the plan and sends once a
Mailbox is connected. Every role reads; Owners and Managers change any Mailbox, a Member the ones they connected.
**No LinkedIn Account is needed for email**: a Campaign with no Account sends from the Mailboxes it names in
`shared_mailbox_ids` (`curviate-campaigns`), so a Team can run on Mailboxes alone.

Checked against CLI `0.67.0`. Setup and the exit-code table: `curviate`. Email steps: `curviate-campaigns`. Replies by
email: `curviate-unibox`. How email is doing: `curviate analytics email --range 30d --json` (`curviate-campaigns`).

## Connect the user's own Mailbox

The person signs in on Google's, Microsoft's or Curviate's own page. You prepare the request and hand over its link; the
password goes from the person straight to that page.

1. `curviate mailbox discover <address> --json`: the connection the address takes. Show settings marked
   `confirm_required` to the person and use them only as confirmed. Done when the person agrees on the connection.

   | Address | `--connection` |
   |---|---|
   | A private Gmail address | `google_app_password`: the person creates an app password in their own Google account (it needs 2-Step Verification there) and types it on Curviate's page. |
   | Google Workspace whose administrator trusts Curviate | `google_sign_in` |
   | Microsoft 365 or Outlook | `microsoft_sign_in`; a request with `admin_consent_url` goes to the domain's Microsoft administrator, through the person. |
   | Anything else | `imap_smtp` with the six server flags, as confirmed. |

2. `curviate mailbox connect <address> --connection <connection> --json`. Done when it prints the request `id` and `url`.
   A repeat makes a second request: read the first one instead.
3. Give the person the `url`. They finish there, signed in to Curviate.
4. Read `curviate account connect-request get <id> --json` when they say they are done, or a few times a few minutes
   apart, never in a tight loop, until `status` leaves `pending`; `completed` carries `mailbox_id`. Read it back with
   `curviate mailbox get <mailbox_id>`. `curviate account connect-request cancel <id>` withdraws a request.

**A password stays with its person.** When the user offers a password in the chat, give them the link instead. A person who
prefers their own terminal reads `curviate mailbox connect --help` there and runs it themselves, typing the password into that
terminal; it never passes through you, a file you wrote or a command you compose.

| Refusal | Exit | Do |
|---|---|---|
| `MAILBOX_APP_PASSWORD_REQUIRED` | `2` | A private Gmail address takes `google_app_password`, or the person typed their Google password, not an app password. |
| `MAILBOX_CREDENTIAL_REJECTED`, `MAILBOX_TLS_FAILED` | `8` | The host refused the password or the encryption named; the request stays open for another try by the person. |
| `MAILBOX_ALREADY_CONNECTED` | `8` | The address is already a Mailbox of the Team: read `mailbox list`. |
| `MAILBOX_LIMIT_REACHED` | `2` | Past the Team's Mailbox allowance (100 per paid seat, 20 on a trial). A paid seat adds room (`curviate-accounts`). |
| `MAILBOX_ADMIN_APPROVAL_REQUIRED` | `5` | The domain's administrator approves Curviate first. |

A Mailbox in `reconnect_needed` comes back the same way: `curviate mailbox reconnect <mbx_id> --json`, then steps 3 and 4.

## Read a Mailbox

```bash
curviate mailbox list --json
curviate mailbox get <mbx_id> --json
curviate domain check <domain> --now
```

Read `mailbox get` before you explain why an email waits: state, daily cap, sent today, bounces. `ramping` works up to its cap
on its own; `paused` is a person's pause, lifted with `curviate mailbox resume <mbx_id>` (`curviate mailbox pause <mbx_id>`
sets one); `paused_by_bounces` and `paused_by_provider` are not yours to lift: tell the user what the read says.
`cap_lowered_to` means a spam reading lowered the cap.

`curviate mailbox update <mbx_id>` sets who it sends for (`--sends-for <acc_id>` or `shared`), the daily cap (1 to 50 across
every Campaign), the signature (an email step places it, `curviate-campaigns`; nothing adds it by itself), the From name and
warm-up; flags left out stay. `domain check` reads a sending domain's `mx`, `spf`, `dkim`, `dmarc` and `tracking` checks
(`--now` runs DNS lookups now, nothing is sent); a check warns and never stops sending.

**Signing and one-click unsubscribe.** `domain check` also reads `signing` (optional, never a failure) and
`signing_record`: one TXT record with Curviate's own signing key for this domain and Team, about 410 characters. While
`signing` does not pass, stderr names the record: give it to the user to add exactly as shown, and no other record at
that name. With it, Curviate signs the domain's email from Mailboxes from Curviate and Google Mailboxes connected with an
app password, and those emails offer the mail app's one-click unsubscribe; the others send the unsubscribe link only.
`signing_record` is null where Curviate signs nothing. `curviate analytics email --json` counts it in
`opt_outs.one_click`: `live` of `mailboxes` send one-click now.

**Mailbox warm-up** is included in the plan: `curviate mailbox update <mbx_id> --warm-up on --days 14` (10, 14, 21 or 28;
`--warm-up off` stops it). `landing` on `mailbox get` says where its warm-up mail lands per provider: report the verdict as
read. Warm-up `waiting` means on but not running, its day held: `reason` says what lifts it (`reconnect_needed`, `trial`,
`app_password`, `warm_up_app`, `allowance`, `paused_by_curviate`, `address_check`: nothing to do, `address_unconfirmed`:
check the connection settings). `reputation` is 0 to 100, or null: with `reputation_reason` `warm_up_off` there is no score
because warm-up is off, else it is gathering; never say 0. `landing.reason` `warm_up_off`: nothing to read.

**Placement tests**: `curviate mailbox test <mbx_id> --subject <s> --body-file <file>` sends the user's exact email to 12
test inboxes and reads where each copy lands; `curviate mailbox tests <mbx_id> [<test_id>]` reads the verdicts within the
hour. Each test spends 12 of today's cap and one of the Team's monthly tests (10 per paid seat), so it waits for a go. Exit
`5` with `PLACEMENT_TEST_ALLOWANCE_EXHAUSTED`: the month's tests are used; exit `1` with `PLACEMENT_TESTS_UNAVAILABLE`:
they cannot run now. Never retry either. `curviate campaign placement <mot_id>` reads a Campaign's weekly checks.

**The Team's email defaults**: `curviate account safety get --team --json` reads `email` (the daily cap a new Mailbox gets,
what an opt-out covers, the three opt-out texts). An Owner or Manager changes them with `curviate account safety update
--team --email-default-cap <n>` (`--email-opt-out-scope everything|email_only`, `--email-opt-out-text`,
`--email-opt-out-link-text`, `--email-opt-out-link-word`): every email step of the Team carries those texts, so only on the
user's go.

`curviate mailbox remove <mbx_id>` deletes the Mailbox and its stored credentials and drops every email due from it; there
is no undo but connecting again, so it waits for a go. `MAILBOX_STATE_CONFLICT` (exit `8`) "still settling with billing"
changed nothing: the person may try again later; never resend it yourself.

## Mailboxes from Curviate

Curviate sells Mailboxes, never domains: they go on a domain the user already owns, separate from the domain their company
email runs on. Never offer to buy or register a domain. Only a Team Owner's key orders. Warm-up is included. Each
Mailbox is a monthly item on the Team's subscription (a yearly Team pays a year).

1. **Ask** the count, the domain (a whole domain they own, never a subdomain such as `mail.acme.com`), and each Mailbox's
   address part, name and who it sends for (`shared` or an `acc_` id). Never state a price from memory or help text.
2. **Room under the cap**: `curviate billing cap --json`: `mailbox_cap` holds `cap`, `count` and `room`. More than `room`
   is refused: say so and stop. Never split an order to fit; only an Owner raises the cap, in the dashboard.
3. **The price**: `curviate mailbox quote <count> --json` is the server's price for this Team. Show it as served: `amount`
   and `unit_amount` (minor units) for `billing_period`, plus tax where `plus_tax`, and when it is `charged`. A yearly Team
   (`annual`, `when_records_found`) pays the rest of its billing year the day the records are found, not a monthly
   amount: say so in those words. `orderable: false` stops here; tell the user what `not_orderable_reason` asks of them:

   | `not_orderable_reason` | Tell the user |
   |---|---|
   | `trial` | The Team has no paid plan yet: a seat first (`curviate-accounts`), then order. |
   | `payment` | The Team has a payment outstanding: an Owner updates the payment method in Billing (app.curviate.com/settings/billing), then orders. |
   | `currency` | The subscription is billed in another currency than Mailboxes from Curviate (US dollars), a euro one for example: they contact support. Nothing to do from here. |
   | `capacity` | Curviate has no room for this many new Mailboxes at the moment and is adding more: order fewer, or later. A smaller count is the user's choice, with its own quote and go. |
   | `sales_paused` | Orders cannot be placed at the moment. |

   `charge_waits_for` is always null: never read or report it.
4. **Show and ask**: the count, the domain, the addresses, who each sends for and that quote. Wait for an explicit go for
   exactly that.
5. **One order** on the go: `curviate mailbox buy --domain <d> --mailbox local:Name:shared ... --yes --expect-amount
   <amount>`, the quote's `amount`. Exit `11` with `PRICE_CHANGED` means the order's `price` was not the quote: the CLI
   cancelled it while it waited for its records (nothing charged). Report both prices; a new order needs a new quote and
   go. Otherwise compare the order's `price.amount` and `billing_period` with the quote yourself; a difference the CLI did
   not catch: `curviate mailbox purchase cancel <id>` and report it. Never run `buy` twice. Report any notice
   (`SPENDING_CAP_NEAR`).
6. **The records**: the order prints six rows, `mx`, `spf`, `dkim`, `dmarc`, `verify` and `tracking` (not required); each
   row's `entries[]` are the records (`name`, `type`, `value`), and the `dkim` row ends with the domain's signing key,
   one TXT record of about 410 characters. Give them to the user to add exactly as shown where the domain's DNS is managed. Nothing is charged until the required ones
   are found. Curviate checks every 15 minutes for 2 hours, then every hour; `curviate mailbox purchase check <id>` looks
   now, once a minute at most. A row's `found` is only what the last check saw in DNS. A row not found can carry
   `advice` (another MX record, two SPF or two DMARC records), printed on stderr as served: pass it on. "Your domain's
   name servers did not answer Curviate's last check" is not a failure and nothing for the user to fix: the next check
   asks again. Never `check` in a loop for it.

### What an order waits for

Read it with `curviate mailbox purchase get <id> --json` (or `curviate mailbox purchase list`), once, or when the user
asks: never in a loop. While `awaiting_dns`, `waiting_for` says what it waits for, and the CLI prints what to tell the user on stderr:

| `waiting_for` | Means | The user's part |
|---|---|---|
| `records` | Not every required record is found yet. | Add them as shown before `expires_at`, or the order ends `expired`, nothing charged. |
| `payment` | The records are found; the charge waits for the Team's outstanding payment. | Update the payment method in Billing; the order continues by itself. Still outstanding at `expires_at`: it ends `payment_outstanding`, nothing charged. |
| `curviate` | The records are found; the order waits on Curviate's side. | Nothing. Not created by `expires_at`: it ends `held_by_curviate`, nothing charged. |
| `charge` | Being charged. | Nothing; read it again in a few minutes. A cancel now is refused. |

Then `provisioning` (charged, the Mailboxes being set up), `active` (they are in `mailbox list`), or `cancelled` with a
`reason`. Nothing was charged unless `charged_at` is set.

| `reason` | Tell the user |
|---|---|
| `requested` | Cancelled by an Owner or an agent. |
| `expired` | The records were not found within 14 days. They may order again. |
| `payment_outstanding` | The records were found, but the payment stayed outstanding for 14 days. Update the payment method in Billing, then order again. |
| `held_by_curviate` | Curviate could not create the Mailboxes within 14 days. They may order again. |
| `domain_taken` | Another order of Mailboxes from Curviate for this domain was confirmed first. Name another domain. |
| `host_failed` | Setting up failed and Curviate undid the charge in full. Nothing to retry. |
| `currency` | The subscription is billed in another currency than US dollars: contact support. |
| `subscription_ended`, `payment_failed`, `spending_cap_reached` | As named; read `billing` with an Owner. |

**The previous mail provider**: once the order's MX records are seen in place, `previous_provider_until` says until
about when some senders can keep delivering to the domain's previous mail provider (other mail servers keep the old MX
records for their TTL). While it is ahead and the order is not cancelled, tell the user, as the CLI's last stderr line
says: nothing is lost on Curviate's side; check the old mailbox until then. Null or past: say nothing.

None is a reason to retry on your own; an order again is a new quote and go. `charge_unknown: true`: say Curviate is
checking whether it was charged, and a charge made goes back in full; do not order again.
`curviate mailbox purchase cancel <id>` ends an order still waiting (free); exit `8` while it is being charged is neither a failure nor done: read it
again later and never repeat the cancel. No password of these Mailboxes ever reaches you.

**Refusals** are reported as they read and never worked around or retried:

| Code | Exit | Means |
|---|---|---|
| `MAILBOX_PURCHASE_TRIAL` | `11` | No paid plan, or a payment outstanding: the message says which and what to do. |
| `MAILBOX_PURCHASE_PENDING` | `8` | An order of the Team on this domain is still waiting: read it. |
| `DOMAIN_IN_USE` | `2` | The domain has Mailboxes from Curviate or a confirmed order, the Team's or another Team's: name another domain. |
| `DOMAIN_IS_COMPANY_EMAIL` | `2` | The domain the company email runs on: a separate domain. |
| `INVALID_REQUEST` | `2` | A subdomain, or a subscription in another currency; the message names it. |
| `MAILBOX_NO_ROOM` | `1` | No room for this many new Mailboxes now: order fewer, or later. Nothing was ordered or charged. |
| `MAILBOX_SALES_PAUSED` | `1` | Orders cannot be placed at the moment. |
| `SPENDING_CAP_REACHED`, `INSUFFICIENT_ROLE` | `5` | Past the cap (an Owner raises it in the dashboard), or not an Owner's key. |

**Removing one** is `curviate mailbox remove <mbx_id>` by an Owner: it is deleted with its mail, and its charge stops at
the end of the billing period. It waits for a go.
