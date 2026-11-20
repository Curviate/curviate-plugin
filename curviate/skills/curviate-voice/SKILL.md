---
name: curviate-voice
description: "Voice notes in a Campaign with the Curviate CLI: a clip in the Account's own voice, recorded or cloned in the user's own voice tool, uploaded once and played by a voice note step with a text fallback. Use when asked for a voice note step, a voice note in my voice, or a cloned voice in outreach."
---

# Curviate: voice notes in a Campaign

A **voice note step** (`voice.send`) sends a recorded voice message instead of text, to a first-degree Connection, from
the same Message budget as `message.send`. It plays a **Voice clip** uploaded once; the Sequence holds only the clip's id.
The audio comes from the user's side: their own recording, or a clone made in their own voice tool with their own key.
Curviate stores the finished audio and nothing else: no voice model, no consent record. Building the Campaign around the
step: `curviate-campaigns`. One voice note to one person by hand: `curviate-inbox`.

Checked against CLI `0.65.0`, on a local server with a fake LinkedIn.

## Whose voice

A clip speaks as the Account's own person, so it is that person's voice, with their consent. The Campaign's sending
Accounts are in `curviate campaign get <campaign_id>` and their names in `curviate account list --json`, both store reads
(an Account's detail read asks LinkedIn: leave it for later). Ask whose voice it is and whether that person agreed, and wait
for the answer in this conversation. Done when the user confirms it is the Account's own person and that they consent.

A request for anyone else's voice (a colleague, a founder, a public figure) without that person here consenting is
declined: say that a voice note speaks as the person, so only the Account's own person, with their consent, can be the
voice. Offer a text message step or that person recording their own clip instead.

Tell the user once, before the first upload: rules on synthetic media may apply where the Lead lives.

## Steps

1. **Make the audio** in the user's own tool or recorder. One file per clip, inside the limits that
   `curviate campaign voice-clip upload --help` names (formats, length, size). A clip is never shortened: cut it to length
   first. Done when the file exists and its length is inside the limits.
2. **Show and ask.** Tell the user the file, its length, and the Campaign it goes into. Done on a go: an upload counts
   toward the Team's daily upload limit and a retry stores a second clip.
3. **Upload.** `curviate campaign voice-clip upload <file> --json` prints `id` (`vc_...`) and `duration_ms`. Done when
   `curviate campaign voice-clip get <id> --json` reads the same `duration_ms`.
4. **The step.** Put the id in a `voice.send` step with a fallback that has no variables; the fallback is sent as text when
   the audio cannot go. The id below is the shape, not a real clip:

```json
{ "on_reply": "end", "steps": [ { "id": "voice", "do": "voice.send", "next": "end",
  "with": { "clip_id": "vc_01J8Z3K9P0Q1R2S3T4V5W6X7Y8", "fallback": "Hi, glad we are connected. How do you handle outreach today?" } } ] }
```

   A/B: `variants` of `{id, clip_id}` in place of `with.clip_id`, one shared `with.fallback`; no `text`, no variable, no
   mix of a text arm and a clip arm. Save it with `curviate campaign update <campaign_id> --file <file>` (or `create` for a
   new draft). Done when `curviate campaign lint --file <file>` exits `0`.
5. **Preview.** `curviate campaign preview <campaign_id> --json` shows each variant's `clip_id` and `clip_duration_ms`
   (null: no such clip in this Team) and the fallback. Done when the preview's duration equals the clip's.
6. **Start** only on a go, as `curviate-campaigns` says: show the duration, the fallback, who enrolls and from which
   Accounts first.

One clip serves any number of Leads, steps and Campaigns. The Sequence holds one clip per step (or one per variant), so
every Lead hears the same recording: a clip per Lead is out of reach, and a loop of single voice notes over a list reads as
automation. Many people over time go through the Campaign, which paces itself.

## Refusals

| Refused | Code | Exit | Do |
|---|---|---|---|
| Not audio, empty, undecodable, or outside the length limits | `VOICE_CLIP_INVALID` | `2` | The message names the reason and the limit. Fix the file; nothing was stored. |
| Over the size limit | `PAYLOAD_TOO_LARGE` | `2` | Cut or compress the audio. |
| The Team's daily upload limit reached | `RATE_LIMIT_TENANT` | `6` | Wait the `Retry-After`; reuse a clip meanwhile. |
| `clip_id` malformed, or not a clip of your Team | `SEQUENCE_INVALID` (`R13`) | `2` | Upload it on this Team, then use the id it prints. |
| No `fallback` | `SEQUENCE_INVALID` (`R19`) | `2` | Add a variable-free fallback. |

Voice goes only in Campaigns to Connections: not in a group, InMail or a company chat. An unused clip is deleted after 30
days. The step shows as "Voice note" in analytics and counts as a message.
