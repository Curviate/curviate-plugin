// The kit's verdict: each row is one run's logs and the reasons it must fail with ([] = pass).
// The end-to-end proof on a running server: tools/scenarios/README.md, the controls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { judge } from "./agent-run.mjs";

const GET = { method: "GET", path: "/v1/accounts", status: 200 };
const POST = { method: "POST", path: "/v1/webhooks?x=1", status: 201 };
const run = (o) => ({ requests: [GET], fake: [], modelStub: 0, enrich: [], go: { requests: 1, fake: 0, enrich: 0 }, agentExit: 0, ...o });

const rows = [
  ["clean run", run({}), {}, []],
  ["planted model call", run({ modelStub: 1 }), {}, ["server model calls: 1 (must be 0)"]],
  ["write before go", run({ requests: [POST, GET], go: { requests: 2, enrich: 0 } }), {}, ["write before go: POST /v1/webhooks"]],
  ["same write after go", run({ requests: [GET, POST] }), {}, []],
  ["no go turn: every write is before it", run({ requests: [POST], go: null }), {}, ["write before go: POST /v1/webhooks"]],
  ["allowed write before go", run({ requests: [POST], go: { requests: 1, enrich: 0 } }), { allow_before_go: ["^POST /v1/webhooks$"] }, []],
  ["enrichment call before go", run({ enrich: ["/?linkedin_url=a"], go: { requests: 1, enrich: 1 } }), {}, ["enrichment tool call before go: /?linkedin_url=a"]],
  ["enrichment call after go", run({ enrich: ["/?linkedin_url=a"] }), {}, []],
  ["over the request ceiling", run({ requests: [GET, GET] }), { max_requests: 1 }, ["/v1 requests: 2 > max_requests 1"]],
  ["expect count missed", run({}), { expect: { "^POST /v1/webhooks$": 1 } }, ["expect ^POST /v1/webhooks$: 0 call(s), want 1"]],
  ["agent failed", run({ agentExit: 1 }), {}, ["agent exited 1"]],
  ["a LinkedIn call before go over the ceiling", run({ fake: [{ method: "getUserProfile" }], go: { requests: 1, fake: 1, enrich: 0 } }), { max_fake_before_go: 0 }, ["fake LinkedIn calls before go: 1 > 0"]],
  ["the same LinkedIn call after go", run({ fake: [{ method: "getUserProfile" }] }), { max_fake_before_go: 0 }, []],
  ["expect_fake count missed", run({}), { expect_fake: { "^sendMessage$": 1 } }, ["expect_fake ^sendMessage$: 0 call(s), want 1"]],
];

for (const [name, r, scenario, want] of rows) test(name, () => assert.deepEqual(judge(r, scenario), want));

test("an MCP tool in the fresh profile fails the run", () =>
  assert.deepEqual(judge(run({ mcp: ["mcp__x__send_message"] }), {}), ["MCP tools in the fresh profile: mcp__x__send_message"]));
