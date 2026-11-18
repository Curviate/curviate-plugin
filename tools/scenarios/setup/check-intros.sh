# Oracle: the target carries the intro-asked Tag.
source "$KIT_DIR/setup/lib.sh"
out=$(curviate lead get "$LEAD_ID" --json | j 'JSON.stringify(d.tags)'); echo "tags: $out"; grep -qi 'intro-asked' <<<"$out"
