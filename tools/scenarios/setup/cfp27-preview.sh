# A draft Campaign (a blank invitation) over a fresh list of 47 Leads, for the preview through MCP.
source "$KIT_DIR/setup/lib.sh"
t=$(tag); L=$(curviate lead lists create "Preview $t" --json | j d.id); A=$(acc 0)
rows=(); for i in $(seq 1 47); do rows+=("https://www.linkedin.com/in/kit-pv-$t-$i,Pv$i,Kit,Acme,Founder,Berlin,"); done
leads "$L" "${rows[@]}"
cat > campaign.json <<JSON
{ "name": "Preview $t", "lead_list_ids": ["$L"], "account_ids": ["$A"], "sequence": { "on_reply": "end", "steps": [ { "id": "invite", "do": "invite.send", "next": "end" } ] } }
JSON
echo "CAMPAIGN_ID=$(curviate campaign create --file campaign.json --json | j d.id)"
