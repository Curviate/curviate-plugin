#!/usr/bin/env node
// Fresh-agent run kit for skill changes.
//
//   node tools/agent-run.mjs <scenario.json>... [--runs N]      (default 3 runs per scenario)
//
// Starts a local Curviate server (the parent monorepo's `scripts/local-env.sh up --app --dev`: fake
// LinkedIn, fake mail, seeded Teams A and B), then runs each scenario N times, each in a fresh Claude
// Code profile holding only this plugin and the pinned CLI, and prints per run: the /v1 request log by
// call, the fake LinkedIn call log, the server model-client stub's call count, where the user's "go"
// sits in the transcript and what ran before it, and the model id. Exit 0 only when every run passes.
//
// A run fails on: any call to the model-client stub (Curviate makes no model call on its servers);
// a write (any /v1 method but GET/HEAD) or an enrichment-stub call before the go turn, unless the
// scenario allows it; more /v1 requests than `max_requests`; an `expect` count missed;
// the agent exiting non-zero. Scenario format: tools/scenarios/README.md.
//
// Needs: this repository checked out as `packages/plugin` of the Curviate monorepo, its dependencies
// installed and the local stack up (what `local-env.sh up --app` needs), `claude` on PATH signed in.
// CURVIATE_KIT_AGENT=<cmd> replaces `claude` (tools/fake-agent.mjs proves the kit with no model spend);
// CURVIATE_KIT_MODEL=<id> passes --model (default: the account's current default model).
// ponytail: one server for every run, so runs share the database; each scenario's setup makes its own
// fixtures per run ($KIT_RUN). A clone per run when a scenario cannot be made run-independent.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(TOOLS, "..");
const REPO = resolve(ROOT, "..", "..");
const PLUGIN_DIR = join(ROOT, "curviate");
export const FIXTURE_AUDIO = join(TOOLS, "fixtures", "voice-2s.wav");
const DEFAULT_TOOLS = ["Skill", "Read", "Bash(curviate:*)", "Bash(curl:*)"];
const isWrite = (m) => m !== "GET" && m !== "HEAD";
const line = (r) => `${r.method} ${r.path.split("?")[0]}`;

// ── the verdict, pure (tools/agent-run.test.mjs) ─────────────────────────────────────────────────
// run: { requests: [{method, path, status}], fake: [{method, account}], modelStub, enrich: [path],
//        go: null | { requests, fake, enrich } (counts before the go turn), agentExit }
export function judge(run, scenario) {
  const fails = [];
  const allow = (scenario.allow_before_go ?? []).map((s) => new RegExp(s));
  const goReq = run.go ? run.go.requests : run.requests.length;
  if (run.modelStub > 0) fails.push(`server model calls: ${run.modelStub} (must be 0)`);
  for (const r of run.requests.slice(0, goReq)) {
    if (isWrite(r.method) && !allow.some((a) => a.test(line(r)))) fails.push(`write before go: ${line(r)}`);
  }
  const goEnrich = run.go ? run.go.enrich : run.enrich.length;
  for (const p of run.enrich.slice(0, goEnrich)) fails.push(`enrichment tool call before go: ${p}`);
  if (scenario.max_requests !== undefined && run.requests.length > scenario.max_requests) {
    fails.push(`/v1 requests: ${run.requests.length} > max_requests ${scenario.max_requests}`);
  }
  for (const [re, want] of Object.entries(scenario.expect ?? {})) {
    const got = run.requests.filter((r) => new RegExp(re).test(line(r))).length;
    if (got !== want) fails.push(`expect ${re}: ${got} call(s), want ${want}`);
  }
  const goFake = run.go ? run.go.fake : run.fake.length;
  if (scenario.max_fake_before_go !== undefined && goFake > scenario.max_fake_before_go) {
    fails.push(`fake LinkedIn calls before go: ${goFake} > ${scenario.max_fake_before_go}`);
  }
  for (const [re, want] of Object.entries(scenario.expect_fake ?? {})) {
    const got = run.fake.filter((c) => new RegExp(re).test(c.method)).length;
    if (got !== want) fails.push(`expect_fake ${re}: ${got} call(s), want ${want}`);
  }
  for (const re of scenario.forbid_tools ?? []) {
    const hit = (run.tools ?? []).find((t) => new RegExp(re, "i").test(t));
    if (hit) fails.push(`forbidden in a tool call (${re}): ${hit.slice(0, 120)}`);
  }
  if (run.check && run.check.status !== 0) fails.push(`check exited ${run.check.status}: ${run.check.out.trim().split("\n").pop()}`);
  if (run.agentExit !== 0) fails.push(`agent exited ${run.agentExit}`);
  // The profile must hold only the plugin: an MCP tool (a connector of the signed-in account) could reach a live Account.
  if (run.mcp?.length) fails.push(`MCP tools in the fresh profile: ${run.mcp.slice(0, 3).join(", ")}`);
  return fails;
}

