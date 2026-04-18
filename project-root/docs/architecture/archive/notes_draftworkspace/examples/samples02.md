Yeah — this one’s important, because it shows your system doing something non-standard on purpose.

This isn’t a normal “quest giver → collect → reward” loop.
It’s:

> ambient task → curiosity-driven participation → subverted payoff



So the AI needs to see:

how it appears (kid explanation, not quest log)

how it’s optionally done

how the return interaction works

how the reward is weird on purpose



---

🧠 Design intent (for AI)

This system demonstrates:

hidden / unofficial quest

no formal quest log required

player can still complete it

reward critiques player behavior

teaches “sense of wonder” vs optimization

object reward is not immediately useful



---

🧱 Minimal structure pieces

You need:

1. Area: Old Man Shack

2. Area: Shoreline Scatter (collect source)

3. Character interaction: Old Man

4. Implicit state:

found_odd_item

returned_odd_item

old_man_interaction_stage



---

🧩 1. Shack Area (with kid hook + old man)

---
version: 1
templateSchema: area

id: net_shack_001
displayName: Net Shack

tags:
  - harbor
  - npc_old_man
  - kids_route

signals:
  traffic: low
  mood: watchful

pois:
  - id: net_pile
    displayName: Pile of Nets
  - id: workbench
    displayName: Workbench
  - id: boat_frame
    displayName: Half-Finished Boat

choices:
  - id: talk_old_man
    displayName: Talk to the old man.
    key: T

exits:
  - id: back_alley
    targetId: tin_cover_alley_001
    displayName: Back toward the alley
---

# Net Shack

## enter
The smell of salt and old rope sits heavier here.

## first_visit
He’s already outside.

Of course he is.

## visit_random
There are fewer kids than last time.

Or maybe they just left faster.

## visit_random
Something small has been picked over recently.

You’re not sure what.

## poi:net_pile
Half-mended. Or half-forgotten.

## poi:workbench
Tools laid out like someone expects to use them again.

## poi:boat_frame
It might float.

That doesn’t mean it should.

---

## talk:old_man if:old_man_interaction_stage=0

### beat
He doesn’t look up.

### beat
“They never bring back the right thing.”

### beat
A kid nearby shifts, annoyed.

### choice
- ask_kid: Ask what he means.
- ignore: Let it go.

---

## choice_result:ask_kid

### beat
The kid squints at you like you should already know.

### beat
“He sends us to find things that wash up. Weird things. Not shells. Not junk.”

### beat
“They never count right.”

### beat
The kid shrugs.

### beat
“You can try if you want.”

[set:old_man_interaction_stage=1]

---

## choice_result:ignore
You already know enough to not get involved.

---

## talk:old_man if:old_man_interaction_stage=1 and not returned_odd_item

### beat
“You don’t look the type.”

### beat
He finally glances at you.

### beat
“Go on then. Prove me wrong.”

---

## talk:old_man if:returned_odd_item

### beat
He takes the object without thanks.

### beat
Turns it over.

### beat
Once. Twice.

### beat
“Hm.”

### beat
“You went about it all wrong.”

### beat
You brought me the thing.”

### beat
He sighs.

### beat
“You didn’t play much as a kid, did you?”

### beat
He digs through something behind him.

### beat
“No sense of wonder.”

### beat
“Here.”

### beat
He presses something into your hand.

### beat
“A reward.”

### beat
“Now go figure out how to use it.”

### beat
“And don’t bring me back a pail of fish.”

[set:old_man_interaction_stage=2]


---

🧩 2. Shoreline Scatter Area (collection zone)

This is where the player can “do the thing” without a formal quest.

---
version: 1
templateSchema: area

id: shoreline_scatter_001
displayName: Shoreline Scatter

tags:
  - harbor
  - collect_zone
  - hidden_task

signals:
  traffic: none
  mood: quiet

pois:
  - id: drift_cluster
    displayName: Drift Cluster
  - id: tide_line
    displayName: Tide Line
  - id: half_buried_object
    displayName: Half-Buried Object

choices:
  - id: search
    displayName: Look for something unusual.
    key: S
  - id: leave
    displayName: Leave it alone.
---

# Shoreline Scatter

## enter
Bits of everything collect here.

Most of it useless.

## visit_random
Something catches your eye.

Then doesn’t.

## visit_random
The tide leaves behind more than it takes.

That doesn’t mean it’s worth keeping.

---

## poi:drift_cluster
Broken wood and things that used to matter.

## poi:tide_line
The line shifts every day. The mess doesn’t.

## poi:half_buried_object
You could dig it out.

Or not.

---

## choice:search
Fine. Let’s see.

---

## choice_result:search

### beat
You move things around that probably shouldn’t be moved.

### beat
Most of it is nothing.

### beat
Then something isn’t.

### beat
You stop.

[set:found_odd_item=true]

---

## choice:leave
You leave it where it belongs.

Or where it ended up.


---

🧠 State expectations (minimal)

The system should track:

found_odd_item: boolean
returned_odd_item: boolean
old_man_interaction_stage: number

Optional:

how many times player searched

whether player over-collected nonsense (future expansion)



---

🧠 Reward object (conceptual)

You don’t need full system yet, but conceptually:

inventory.add("carved_lure")

The lure is:

intentionally ambiguous

not immediately useful

symbolic reward



---

🎯 Important behaviors for AI

1. No formal quest log required

Player can:

overhear

infer

participate


2. Completion is not signposted

No:

“Quest Complete”

“+1 reward”


Just:

interaction

reaction

subtle state change



---

3. Reward critiques player

The key line:

> “You went about it all wrong.”



This is intentional design:

player optimized

system pushes back



---

4. Object reward is exploratory

> “Figure out how to use it.”



This implies:

future system hook

not immediate payoff



---

5. Kids are the onboarding, not the old man

Old man does not explain.

Kids do.

That keeps:

tone consistent

avoids tutorial NPC feeling



---

🧭 Why this matters

This example teaches the AI:

not all interactions are explicit quests

content may exist without UI acknowledgment

completion can be subtle

reward can be narrative, not mechanical

player behavior can be gently challenged



---

🔥 If you want next

Next best expansion would be:

show how the lure later becomes usable

or how repeated failures change old man dialogue

or how player tries to “optimize” this and gets shut down


But this is already enough for the code AI to understand the pattern.
