# Team A at its spending cap: the cap set to the seats it holds, on the per-run clone (no command sets a cap; the
# dashboard does). Nothing reaches the payment processor: a refused add stops before it.
source "$KIT_DIR/setup/lib.sh"
T=$(curviate team get --json | j d.id)
psql -q "$KIT_DB_URL" -v t="$T" <<'SQL' >/dev/null
UPDATE public.tenants t SET spending_cap_seats = GREATEST(1, (SELECT count(*) FROM public.seats s WHERE s.tenant_id = t.id AND NOT s.is_trial
  AND s.lent_from_seat_id IS NULL AND s.cancellation_source IS DISTINCT FROM 'seat_decrement')) WHERE t.id = :'t';
SQL
echo "ROOM=$(curviate billing cap --json | j d.room_seats)"
