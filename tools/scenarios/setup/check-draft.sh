# Oracle for "stops at the Lead check": the Campaign is still a draft and nobody is enrolled.
source "$KIT_DIR/setup/lib.sh"
s=$(curviate campaign get "$CAMPAIGN_ID" --json | j d.status); n=$(curviate enrollment list --campaign "$CAMPAIGN_ID" --json | j d.items.length)
echo "status=$s enrollments=$n"; [ "$s" = draft ] && [ "$n" = 0 ]
