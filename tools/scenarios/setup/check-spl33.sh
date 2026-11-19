# The import the go allowed: exactly one of the run's search (its tag), from a LinkedIn source.
source "$KIT_DIR/setup/lib.sh"
r=$(curviate lead imports list --json | j "d.items.filter(i => JSON.stringify(i).includes(process.env.TAG)).map(i => [i.id, i.status, i.source && i.source.kind])")
echo "$r"
node -e 'const r=JSON.parse(process.argv[1]);process.exit(r.length===1&&r[0][2]==="people_search"?0:1)' "$r"
