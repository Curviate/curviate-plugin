# Oracle: a campaign webhook exists, an incoming event is enabled with a captured sample, the Campaign is still a draft.
source "$KIT_DIR/setup/lib.sh"
w=$(curviate webhook list --json | j 'd.items.filter((x) => x.source === "campaign").length')
i=$(curviate incoming list --json | j 'd.items.filter((x) => x.enabled && x.sample_state === "captured").length')
s=$(curviate campaign get "$CAMPAIGN_ID" --json | j d.status)
echo "campaign webhooks=$w incoming enabled+captured=$i campaign=$s"; [ "$w" -ge 1 ] && [ "$i" -ge 1 ] && [ "$s" = draft ]
