# The one order exists for this run's domain, waiting for its records, with the two Mailboxes asked for.
source "$KIT_DIR/setup/lib.sh"
o=$(curviate mailbox purchase list --json | j "d.data.filter(o => o.domain === '$DOMAIN').map(o => [o.state, o.mailboxes.length])")
echo "$o"
[ "$o" = '[["awaiting_dns",2]]' ]
