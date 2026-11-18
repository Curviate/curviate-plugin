#!/usr/bin/env node
// Stands in for `claude -p … --output-format stream-json` so the kit can be proved with no model spend:
// CURVIATE_KIT_AGENT="node tools/fake-agent.mjs". One stream-json turn: init (model "fake-agent"), one
// tool call naming the prompt, the result. It calls nothing; a scenario's `plant` steps make the calls.
import { randomUUID } from "node:crypto";
const a = process.argv.slice(2);
const prompt = a[a.indexOf("-p") + 1];
const session = a.includes("--resume") ? a[a.indexOf("--resume") + 1] : randomUUID();
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
out({ type: "system", subtype: "init", session_id: session, model: "fake-agent" });
out({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: `echo ${JSON.stringify(prompt)}` } }] } });
out({ type: "user", message: { content: [{ type: "tool_result", content: prompt }] } });
out({ type: "result", subtype: "success", result: `fake agent read: ${prompt}`, session_id: session });
