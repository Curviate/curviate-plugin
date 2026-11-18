# A draft Campaign from Team A's first Account (a blank invitation), for a voice note step.
source "$KIT_DIR/setup/lib.sh"
t=$(tag); L=$(curviate lead lists create "Voice $t" --json | j d.id); A=$(acc 0)
leads "$L" "https://www.linkedin.com/in/kit-voice-$t-1,Vo,Kit,Acme,Founder,Berlin,"
cat > campaign.json <<JSON
{ "name": "Voice $t", "lead_list_ids": ["$L"], "account_ids": ["$A"], "sequence": { "on_reply": "end", "steps": [ { "id": "invite", "do": "invite.send", "next": "end" } ] } }
JSON
echo "CAMPAIGN_ID=$(curviate campaign create --file campaign.json --json | j d.id)"
