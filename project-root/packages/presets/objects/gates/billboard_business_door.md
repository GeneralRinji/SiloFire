---
presetId: billboard_business_door
presetType: object
nodeKind: gate
category: business-door
summary: Visible billboard-style business threshold for a storefront, office, workshop, or public-facing door.
tags:
  - gate
  - billboard
  - business
  - storefront
  - threshold
searchTerms:
  - business door
  - storefront gate
  - hours sign
  - awning
  - mailbox
  - signboard
  - vitrine
useCases:
  - shop exterior
  - office entry
  - clinic front door
  - workshop threshold
relatedFixtures:
  - visible_gate_threshold_between_areas
  - invisible_area_gate_path_gate_area
complexity: low
---

# Billboard Business Door

## When To Use

Use this when the door itself should be a visible threshold page.

This is a good preset for places where the outside face communicates story information before entry.

## When Not To Use

- Do not use it when the threshold should be invisible support only.
- Do not use it when the route is really a traversal sequence and needs a Path.

## Required Structure

- `templateSchema: gate`
- `templateSchemaVersion: 1`
- `id`, `displayName`, `region`
- directional `presentation` or legacy passthrough/billboard fields
- `endpoints` if it must resolve onward movement
- at least one threshold prose section such as `billboard`, `billboard:<direction>`, `enter`, or `enter:<direction>`

## Variation Ideas

- business hours sign
- mail slot or mailbox
- display window or vitrine
- hanging sign
- awning
- lock state in prose
- faded paint
- posted notice

## Authoring Rules

- Keep the example structurally simple.
- Use directional prose if the street side and interior side differ.
- Add authored exits only if the gate should expose explicit threshold actions.
- If the face should simply allow entry, let the runtime synthesize `continue` from endpoints.

## Minimal Stripped Example

```md
---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: business_door
displayName: Business Door
region: town_row

presentation:
  forward: billboard
  backward: billboard

endpoints:
  forward:
    from: street_area
    to: business_interior
  backward:
    from: business_interior
    to: street_area
---

# Business Door

## billboard:forward
Closed.

## enter:forward
The door gives when you push it.

## enter:backward
Street light reaches across the threshold.
```

## Use Case Notes

This preset is useful because a content AI can start plain and then layer specifics like period signage, awning type, or storefront clutter without changing the graph role.

## Related Fixtures

- `fixtures/invisible_area_gate_path_gate_area.md`