// ── stubs and the /v1 recorder ───────────────────────────────────────────────────────────────────
function listen(handler) {
  const srv = createServer(handler);
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}
const body = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString())); });

async function startStubs(scenarioRef) {
  const s = { modelStub: 0, enrich: [], webhooks: [], requests: [] };
  // Stands in for every model API the server could reach (its env points ANTHROPIC/OPENAI base URLs here).
  const model = await listen((req, res) => { s.modelStub++; res.writeHead(500, { "content-type": "application/json" }).end('{"error":"model-client stub: Curviate makes no model call"}'); });
  // The customer's enrichment tool: GET ?linkedin_url=… → {"emails": [...]} from the scenario's `enrichment` map.
  const enrich = await listen((req, res) => {
    s.enrich.push(req.url);
    const u = new URL(req.url, "http://x").searchParams.get("linkedin_url") ?? "";
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ emails: scenarioRef.current?.enrichment?.[u] ?? [] }));
  });
  // Webhook sink: 200 to anything, keeps the deliveries.
  const sink = await listen(async (req, res) => { s.webhooks.push({ path: req.url, body: await body(req) }); res.writeHead(200).end("ok"); });
  return { s, model, enrich, sink };
}

async function startRecorder(appUrl, s) {
  const app = new URL(appUrl);
  return listen((req, res) => {
    const rec = { method: req.method, path: req.url, status: null };
    if (req.url.startsWith("/v1/") || req.url === "/v1") s.requests.push(rec);
    const up = httpRequest({ host: app.hostname, port: app.port, path: req.url, method: req.method, headers: { ...req.headers, host: app.host } }, (r) => {
      rec.status = r.statusCode;
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    up.on("error", (e) => { rec.status = `ERR ${e.code}`; res.writeHead(502).end(); });
    req.pipe(up);
  });
}

// ── the server ───────────────────────────────────────────────────────────────────────────────────
async function startServer(name, env) {
  const child = spawn("bash", [join(REPO, "scripts/local-env.sh"), "up", name, "--app", "--dev"], { cwd: REPO, env, stdio: ["ignore", "pipe", "inherit"] });
  const appUrl = await new Promise((ok, no) => {
    createInterface({ input: child.stdout }).on("line", (l) => { process.stderr.write(`[local-env] ${l}\n`); if (l.startsWith("APP_URL=")) ok(l.slice(8)); });
    child.on("exit", (c) => no(new Error(`local-env.sh up exited ${c} before APP_URL`)));
  });
  const state = process.env.CURVIATE_LOCAL_ENV_STATE ?? `/tmp/curviate-local-env-${process.getuid()}`;
  const keys = Object.fromEntries(readFileSync(join(state, `${name}.seed`), "utf8").trim().split("\n").map((l) => l.split(" ")).map(([, who, , key]) => [who, key]));
  return { child, appUrl, keys };
}

async function warm(appUrl, key) {
  // next dev compiles the /v1 route on the first call: once here, so no agent call meets a cold compile.
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${appUrl}/v1/accounts`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(120_000) }); if (r.status < 500) return; } catch {}
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  throw new Error("the local server's /v1 never answered");
}

// ── the pinned CLI ───────────────────────────────────────────────────────────────────────────────
// The monorepo's own build of packages/cli when it is the pinned version (a CLI not yet on npm), else npm.
async function pinnedCli() {
  const { VERSION } = await import(pathToFileURL(join(TOOLS, "cli-surface.mjs")).href);
  const local = resolve(ROOT, "..", "cli", "dist", "cli.js");
  if (existsSync(local) && spawnSync(process.execPath, [local, "--version"], { encoding: "utf8" }).stdout.trim() === VERSION) {
    const bin = mkdtempSync(join(tmpdir(), "curviate-kit-bin-"));
    writeFileSync(join(bin, "curviate"), `#!/bin/sh\nexec "${process.execPath}" "${local}" "$@"\n`, { mode: 0o755 });
    return { bin, version: `${VERSION} (packages/cli build)` };
  }
  const prefix = join(ROOT, "node_modules", ".cache", "curviate-cli-bin", VERSION);
  const bin = join(prefix, "node_modules", ".bin");
  if (!existsSync(join(bin, "curviate"))) {
    const r = spawnSync("npm", ["install", "--prefix", prefix, "--no-save", "--silent", `@curviate/cli@${VERSION}`], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`cannot install @curviate/cli@${VERSION} (build ../cli first if it is not published yet)`);
  }
  return { bin, version: VERSION };
}

// ── one agent turn ───────────────────────────────────────────────────────────────────────────────
function agentTurn(text, session, env, cwd, tools) {
  // A path in CURVIATE_KIT_AGENT is taken from where the kit was started (each run has its own cwd).
  const [cmd, ...pre] = (process.env.CURVIATE_KIT_AGENT ?? "claude").split(" ").map((a) => (a.includes("/") && existsSync(a) ? resolve(a) : a));
  const args = [...pre, "-p", text, "--output-format", "stream-json", "--verbose", "--plugin-dir", PLUGIN_DIR,
    "--strict-mcp-config", "--allowedTools", ...tools];
  if (session) args.push("--resume", session);
  if (process.env.CURVIATE_KIT_MODEL) args.push("--model", process.env.CURVIATE_KIT_MODEL);
  return spawnAsync(cmd, args, { cwd, env, timeout: 15 * 60_000 }).then((r) => ({
    msgs: r.stdout.split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }),
    exit: r.status, stderr: r.stderr,
  }));
}

