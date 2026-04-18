# demo03

This project is a classic cardinal-navigation demo built with the current Area, Gate, and Path rules.

## Folder Intent

- `center/`: town entry and the main cross-shaped streets
- `west_side/`: inn frontage and the quieter west-side pockets
- `east_side/`: market, shrine, and archive-facing streets
- `north_edge/`: the bridge approach and riverbank stop
- `endings/`: authored exits from the quarter and return-to-title thresholds

## Map Shape

```text
                [good ending]
                      ^
                  riverbank
                      ^
                 north_bridge
                      ^
watch_alley <- north_street -> archive_steps -> archive_door
      ^              ^               ^
      |              |               |
  well_court <- town_square -> market_lane -> fish_row -> [bad ending]
      ^              ^               v
      |              |          shrine_yard
 lantern_inn <- lantern_inn_door  ^
                      ^            |
                  south_street ----+
```

## Important Rule

Folder names are organizational only.

Node identity still comes from front matter `id`, and authored references still point to node ids, not paths.