# The target: a Lead who is a Connection of Team A's second Account (a colleague's), not of the user's own.
source "$KIT_DIR/setup/lib.sh"
printf 'linkedin_url,first_name,last_name\nhttps://www.linkedin.com/in/edsger-dijkstra,Edsger,Dijkstra\n' > target.csv
curviate lead import --file target.csv --json >/dev/null
id=$(curviate lead list --linkedin-url https://www.linkedin.com/in/edsger-dijkstra --json | j 'd.items[0].id')
# Runs share one database and this Lead: start each run without the Tag, so the oracle reads this run's write.
curviate lead tags remove intro-asked "$id" --json >/dev/null 2>&1 || true
echo "LEAD_ID=$id"
