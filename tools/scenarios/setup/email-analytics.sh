# SPL-29: a connected Mailbox sending for Team A's first Account, and a Campaign's email figures written to the per-run
# clone's rollup (no command makes sends on the fake transport): 40 first emails 10 days ago (12 human opens, 4 email
# replies) and 30 two days ago, so the reply rate is still maturing (30 of 70 recent) and 70 sent clear the bounce floor.
source "$KIT_DIR/setup/lib.sh"
[ -n "$KIT_DB_URL" ] || { echo "no KIT_DB_URL" >&2; exit 1; }
T=$(curviate team get --json | j "d.team_id ?? d.id"); A=$(acc 0); M="mbx_kit$(tag)"
EMAIL_STEP=1 bash "$KIT_DIR/setup/campaign-email.sh" > ce.out; C=$(sed -n 's/^CAMPAIGN_ID=//p' ce.out)
psql -qtA "$KIT_DB_URL" -v t="$T" -v a="$A" -v c="$C" -v m="$M" >/dev/null <<'SQL'
INSERT INTO public.mailboxes (id, tenant_id, address, connection, state, sends_for_account_id)
VALUES (:'m', :'t', :'m' || '@kit-mail.test', 'imap_smtp', 'connected', :'a');
INSERT INTO public.email_rollup (tenant_id, hour, mailbox_id, account_id, campaign_id, step_id, provider, never_accepted, sent, tracked_sent, first_emailed, opens_human, first_replied_by_channel)
VALUES (:'t', date_trunc('hour', now() - interval '10 days'), :'m', :'a', :'c', 'mail', 'gmail', false, 40, 40, 40, 12, '{"email": 4}'),
       (:'t', date_trunc('hour', now() - interval '2 days'), :'m', :'a', :'c', 'mail', 'gmail', false, 30, 30, 30, 0, '{}');
SQL
echo "CAMPAIGN_ID=$C"
