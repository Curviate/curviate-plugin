# A list of 20 Leads: 4 with an address, 2 on the Do-not-contact list, 1 "No email", 13 without an address. The
# enrichment stub (the scenario's `enrichment`, keyed by these URLs) knows 10 of the 13, one of them with two addresses.
source "$KIT_DIR/setup/lib.sh"
t=$(tag); L=$(curviate lead lists create "Emails $t" --json | j d.id)
u() { echo "https://www.linkedin.com/in/kit-fe-$KIT_RUN-$1"; }
rows=(); for i in $(seq 1 20); do e=""; [ "$i" -le 4 ] && e="has$i.run$KIT_RUN@example.test"
  rows+=("$(u "$i"),Fe$i,Kit,Acme $i,Founder,Berlin,$e"); done
leads "$L" "${rows[@]}"
id() { curviate lead list --linkedin-url "$(u "$1")" --json | j 'd.items[0].id'; }
curviate do-not-contact add --lead "$(id 5)" --json >/dev/null
curviate do-not-contact add --lead "$(id 6)" --json >/dev/null
curviate do-not-contact add --lead "$(id 7)" --scope email_only --json >/dev/null
echo "LIST_ID=$L"
