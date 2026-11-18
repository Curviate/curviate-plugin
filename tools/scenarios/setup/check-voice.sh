# Oracle: still a draft, and its Sequence holds a voice.send step with a clip id and a fallback.
source "$KIT_DIR/setup/lib.sh"
out=$(curviate campaign get "$CAMPAIGN_ID" --json | j '(() => { const st = (d.sequence?.steps ?? []).find((x) => x.do === "voice.send"); return [d.status, Boolean(st && (st.with?.clip_id || st.variants?.length) && st.with?.fallback)].join(" "); })()')
echo "status, voice step with clip and fallback: $out"; [ "$out" = "draft true" ]
