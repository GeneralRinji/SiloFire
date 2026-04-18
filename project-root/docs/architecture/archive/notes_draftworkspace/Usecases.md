Absolutely. Here’s a practical use-cases / behavior notes doc you can paste into Copilot or a project notes file so the coding AI has concrete examples from what we worked through.


---

Use Cases and Design Notes

Primary experience goal

This project is a prose-first explorable map/game hybrid.

It should feel like:

a modernized text MUD

with authored prose and mood

optional exploration

state-aware revisits

lightweight hidden systems

subtle humor

minimal UI


The experience should prioritize:

movement through meaningful places

relationship/memory encoded in routes

prose pacing

optional interactivity

not dense menus or stats



---

Core Schema Use Cases

1. AreaObject use case

An Area is a place the player can inhabit and inspect.

Examples:

Old Beacon Tower

Net Shack

Sunbleached Tree

Training Yard Tree

Pie Stall

Office

Ballroom Entry


Typical Area features:

first visit prose

repeat visit prose

random revisit variants

local POIs

optional choices

exits

ambient NPC presence


Example use case: Net Shack

The player can:

run through quickly

walk and invite interaction

inspect nets, tools, boat

revisit multiple times and get slight prose variation


Important behavior:

same place can feel different depending on chosen posture

run = passthrough-ish

walk = more social friction



---

2. PathObject use case

A Path is traversal, not inhabitation.

Examples:

Tin-Cover Alley

Harbor Edge Road

Bridge Span

Exterior Spiral

Old Harbor Stretch


Typical Path features:

directional flows

first visit as paged prose

repeat visit as compressed prose

blocking can occur inside the path

continue / skip / back controls

special timed traversal possible


Example use case: Tin-Cover Alley

On first visit:

player sees multiple prose beats in sequence

can Continue or Skip

route feels enclosed, quiet, secretive


On repeat:

path is shorter

maybe one or two compressed beats only


Important behavior:

forward prose and backward prose may differ

path can be blocked one direction but not the other

path is allowed to be more “scripted” than area



---

3. GateObject use case

A Gate is a threshold that allows, blocks, delays, or conditions movement.

Examples:

West Tower Guard Post

Back Door to Shop

Hidden Magic Door

Guarded Entrance

Locked Service Door


Typical Gate features:

blocked/open state by direction

denial prose

threshold choices

optional permission logic

transition glue when allowed


Example use case: West Tower Guard Post

The player approaches wanting to see Tessa. The gate:

blocks forward movement

gives denial text

may allow waiting, leaving, or asking again

may later unlock after state changes


Important behavior:

path itself may be fine, but the threshold denies entry

different from rubble mid-path



---

Placeholder and presentation use cases

4. Placeholder node use case

Some nodes exist in graph topology but are not rendered yet.

Placeholder AreaNode

Used when:

a place may matter later

map structure should exist now

player should pass through without noticing


Behavior:

auto-redirects to connected node

no page shown

useful for future insertion



---

5. Billboard use case

Some things should visibly exist but not be explorable yet.

Examples:

closed shop doors

vitrine/window displays

homes

inaccessible interiors


Behavior:

visible in prose or as a POI

may give a short reaction line

no full interior content required yet


Example use case: Business door

Door exists. Player can inspect it. Door may say:

“Closed.”

“Not today.”

“Something shifts inside.”


No interior required yet.


---

Object/preset use cases

6. DoorObject preset use case

There should probably be one underlying door shape, with authoring presets.

Preset examples:

domestic door

business door

guarded door

secret door

vitrine/window


Purpose:

avoid rethinking common config every time

make authoring faster

keep runtime model unified


Important distinction:

schema = runtime shape

preset = fill-in-the-blanks author starter



---

Route and relationship use cases

7. Relationship-through-routes use case

Some routes encode character relationships.

The best current example is Brent’s alley route.

The route should:

initially feel like a shortcut

later feel like a shared habit

on revisits become emotionally recontextualized


Possible tracking:

brent_route tag

visit counts

different revisit prose


Example progression

Early:

“You take the alley.”


Later:

“You remember who showed you this.”


Even later:

“You’ve been following his routes.”


Important design idea:

relationship state can be encoded in map repetition, not explicit romance systems



---

8. “100 Sights of Seulîle” quest use case

A hidden or semi-hidden exploration quest.

Behavior:

player visits enough tagged Seulîle sight nodes

quest appears later, not immediately

quest meaning evolves over time

at high completion, its title may change to reveal relationship or pattern subtext


Possible early quest name:

100 Sights of Seulîle


Possible late reveal:

Routes You Took Together

Places You Didn’t Go Alone


Important design idea:

collection/exploration becomes relationship recognition



---

Character and dialogue use cases

9. Character presence in nodes

Characters do not need a giant separate system at first.

Characters can be attached to nodes with state-aware dialogue flows.

Examples:

Old man at shack

Ren in berry quest area

Guard at west tower

Tessa later

Brent/Galad route memory echoes


Minimal need:

character present state

simple dialogue flow

a few state flags



---

10. Dialogue as flow use case

Dialogue can use the same sequence/beat model as path traversal.

It should support:

short beat-by-beat lines

conditional branches

very light choices

repeat visit variants


Example:

old man conversation at shack

first interaction vs later interaction

behavior-aware dialogue if player keeps running past



---

State and narrator use cases

11. Temptation / guilt / projection narrator use case

Narrator is allowed to subtly react to player habits.

This is not a morality system. It is more like:

temptation

restraint/guilt

projection/ironic future speculation


Use sparingly.

Example use case: crate money

Player inspects coin in a crate.

Possible narrator variants:

“That’s not yours.”

“Still making the right call.”

“Right makes the purse light.”

