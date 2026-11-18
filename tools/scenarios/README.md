# Fresh-agent scenarios

One JSON file per scenario; a skill ticket adds its own. Run with the kit, three runs each by default:

```bash
node tools/agent-run.mjs tools/scenarios/<file>.json [more.json] [--runs N]
```

Every run starts a fresh Claude Code profile with only this plugin and the pinned CLI, against a local
Curviate server on fake LinkedIn and fake mail, seeded with Teams A and B. The last line is `KIT: PASS`
or `KIT: FAIL`; each run ends with `RUN <name> i/n: PASS|FAIL` and its `FAIL` reasons.

| Key | Meaning |
|---|---|
| `name` | Printed on each run. |
| `turns` | The user's messages, in order. `${VAR}` takes a value from `setup` or the run's environment. |
| `go` | Index (from 0) of the turn that gives the go. Default: the last turn when there are two or more, none for one turn. Every write before it fails the run. |
| `setup` | Bash run before the agent, straight to the server (not in the run's request log). `curviate` is the pinned CLI on the scenario's key. Lines it prints as `NAME=value` become `${NAME}`. `$KIT_RUN` is the run number: make fixtures per run, the runs share one database. |
| `key` | Seeded person whose API key the agent gets, `<team>/<role>`. Default `A/owner`. |
| `allow_before_go` | Regexes over `METHOD /v1/path` (no query) of writes that may come before the go, such as a read sent as POST. |
| `max_requests` | Ceiling on the run's `/v1` requests. |
| `max_fake_before_go` | Ceiling on fake LinkedIn calls before the go (0 for a skill that must not reach LinkedIn before it). |
| `expect_fake` | `{ "<regex over the fake method name>": count }`, exact counts over the whole run. |
| `server_env` | Variables for the server, such as a feature flag `on`. Every scenario of one command shares one server: conflicting values are refused. |
| `expect` | `{ "<regex over METHOD /v1/path>": count }`, exact counts over the whole run. |
| `enrichment` | `{ "<LinkedIn URL>": ["address", ...] }` the enrichment stub answers. |
| `plant` | `[{ "at": "before_go" or "after_go", "run": "<bash>" }]`: calls the kit makes itself at the go, through the request log. Used by the controls. |
| `forbid_tools` | Regexes (any case) none of the agent's tool calls may match, such as a secret's value or a flag the skill must never compose. |
| `check` | Bash run after the last turn, straight to the server: the oracle that reads the rows back (`curviate` on the scenario's key). Non-zero fails the run; its output is printed. |
| `agent_env` | Extra variables in the agent's environment, such as a stand-in for a tool's key the person set in their shell. |
| `allowed_tools` | The agent's tools. Default `Skill`, `Read`, `Bash(curviate:*)`, `Bash(curl:*)`. |

The agent's environment holds `ENRICH_URL` (the enrichment stub: `GET $ENRICH_URL/?linkedin_url=…` answers
`{"emails": [...]}`), `WEBHOOK_SINK_URL` (answers 200, counted per run) and `VOICE_FIXTURE` (a 2-second WAV,
`tools/fixtures/voice-2s.wav`). A turn names them to the agent where the scenario needs them.

The agent runs the pinned CLI: the monorepo's own `packages/cli` build when its version is the pin (a CLI not on npm
yet; build it first), else the published package. Its profile holds only this plugin: an MCP tool in it fails the run, so
a connector of the signed-in account can never reach a live Account.

A run fails on a server model call (the stub behind the server's model API URLs is called), a write or an
enrichment call before the go, `max_requests` exceeded, an `expect` count missed, or the agent exiting non-zero.

`controls/` proves the kit can fail, with no model spend:

```bash
CURVIATE_KIT_AGENT="node tools/fake-agent.mjs" node tools/agent-run.mjs tools/scenarios/controls/*.json --runs 1
# model-call: FAIL (model stub 1) · write-before-go: FAIL (write before go) · write-after-go: PASS · fake-linkedin: FAIL (LinkedIn call before go)
```
