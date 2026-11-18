# Oracle: the target carries the intro-asked Tag.
source "$KIT_DIR/setup/lib.sh"
curviate lead get "$LEAD_ID" --json | j 'JSON.stringify(d.tags)' | tee /dev/stderr | grep -qi 'intro-asked'
