# Oracle: the Team still holds its seats and the cap still has no room (nothing was bought).
source "$KIT_DIR/setup/lib.sh"
out=$(curviate billing cap --json | j '[d.seats, d.room_seats].join(" ")'); echo "seats, room: $out"; [ "${out#* }" = 0 ]
