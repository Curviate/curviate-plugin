# Oracle: still a draft; its Sequence holds a voice.send step with a clip and a fallback; the preview's clip duration
# equals the stored clip's.
source "$KIT_DIR/setup/lib.sh"
c=$(curviate campaign get "$CAMPAIGN_ID" --json)
out=$(j '(() => { const st = (d.sequence?.steps ?? []).find((x) => x.do === "voice.send"); return [d.status, Boolean(st && (st.with?.clip_id || st.variants?.length) && st.with?.fallback), st?.with?.clip_id ?? st?.variants?.[0]?.clip_id ?? ""].join(" "); })()' <<<"$c")
echo "status, voice step with clip and fallback, clip: $out"
set -- $out; [ "$1 $2" = "draft true" ] || exit 1
clip=$(curviate campaign voice-clip get "$3" --json | j d.duration_ms)
prev=$(curviate campaign preview "$CAMPAIGN_ID" --json | j 'JSON.stringify(d).match(/"clip_duration_ms":(\d+)/)?.[1] ?? "none"')
echo "clip duration_ms $clip, preview clip_duration_ms $prev"; [ "$clip" = "$prev" ]