“No one would notice.”

“Turns out it wasn’t even the thing you needed.”


Important rule:

one voice beat at a time

short

dry

no heavy moralizing



---

12. State-driven narrator override use case

The same object can render differently depending on state.

Example:

expensive coat

player low on money

narration becomes more tempting / sharper


This is not UI messaging. This is prose variation.


---

13. Set Up mechanic use case (Amodeus-specific)

Amodeus gets actions that seem arbitrary in the moment but may matter later.

Examples:

move an item

alter a small setup detail

leave something unlocked

reposition an object


Important constraints:

no explicit future explanation

often no immediate reaction

sometimes no payoff at all

occasionally, a rare internal “curl of spiteful satisfaction” marks a charged setup


This should feel like:

intuition

petty agency

future tilt without overt foresight


Lucaus should not get this mechanic. He is reactive/strategic in the moment, not setup-oriented.


---

Quest use cases

14. Hidden ambient quest use case

A quest can exist in the world without being given officially.

Example:

old man sends kids to look for “the thing”

player overhears from kid

no official quest log entry required

player can still discover and resolve it


Important behavior:

quest exists even if untracked

curiosity is enough to engage it



---

15. Distorted collection quest use case (berries)

The berry quest should deliberately be a modernized “collect X” quest with character/state flavor.

Story context:

Ren needs exactly 20 berries for salve

Amodeus is concussed / unwell

exact numerical tracking is intentionally not available


Instead of exact count, quantity bands:

none

a couple

some

a handful

probably enough

plenty

too many


Important behavior:

player may count manually if they want

player may get annoyed

occasional physical loss can reduce quantity band

over-collecting can trigger poisonous berry contamination

repeated over-collecting may trigger Ren intervention


Example poisonous berries scene

If player brings too many:

some are poisonous

Ren notices

Amodeus makes a dry comment

Ren ignores him and resets with a new pail


This scene should make player question:

whether Amodeus is okay

whether their own optimizer behavior contributed


Example intervention scene

If player repeatedly overdoes it:

Ren tells Amo to sit in the shade

Ren gets the berries himself

player loses direct task agency

this is not punishment so much as intervention


Important design idea:

collection quest becomes character-and-state commentary

different players will react differently

“Amo camp” players may hate it and that is intentional



---

16. Kid collect quest + lure reward use case

Kids are periodically sent by the old man to look for random washed-up or hidden things.

Purpose:

world texture

non-official collect loop

ambient optional hidden quest


If player discovers and brings back the thing:

old man does not simply reward the result

he critiques the approach as too adult / joyless

gives a hand-carved lure as a “reward”

encourages figuring out how to use it

explicitly says not to bring back a pail of fish


Important design idea:

not all collect quests should resolve conventionally

old man is not a normal quest giver

this is a correction of mindset, not a reward loop



---

Traversal and pacing use cases

17. Delayed prose beat use case

Some prose should reveal over time.

Syntax idea already liked:

[delay:short]

[delay:medium]

[delay:long]


Use for:

realization

humor

atmosphere

subtle horror

emotional turn


Example:

“You hear children’s voices fading.”

delay

“Now you don’t.”


Important:

use sparingly

likely skippable by user click later



---

18. Path paging use case

On first visit, some paths should page through multiple authored beats.

Controls:

Continue

Skip

sometimes Back

sometimes none if traversal is forced


On repeat visit:

compressed path prose

often only one or two beats


Special event traversal:

timed reveal

forced pacing

fade-based movement

can auto-advance


Important design idea:

paths are primarily pacing-heavy, not choice-heavy



---

NPC texture use cases

19. Old man shack use case

The old man is not a quest hub. He is:

friction

observer

place texture

someone who notices too much


Possible functions:

comments on Amo’s fake “morning runs”

gives ambient kid collect tasks

tolerates repeated presence

quietly reads Amo better than most people do


Example line:

“You don’t look the type.”


This line should hit because it implies he sees Amo correctly.


---

20. Kids at edge-of-town use case

Kids can gather at the shack, tower edge, or old harbor stretch.

They should:

give world texture

justify why this far-out area still has life

occasionally carry hidden-quest information

disperse quickly

not feel like formal quest NPCs



---

Technical use cases

21. Keyboard shortcut use case

Browser should support shortcut navigation.

Examples:

C = continue

S = skip

B = back

R = run

W = walk


Projection should expose active shortcuts. React should render them. Browser keydown logic should trigger only valid current actions.


---

22. Anonymous save state use case

Support visitors without accounts.

Use browser localStorage first.

Store:

current node

visit counts

flags

lightweight quest state

maybe route counts / condition state


Export/import later is optional.


---

Prototype priorities

23. Vertical slice use case

Build a small slice first:

one Area

one Path

one Gate

one repeat variation

one optional POI

one hidden/ambient quest hook

one little bit of narrator flavor


Possible Chapter 7 harbor slice:

Harbor Edge

Sunbleached Tree

Tin-Cover Alley

Net Shack

One gate/threshold


This should prove:

parser

interpreter

projection

renderer

save state

repeat visit behavior



---

24. Prototype content density use case

Most nodes in early prototype should be:

passthrough

billboard

lightly authored

only a few fully explorable


This keeps the world broad without causing huge content debt.

Suggested rough prototype mix:

60% passthrough/billboard

30% light authored

10% full nodes



---

Why these use cases matter

The coding AI should understand that this project is not just:

static markdown rendering

generic hypertext

or a standard dialogue tree game


It is specifically trying to support:

prose traversal

route-based emotional meaning

state-aware revisits

hidden optional world actions

slight humor

light emergent quest behavior

content-first authoring


If you want, I can turn this into a cleaner docs/architecture/use-cases.md file format next.
