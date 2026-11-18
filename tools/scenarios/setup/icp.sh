# 50 Leads with stored job titles, companies and locations; about a third fit a three-criteria ICP.
source "$KIT_DIR/setup/lib.sh"
t=$(tag); L=$(curviate lead lists create "ICP $t" --json | j d.id)
titles=(Founder "Head of Sales" CTO "Marketing Intern" CEO Accountant); cos=("Acme Software" "Beta Bakery" "Gamma Cloud" "Delta Logistics" "Epsilon AI")
locs=(Berlin Munich Paris Hamburg London)
rows=(); for i in $(seq 1 50); do rows+=("https://www.linkedin.com/in/kit-icp-$t-$i,Icp$i,Kit,${cos[$((i % 5))]},${titles[$((i % 6))]},${locs[$((i % 5))]},"); done
leads "$L" "${rows[@]}"
echo "LIST_ID=$L"
