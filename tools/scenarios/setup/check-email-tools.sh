# Oracle: this run's Campaign has a campaign webhook and an incoming event enabled with a captured sample, and is still a draft.
source "$KIT_DIR/setup/lib.sh"
w=$(curviate webhook list --json | j "d.items.filter((x) => x.source === 'campaign' && (x.campaign_ids ?? []).includes('$CAMPAIGN_ID')).length")
i=$(curviate incoming list --json | j "d.items.filter((x) => x.enabled && x.sample_state === 'captured' && (x.campaign_id ?? x.campaign) === '$CAMPAIGN_ID').length")
s=$(curviate campaign get "$CAMPAIGN_ID" --json | j d.status)
echo "this Campaign: webhooks=$w incoming enabled+captured=$i status=$s"; [ "$w" -ge 1 ] && [ "$i" -ge 1 ] && [ "$s" = draft ]
