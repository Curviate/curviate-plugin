# The label on the seeded reply was corrected by a person (source user) to opt_out or not_interested.
source "$KIT_DIR/setup/lib.sh"
h=$(curviate unibox label "$MESSAGE_ID" --json)
echo "$h" | j '[d.current.label, d.current.source, d.history.length]'
[ "$(echo "$h" | j 'd.current.source')" = user ] && echo "$h" | j 'd.current.label' | grep -qE '^(opt_out|not_interested)$'