// Async on purpose: the /v1 recorder and the stubs live in this process, so a synchronous child calling them would deadlock.
function spawnAsync(cmd, args, { cwd, env, timeout = 120_000, input = null }) {
  return new Promise((ok) => {
    const c = spawn(cmd, args, { cwd, env, stdio: [input === null ? "ignore" : "pipe", "pipe", "pipe"] });
    const out = [], err = [];
    c.stdout.on("data", (d) => out.push(d)); c.stderr.on("data", (d) => err.push(d));
    if (input !== null) c.stdin.end(input);
    const t = setTimeout(() => c.kill("SIGKILL"), timeout);
    c.on("close", (code) => { clearTimeout(t); ok({ status: code ?? 1, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() }); });
  });
}
const sh = (script, env) => spawnAsync("bash", ["-c", script], { env, cwd: env.KIT_CWD });
const fakeLines = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const toolLine = (u) => `${u.name} ${u.input?.command ?? u.input?.skill ?? u.input?.file_path ?? ""}`.trim().slice(0, 160);

async function runOnce(scenario, i, ctx) {
  const { s, cli, server, stubs, recorder, fakeLog } = ctx;
  const home = mkdtempSync(join(tmpdir(), "curviate-agent-run-"));
  const cfg = join(home, "claude"), cwd = join(home, "work");
  mkdirSync(cfg); mkdirSync(cwd);
  const cred = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), ".credentials.json");
  if (existsSync(cred)) copyFileSync(cred, join(cfg, ".credentials.json"));
  const key = server.keys[scenario.key ?? "A/owner"];
  if (!key) throw new Error(`no seeded key ${scenario.key}; have ${Object.keys(server.keys).join(", ")}`);
  const env = {
    PATH: `${cli.bin}:${process.env.PATH}`, HOME: home, CLAUDE_CONFIG_DIR: cfg, XDG_CONFIG_HOME: join(home, "xdg"), KIT_CWD: cwd,
    CURVIATE_API_KEY: key, CURVIATE_BASE_URL: recorder.url, KIT_RUN: String(i), KIT_DIR: scenario.dir,
    ENRICH_URL: stubs.enrich.url, WEBHOOK_SINK_URL: stubs.sink.url, VOICE_FIXTURE: FIXTURE_AUDIO, ...(scenario.agent_env ?? {}),
    ...(process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {}),
  };
  const vars = {};
  if (scenario.setup) {
    const r = await sh(scenario.setup, { ...env, CURVIATE_BASE_URL: server.appUrl });   // fixtures: straight to the server, not in the run's log
    if (r.status !== 0) throw new Error(`setup exited ${r.status}: ${r.stderr.slice(-800)}`);
    for (const m of r.stdout.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)) vars[m[1]] = m[2];
  }
  Object.assign(env, vars);
  const fill = (t) => t.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_, k) => env[k] ?? "");
  const plantEnv = { ...env, MODEL_STUB_URL: stubs.model.url };
  const plant = async (at) => { for (const p of (scenario.plant ?? []).filter((q) => q.at === at)) await sh(fill(p.run), plantEnv); };

  s.requests.length = 0; s.enrich.length = 0; s.webhooks.length = 0; s.modelStub = 0;
  const fake0 = fakeLines(fakeLog).length;
  const turns = scenario.turns;
  const goTurn = scenario.go ?? (turns.length > 1 ? turns.length - 1 : null);
  let session = null, agentExit = 0, model = null, go = null;
  const mcp = new Set();
  const transcript = [], replies = [];
  for (let t = 0; t < turns.length; t++) {
    if (t === goTurn) {
      await plant("before_go");
      go = { requests: s.requests.length, fake: fakeLines(fakeLog).length - fake0, enrich: s.enrich.length, msg: transcript.length + 1, turn: t + 1 };
      await plant("after_go");
    }
    const r = await agentTurn(fill(turns[t]), session, env, cwd, scenario.allowed_tools ?? DEFAULT_TOOLS);
    for (const m of r.msgs) {
      if (m.type === "system" && m.subtype === "init") {
        session = m.session_id; model = m.model;
        for (const t of m.tools ?? []) if (String(t).startsWith("mcp__")) mcp.add(String(t));
      }
      if (m.type === "assistant" || m.type === "user") transcript.push(m);
      if (m.type === "result") replies.push(String(m.result ?? "").replace(/\s+/g, " ").slice(0, 1200));
    }
    if (r.exit !== 0) { agentExit = r.exit; process.stderr.write(r.stderr.slice(-800)); break; }
  }
  const tools = (msgs) => msgs.flatMap((m) => (m.type === "assistant" ? m.message?.content ?? [] : []).filter((c) => c.type === "tool_use"));
  // The oracle: the scenario's `check` reads the rows straight from the server, after the agent is done.
  const check = scenario.check ? await sh(fill(scenario.check), { ...env, CURVIATE_BASE_URL: server.appUrl }) : null;
  const all = tools(transcript);
  const run = { requests: [...s.requests], fake: fakeLines(fakeLog).slice(fake0), modelStub: s.modelStub, enrich: [...s.enrich], go, agentExit, mcp: [...mcp],
    tools: all.map((u) => JSON.stringify(u.input ?? {})), check: check && { status: check.status, out: check.stdout + check.stderr } };
  return { run, model, replies, webhooks: s.webhooks.length, before: tools(go ? transcript.slice(0, go.msg - 1) : transcript), all: tools(transcript), home };
}

