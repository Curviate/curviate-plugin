---
name: curviate-email-tools
description: "Hand Leads to an external email tool and take its answers back, with the Curviate CLI and a Recipe: an outgoing webhook, an incoming event, a Campaign fragment, a one-Lead test. Use when asked to send the email part through Instantly, Smartlead or another tool, or to have that tool tell Curviate when someone replies."
---

# Curviate: external email tools through Recipes

Curviate hands a Lead to the user's email tool through a webhook and hears back through an incoming event; there is no
native integration and Curviate calls nothing in the tool beyond the webhook the user configures. A **Recipe** is the
tested set of three pieces for one tool: the webhook (with its body template), the incoming event (where the tool's post
names the event and the Lead), and the Sequence fragment that emits and awaits them. Recipes exist for Instantly and
Smartlead; any tool that takes a webhook and posts back works the same way, with the pieces adapted. Setup and exit
codes: `curviate`; Campaigns: `curviate-campaigns`; webhook sources: `curviate-inbox`.

Established against CLI `0.58.0`, on a local server with a fake LinkedIn.

## Two gos

This flow asks the user twice, and each answer covers only its own question. **The setup go** (step 2) lets you create the
pieces: until it arrives you only read. **The start go** (step 7) starts the Campaign: ask it on its own, after the test
result, naming the Campaign. A request to set the tool up is not a go, and a go given for the setup never starts the
Campaign.

## Before you start

- **One email sender per Lead.** A Lead in a Campaign with its own email step and also handed to the tool gets two
  emails. Ask the user which one sends email to these Leads, and build only that one.
- **The tool's key stays with the person.** It goes into the webhook's header either by the person in the dashboard
  (Settings, Webhooks) or from an environment variable the person set in their own shell, referenced by name. You never
  ask for it, print it, or write it into a file.
- **The incoming URL is a password.** It prints once; hand it to the person for the tool, and keep it out of anything
  you show or store.
- **Replies stay in Curviate.** The webhook carries Lead fields, never reply text.

## Steps

1. **Read the tool's Recipe** at <https://docs.curviate.com/reference/webhooks/recipes>: its `webhook` (source, events,
   custom event names, URL, headers, body template), its `incoming_event` and its `sequence`. Done when you can name each
   piece's values for this user (their tool campaign id, the event names).
2. **Show the plan and ask for the setup go.** Show the user the three pieces, the Campaign they go into, and the tool URL;
   say the webhook will send Lead data to the tool. Steps 1 and 2 only read. Done on the user's go for the setup.
3. **Webhook out.** Lint the body template, then create it:

   ```bash
   curviate webhook lint --source campaign --template-file body.json
   curviate webhook create --source campaign --events campaign.custom_event --custom-events start_email_sequence --campaign-ids <campaign_id> --request-url <tool_url> --template-file body.json --json
   ```

   The header with the key follows the first bullet above. Done when `curviate webhook get <webhook_id>` reads it enabled.
4. **Incoming event back.** `curviate incoming create --event-name-field <field> --match-email <path> --campaign <campaign_id> --json`
   with the Recipe's fields. It starts disabled. Run `curviate incoming capture <incoming_id>`, the tool posts once (its own
   test, by the person), then `curviate incoming get <incoming_id>` reads `sample_state: captured`; then
   `curviate incoming update <incoming_id> --enabled`. Done when it reads enabled with a captured sample.
5. **Campaign fragment.** Put the Recipe's steps into the Campaign's Sequence file, then
   `curviate campaign lint --file campaign.json` until exit `0` and `curviate campaign update <campaign_id> --file campaign.json`.
   Done on lint exit `0` and the update read back with `campaign get`.
6. **Test with one Lead.** `curviate webhook test <webhook_id> --event campaign.custom_event`, then one
   `curviate webhook deliveries <webhook_id>`. Done when the delivery reads delivered and the person sees the Lead in
   the tool. A failed delivery: report its response code or error once and stop there; the tool's URL or key is the
   person's to fix, then `curviate webhook redeliver` sends it again. Reading the deliveries again changes nothing.
7. **Ask for the start go.** Report the test result, then ask whether to start the Campaign, as `curviate-campaigns`
   says. Done when the user answers this question: start on a go, leave it a draft otherwise.

A bounce the tool reports arrives as an incoming event and is saved there; it does not mark the Lead.

## Done

One test Lead reached the tool through the webhook, the tool's post reached Curviate as a captured and enabled incoming
event, and the Campaign lints clean, waiting for the user's go.
