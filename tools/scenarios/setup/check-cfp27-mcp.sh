# Oracle: through the MCP endpoint, get_campaign pages the preview of the 47-Lead Campaign by cursor: 47 distinct Leads,
# the last page without a next_cursor. JSON-RPC over HTTP with the scenario's key, straight to the server.
source "$KIT_DIR/setup/lib.sh"
node --input-type=module -e '
const url = process.env.CURVIATE_BASE_URL.replace(/\/+$/, "") + "/mcp", key = process.env.CURVIATE_API_KEY, id = process.env.CAMPAIGN_ID;
let session = null, n = 0;
async function rpc(method, params) {
  const headers = { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (session) headers["mcp-session-id"] = session;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) });
  session = r.headers.get("mcp-session-id") ?? session;
  const text = await r.text();
  const json = text.startsWith("{") ? text : text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).pop();
  const m = JSON.parse(json);
  if (m.error) throw new Error(`${method}: ${JSON.stringify(m.error)}`);
  return m.result;
}
await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "kit", version: "1" } });
const seen = new Set(); let cursor, pages = 0, last;
do {
  const res = await rpc("tools/call", { name: "get_campaign", arguments: { campaign_id: id, limit: 20, ...(cursor ? { cursor } : {}) } });
  const body = res.structuredContent ?? JSON.parse(res.content[0].text);
  if (res.isError) throw new Error(JSON.stringify(body));
  const p = body.preview; pages++; last = p;
  for (const s of p.samples ?? []) seen.add(s.lead_id ?? s.lead?.id ?? JSON.stringify(s.lead ?? s).slice(0, 80));
  cursor = p.next_cursor;
} while (cursor && pages < 10);
console.log(`MCP get_campaign: ${pages} page(s), ${seen.size} distinct Leads, last next_cursor ${JSON.stringify(last.next_cursor ?? null)}`);
process.exit(seen.size === 47 && !last.next_cursor ? 0 : 1);
'
