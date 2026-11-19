# The conversation shows the email the agent sent (when the Mailbox took it) or none; never two.
source "$KIT_DIR/setup/lib.sh"
n=$(curviate unibox conversation timeline "$CONVERSATION_ID" --channel email --json | j 'd.items.filter(i=>i.is_sender && i.origin!==null).length')
echo "sent from the Unibox: $n"
[ "$n" -le 1 ]
