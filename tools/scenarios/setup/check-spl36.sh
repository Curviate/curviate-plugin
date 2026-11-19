# After the go: something that tells the user, a webhook of source signal or a Signal rule, and no rule that enrolls.
source "$KIT_DIR/setup/lib.sh"
w=$(curviate webhook list --json | j "(d.items ?? d).filter(x => x.source === 'signal').length")
r=$(curviate signal rules list --json | j "(d.items ?? d).length")
e=$(curviate signal rules list --json | j "(d.items ?? d).filter(x => JSON.stringify(x).includes('mot_')).length")
echo "signal webhooks $w, rules $r, enrolling rules $e"
[ $((w + r)) -ge 1 ] && [ "$e" -eq 0 ]
