# 10 Leads in a fresh list, 3 without an address; a draft Campaign from Team A's first Account.
# EMAIL_STEP=1: the draft already holds an email step (else a LinkedIn-only Sequence the agent extends).
source "$KIT_DIR/setup/lib.sh"
t=$(tag); L=$(curviate lead lists create "Email list $t" --json | j d.id); A=$(acc 0)
rows=(); for i in 1 2 3 4 5 6 7 8 9 10; do e="lead$i.$t@example.test"; [ "$i" -gt 7 ] && e=""
  rows+=("https://www.linkedin.com/in/$t-lead-$i,Lee$i,Kit,Acme $i,Founder,Berlin,$e"); done
leads "$L" "${rows[@]}"
if [ "${EMAIL_STEP:-0}" = 1 ]; then
  step='{ "id": "mail", "do": "email.send", "next": "end", "with": { "subject": "Quick question", "text": "Hi {{first_name|there}}, how do you handle outreach today?", "opt_out": "link" } }'
else
  step='{ "id": "invite", "do": "invite.send", "next": "end" }'
fi
cat > campaign.json <<JSON
{ "name": "Kit $t", "lead_list_ids": ["$L"], "account_ids": ["$A"], "sequence": { "on_reply": "end", "steps": [ $step ] } }
JSON
C=$(curviate campaign create --file campaign.json --json | j d.id)
echo "LIST_ID=$L"; echo "CAMPAIGN_ID=$C"; echo "ACCOUNT_ID=$A"
