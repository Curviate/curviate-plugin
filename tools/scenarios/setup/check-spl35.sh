# Emails sent from the Unibox in the conversation (not the Campaign's): at most the one the go allowed, never two.
source "$KIT_DIR/setup/lib.sh"
n=$(curviate unibox conversation timeline "$CONVERSATION_ID" --channel email --json | j 'd.items.filter(i=>i.is_sender && (i.origin==="unibox"||i.origin==="api")).length')
echo "sent from the Unibox: $n"
[ "$n" -le 1 ]
