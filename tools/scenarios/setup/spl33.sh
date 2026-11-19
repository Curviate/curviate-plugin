# SPL-33, SPL-36. MODE=import: an Account and a LinkedIn search URL unique to the run (an open import of the same source
# refuse a second). MODE=dnc: a Lead with an address and an email_only Do-not-contact entry ("No email").
source "$KIT_DIR/setup/lib.sh"
t=$(tag)
if [ "${MODE:-import}" = import ]; then
  echo "ACCOUNT_ID=$(acc 0)"
  echo "TAG=$t"; echo "SEARCH_URL=https://www.linkedin.com/search/results/people/?keywords=cto%20$t"
else
  L=$(curviate lead create --linkedin-url "https://www.linkedin.com/in/$t-dana" --first-name Dana --last-name Kit --email "dana.$t@example.test" --json | j d.id)
  curviate do-not-contact add --lead "$L" --scope email_only --reason asked_to_stop --json > /dev/null
  echo "LEAD_ID=$L"
fi
