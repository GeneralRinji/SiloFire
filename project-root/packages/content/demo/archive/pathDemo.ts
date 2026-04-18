export const PATH_OBJECT_SAMPLE_SOURCE_PATH = 'PathObject.md';

export const PATH_OBJECT_SAMPLE = `//Path Object Sample 
---
version: 1 //draft
templateSchema: path
templateSchemaVersion: 1

id: old_harbor_edge_road_{guid}
displayName: Old Harbor Edge Road

region: old_harbor

passthrough: false

directionality: bidirectional

traversal:
  firstVisitMode: paged
  repeatVisitMode: compressed

blocking:
  forward: open
  backward: blocked

endpoints:
  forward:
    from: harbor_edge_road_{guid}
    to: net_shack_{guid}
  backward:
    from: net_shack_{guid}
    to: harbor_edge_road_{guid}
---

# Old Harbor Edge Road

## flow:first_visit:forward

### beat
The maintained road gives way without announcement.

### beat
The stone narrows under weeds and broken edging, as though the island simply stopped caring where the harbor used to begin.

### beat
The sea sits closer here.

---

## flow:first_visit:backward

### beat
Leaving the shack behind, the road seems less forgotten than unfinished.

### beat
The sea falls away by degrees, and with it the feeling of being somewhere people stopped expecting to matter.

### beat
Ahead, the maintained stretch of harbor road resumes as if nothing had changed.

---

## flow:repeat:forward

### beat
You know where the road starts pretending not to be a road anymore.

---

## flow:repeat:backward

### beat
The return feels shorter from this direction.

---

## flow:block:backward

### beat
A spill of old stone and mortar has settled across the narrowest stretch.

### beat
There’s no way back through here now.
`;