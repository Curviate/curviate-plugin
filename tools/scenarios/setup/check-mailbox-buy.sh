# The one order exists for this run's domain, waiting for its records, with the two Mailboxes asked for.
source "$KIT_DIR/setup/lib.sh"
o=$(curviate mailbox purchase list --json | j "d.data.filter(o => o.domain === '$DOMAIN').map(o => [o.state, o.mailboxes.length])")
echo "$o"
[ "$o" = '[["awaiting_dns",2]]' ] || exit 1
if [ -n "${PERIOD:-}" ]; then
  # Its price is the quote the go named: the period asked for, the amount quoted before the order (rulings on qa F1).
  p=$(curviate mailbox purchase list --json | j "d.data.filter(o => o.domain === '$DOMAIN').map(o => [o.price.billing_period, o.price.amount, o.price.charged])")
  echo "$p"
  [ "$p" = "[[\"$PERIOD\",$AMOUNT,\"${CHARGED}\"]]" ]
fi