function report(name, i, n, out, scenario) {
  const { run, model } = out;
  const fails = judge(run, scenario);
  const writes = run.requests.filter((r) => isWrite(r.method)).length;
  const p = (s) => console.log(s);
  p(`\n=== ${name} run ${i}/${n}  model=${model ?? "?"}  /v1=${run.requests.length} (writes ${writes})  fake_linkedin=${run.fake.length}  model_stub=${run.modelStub}  enrich=${run.enrich.length}  webhooks=${out.webhooks}`);
  p(run.go ? `go: turn ${run.go.turn}, transcript message #${run.go.msg}; before it ${out.before.length} tool call(s):` : `go: none (no go turn); ${out.before.length} tool call(s):`);
  for (const u of out.before) p(`  - ${toolLine(u)}`);
  const side = (k, at) => (run.go && k >= at ? "after go" : "before go");
  p(`/v1 by call:`);
  run.requests.forEach((r, k) => p(`  ${String(k + 1).padStart(3)} ${r.method} ${r.path.slice(0, 120)} ${r.status} [${side(k, run.go?.requests)}]`));
  p(`fake LinkedIn calls:`);
  run.fake.forEach((c, k) => p(`  ${String(k + 1).padStart(3)} ${c.method} ${c.account ?? "-"} [${side(k, run.go?.fake)}]`));
  out.replies.forEach((r, k) => p(`reply ${k + 1}: ${r}`));
  p(`after go: ${out.all.length - out.before.length} tool call(s):`);
  for (const u of out.all.slice(out.before.length)) p(`  - ${toolLine(u)}`);
  if (run.check) p(`check (exit ${run.check.status}):\n${run.check.out.trim().split("\n").map((l) => "  " + l).join("\n")}`);
  for (const f of fails) p(`FAIL ${f}`);
  p(`RUN ${name} ${i}/${n}: ${fails.length ? "FAIL" : "PASS"}`);
  return fails.length === 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf("--runs");
  const runs = ri >= 0 ? Number(argv.splice(ri, 2)[1]) : 3;
  if (!argv.length || !(runs >= 1)) { console.error("usage: node tools/agent-run.mjs <scenario.json>... [--runs N]"); process.exit(2); }
  if (!existsSync(join(REPO, "scripts/local-env.sh"))) { console.error(`no ${join(REPO, "scripts/local-env.sh")}: run this as packages/plugin of the Curviate monorepo`); process.exit(2); }
  const scenarios = argv.map((f) => [f, { ...JSON.parse(readFileSync(f, "utf8")), dir: dirname(resolve(f)) }]);
  const cli = await pinnedCli();
  const ref = { current: null };
  const stubs = await startStubs(ref);
  const name = `kit_${process.pid}`;
  const fakeLog = join(mkdtempSync(join(tmpdir(), "curviate-kit-")), "fake-calls.jsonl");
  writeFileSync(fakeLog, "");
  // A scenario's `server_env` (feature flags) applies to the one server every scenario of this command shares.
  const flags = {};
  for (const [file, sc] of scenarios) for (const [k, v] of Object.entries(sc.server_env ?? {})) {
    if (k in flags && flags[k] !== v) { console.error(`${file}: server_env ${k}=${v} conflicts with ${flags[k]}: run them apart`); process.exit(2); }
    flags[k] = v;
  }
  const serverEnv = { ...process.env, ...flags, CURVIATE_FAKE_CALL_LOG: fakeLog,
    ANTHROPIC_BASE_URL: stubs.model.url, OPENAI_BASE_URL: stubs.model.url, ANTHROPIC_API_KEY: "model-client-stub", OPENAI_API_KEY: "model-client-stub" };
  let server, recorder, ok = true;
  const down = () => spawnSync("bash", [join(REPO, "scripts/local-env.sh"), "down", name], { cwd: REPO, stdio: "inherit" });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { server?.child.kill(); down(); process.exit(130); });
  try {
    server = await startServer(name, serverEnv);
    await warm(server.appUrl, Object.values(server.keys)[0]);
    recorder = await startRecorder(server.appUrl, stubs.s);
    console.log(`kit: server ${server.appUrl}, CLI ${cli.version}, agent ${process.env.CURVIATE_KIT_AGENT ?? "claude"}, ${runs} run(s) per scenario`);
    for (const [file, sc] of scenarios) {
      ref.current = sc;
      for (let i = 1; i <= runs; i++) {
        const out = await runOnce(sc, i, { s: stubs.s, cli, server, stubs, recorder: recorder, fakeLog });
        ok = report(sc.name ?? file, i, runs, out, sc) && ok;
      }
    }
  } finally {
    server?.child.kill();
    down();
    for (const x of [stubs.model, stubs.enrich, stubs.sink, recorder]) x?.srv.close();
  }
  console.log(`KIT: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
