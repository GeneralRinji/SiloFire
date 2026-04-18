---
presetId: locked_civic_door
presetType: object
nodeKind: gate
category: civic-door
summary: Visible blocked threshold for archives, offices, clinics, courts, or other formal public-facing buildings.
tags:
  - gate
  - locked
  - civic
  - blocked
searchTerms:
  - locked civic door
  - official entrance
  - archive door
  - office door
  - posted notice
useCases:
  - town records office
  - clinic
  - courthouse
  - city archive
relatedFixtures:
  - blocked_visible_gate
complexity: low
---

# Locked Civic Door

## When To Use

Use this when the threshold should visibly deny access and communicate an official or institutional tone.

## Required Structure

- visible Gate presentation
- blocked direction on the approached face
- `blocked:<direction>` prose

## Variation Ideas

- posted hours
- official seal
- closure notice
- chain or bar
- frosted glass
- appointment-only wording

## Minimal Stripped Example

```md
---
version: 1
templateSchema: gate
templateSchemaVersion: 1

id: civic_door
displayName: Civic Door
region: town_row

presentation:
  forward: billboard
  backward: billboard

blocking:
  forward: blocked

endpoints:
  forward:
    from: street_area
    to: office_area
  backward:
    from: office_area
    to: street_area
---

# Civic Door

## billboard:forward
Official notices crowd the glass.

## blocked:forward
The door is locked and not accepting visitors.
```