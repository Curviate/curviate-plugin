# A draft Campaign (a blank invitation) on 3 Leads with addresses, for the Instantly Recipe.
source "$KIT_DIR/setup/lib.sh"
t=$(tag); L=$(curviate lead lists create "Tools $t" --json | j d.id); A=$(acc 0)
leads "$L" "https://www.linkedin.com/in/kit-et-$t-1,Et1,Kit,Acme,Founder,Berlin,et1.$t@example.test" \
  "https://www.linkedin.com/in/kit-et-$t-2,Et2,Kit,Acme,CTO,Berlin,et2.$t@example.test" \
  "https://www.linkedin.com/in/kit-et-$t-3,Et3,Kit,Acme,CEO,Berlin,et3.$t@example.test"
cat > campaign.json <<JSON
{ "name": "Tools $t", "lead_list_ids": ["$L"], "account_ids": ["$A"], "sequence": { "on_reply": "end", "steps": [ { "id": "invite", "do": "invite.send", "next": "end" } ] } }
JSON
echo "CAMPAIGN_ID=$(curviate campaign create --file campaign.json --json | j d.id)"; echo "LEAD_EMAIL=et1.$t@example.test"
