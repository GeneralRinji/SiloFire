---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: sunbleached_tree
name: sunbleached_tree
displayName: Big O' Sunbleached Tree
tagline: Creaking above the path in the harbor wind.

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

navigationLabels:
  pois: Things To Check
  choices: What You Do
  exits: Ways Out

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
  - id: sunbleachedtree_oldharboredgeroad
    targetId: sunbleachedtree_oldharboredgeroad
    displayName: Back to Old Harbor Edge Road
    key: H
---

# Big O' Sunbleached Tree

## enter @cycle
You hear children's voices in the distance fading.
[delay: medium]
Now you don't.

## enter @cycle
[fade: in 3000]
No voices this time, but you slow anyway—
like you missed something just out of sight.
[fade: out 5000]

## enter @cycle
[delay: long]
The tree creaks overhead.
[fade: out long]
[delay: long]
You pause, listening.
[fade: out long]
[delay: long]
Nothing answers back.
[fade: out long]

---

## first_visit
This must be where they go when the adults aren't looking.

---

## repeat_visit
The tree creaks in the breeze with more give than most would like. Perhaps it's best to stand farther away.

## repeat_visit
More limbs and dead bark litter the path since last time you came. It makes you wonder how long the tree will stay upright.

---

## poi:wildraspberrybush:1
It's picked clean by smaller hands.

## poi:wildraspberrybush:2
You check again anyway. Just leaves, thorns, and your own bad optimism.

## poi:wildraspberrybush:2
Stripped down to stems. Whoever got here first was thorough.

## poi:wildraspberrybush:3
[none]

## poi:wildraspberrybush:3
*Sigh*...
[fade: out long]

---

## poi:pieceoftrash:1
A scrap of cloth, snagged on a root.

## poi:pieceoftrash:2
You pull it free. It's stiff with salt and something darker.

## poi:pieceoftrash:3
[none]

---

## poi:adjacenttothetree:1 @weighted @weight=6
There's probably better places to stand though.

## poi:adjacenttothetree:1 @weighted @weight=1
You know you'd faster than any heavy branch, doesn't mean it wouldn't hurt if it took you by surprise.
[fade: out 6000]

---

## choice:walk
That old man will want to talk.

---

## choice:walk
It's fine. It's not like he's going to get any answers.

---

## choice:run
Still keeping up the ruse, aren't we?

---

## exit_glue:walk
You slow without meaning to.

---

## exit_glue_random:walk
He'll say something. He always does.

---

## exit_glue_random:walk
Too late to turn back now.

---

## exit_glue_random:walk
You could still pretend you didn't come this way.

---

## exit_glue:run
You pick up your pace.

---

## exit_glue_random:run
It's easier if you don't think about it.

---

## exit_glue_random:run
He's watching. He always is.

---

## exit_glue_random:run
You're already past the point of stopping.