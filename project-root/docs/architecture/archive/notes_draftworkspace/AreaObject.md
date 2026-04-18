//Area Object Sample
---
version: 1 //draft
templateSchema: area
templateSchemaVersion: 1

id: sunbleached_tree_{guid}
name: sunbleached_tree
displayName: Big O' Sunbleached Tree

region: old_harbor

passthrough: false

signals:
  decay: medium
  traffic: low
  mood: quiet

tags:
  - harbor
  - seulile_sight
  - brent_route

pois:
  - id: wildraspberrybush
    displayName: Wild Raspberry Bush
  - id: adjacenttothetree
    displayName: At the Base of the Tree
  - id: pieceoftrash
    displayName: Piece of Trash

choices:
  - id: run
    displayName: Do a brisk run through ShackRun.
  - id: walk
    displayName: No, I'd rather walk.

exits:
  - id: shack_run
    targetId: shack_run_{guid}
    displayName: Through ShackRun
    key: R

  - id: harbor_edge
    targetId: harbor_edge_{guid}
    displayName: Back to Harbor Edge Road
    key: H
---

# Big O' Sunbleached Tree

## enter
You hear children's voices in the distance fading.
[delay: medium]
Now you don't.

---

## first_visit
2–3 sentences about the tree.

---

## visit_random
More limbs and dead bark litter the path since last time you came. It makes you wonder how long the tree will stay upright.

---

## visit_random
Any day now, this tree will be done. You have a feeling that won’t stop the children from keeping their playground. It’ll just become a conquering mound.

---

## repeat_visit
The tree creaks in the breeze with more give than most would like. Perhaps it’s best to stand farther away.

---

## poi:wildraspberrybush
It’s picked clean by smaller hands.

---

## choice:walk
That old man will want to talk.

---

## choice:walk
It’s fine. It’s not like he’s going to get any answers.

---

## choice:run
Still keeping up the ruse, aren’t we?

---

## exit_glue:walk
You slow without meaning to.

---

## exit_glue_random:walk
He’ll say something. He always does.

---

## exit_glue_random:walk
Too late to turn back now.

---

## exit_glue_random:walk
You could still pretend you didn’t come this way.

---

## exit_glue:run
You pick up your pace.

---

## exit_glue_random:run
It’s easier if you don’t think about it.

---

## exit_glue_random:run
He’s watching. He always is.

---

## exit_glue_random:run
You’re already past the point of stopping.
