Here’s a clean project brief you can drop into a new Copilot chat.



\## Project idea



Build a prose-first explorable text game in React with a minimal terminal-like UI. The author writes content in markdown-like files with structured metadata. The runtime parses that content, interprets it according to schema rules, projects the current player-facing view, and renders it in React.



This is a modern twist on an old text MUD:



\* prose-rich traversal instead of plain NSEW spam

\* interactive choices, POIs, gates, path traversal

\* lightweight state, revisits, conditional text

\* eventually character dialogue and behavior/state



\## Goal



Make it easy for a human author to write markdown or similar content files that produce:



\* explorable areas

\* traversable paths

\* gates / thresholds / blocked routes

\* conditional prose

\* optional POIs

\* simple state-driven reactions



The authoring experience should stay simple and content-first.



\## Purpose



Create a map-based prose experience with:



\* authored critical path

\* optional side exploration

\* repeat visit variants

\* pacing controls like continue / skip / back

\* a minimal terminal-style presentation



\## Visual/UI direction



Minimal React UI that feels like a terminal:



\* black or very dark background

\* green text is fine

\* simple layout

\* one main entry page

\* from there, start at a node on the map

\* keyboard shortcuts later for quick nav



No fancy UI needed for prototype.



\## Core concept



The world is built from a few schema types:



\* Area

\* Path

\* Gate



\### Area



A place you can inhabit.

Usually supports:



\* first visit prose

\* repeat visit prose

\* optional POIs

\* optional choices

\* exits



\### Path



A traversal container.

Usually supports:



\* directional traversal

\* paged prose on first visit

\* compressed prose on repeat visit

\* continue / skip / back controls

\* internal blockage separate from gates

\* timing / delay beats in prose



\### Gate



A threshold that allows, denies, or delays passage.

Usually supports:



\* blocked/open state

\* state-specific prose

\* simple threshold choices

\* transition glue



\## Authoring philosophy



The author should mostly write content files, not code.



Content files should contain:



\* metadata/front matter

\* prose sections or flow blocks

\* optional delay markers

\* optional variants

\* optional choices/exits



Keep the syntax readable and writer-friendly.



\## Runtime layers



Use this mental model:



\### 1. Schema



Defines the shape of each major content type.



\### 2. Config



Actual object data for one node/file.



\### 3. Config presets



Authoring starters for common cases.



Examples:



\* basic area

\* narrated path

\* blocked path

\* guarded gate

\* business door

\* secret door



These are for author convenience, not runtime inheritance.



\### 4. Content



Markdown-like authored prose and interaction blocks.



\### 5. Parser



Reads content files and turns them into structured JS/TS objects.



\### 6. Interpreter



Schema-specific runtime logic.

Examples:



\* Area interpreter

\* Path interpreter

\* Gate interpreter



This decides how to read config + content + state.



\### 7. Projection



Builds the exact player-facing view model:



\* current prose to show

\* current choices

\* current exits/navigation

\* blocked/open presentation

\* continue/skip controls



\### 8. React renderer



Displays the projected model.



React should mostly render, not own game logic.



\## Content structure ideas



\### Areas



Areas are section-based.



Likely vocab:



\* `enter`

\* `first\_visit`

\* `repeat\_visit`

\* `visit\_random`

\* `poi:<id>`

\* `choice:<id>`

\* `exit\_glue:<id>` if needed



\### Paths



Paths are sequence-based, not just section buckets.



Likely use flow blocks:



\* `flow:first\_visit:forward`

\* `flow:first\_visit:backward`

\* `flow:repeat:forward`

\* `flow:repeat:backward`

\* `flow:block:forward`

\* `flow:block:backward`



Inside a flow:



\* `beat`

\* maybe inline delay markers like `\[delay:medium]`



Paths support:



\* continue

\* skip

\* back

\* forced traversal in some cases



\### Gates



Gates are threshold/state-based.



Likely sections:



\* `enter:<direction>`

\* `first\_visit:<direction>`

\* `repeat\_visit:<direction>`

\* `state:blocked:<direction>`

\* `state:open:<direction>`

\* `choice:<id>`

\* `choice\_result:<id>`

\* `exit\_glue:<direction>:<state>`



\## Signals vs tags



Keep both, but with different jobs.



\### Tags



Static grouping/classification.

Used for:



\* collections

\* quests

\* grouping

\* route tracking



Examples:



\* `harbor`

\* `seulile\_sight`

\* `brent\_route`

\* `shop`



\### Signals



Behavior/feel metadata.

Used for:



\* prose direction

\* ambient behavior

\* future systems



Examples:



\* `decay: medium`

\* `traffic: low`

\* `mood: quiet`



\## State



Prototype should support anonymous visitor state without login.



Start with browser localStorage.



Store:



\* current node id

\* visited counts

\* flags

\* lightweight quest state

\* maybe a few condition/state values



No backend auth needed yet.



\## Navigation



Navigation links are defined by config and resolved by interpreter/projection.



Projection should build:



\* visible exits

\* disabled exits

\* path traversal controls

\* action buttons



Later support keyboard shortcuts:



\* continue

\* skip

\* back

\* action shortcuts



\## Immediate prototype target



Build a small vertical slice:



\* one main entry page

\* start at a map node

\* one Area

\* one Path

\* one Gate

\* minimal save state

\* minimal terminal-style React renderer

\* keyboard shortcuts later if easy



The slice should prove:



\* content loading

\* parsing

\* interpreting

\* projection

\* rendering

\* repeat visit behavior



\## Suggested repo layout



```text

project-root

&#x20; web

&#x20;   app

&#x20;     src

&#x20;       components

&#x20;       pages

&#x20;       templates

&#x20;       lib

&#x20; docs

&#x20;   architecture

&#x20;   notes

&#x20; packages

&#x20;   schema

&#x20;   presets

&#x20;   parser

&#x20;   interpreter

&#x20;   projection

&#x20;   renderer-react

```



\## Suggested package responsibilities



\### packages/schema



Drafting the schema types and object shapes:



\* Area

\* Path

\* Gate

\* maybe reusable object types later



\### packages/presets



Authoring presets/starter files for common content types.



\### packages/parser



Parse markdown/front matter/content blocks into structured data.



\### packages/interpreter



Schema-aware logic:



\* area interpreter

\* path interpreter

\* gate interpreter



\### packages/projection



Take interpreted state and build final player-facing view model.



\### packages/renderer-react



React rendering helpers/components for the projected model.



\## Minimal React app idea



A simple terminal-like shell:



\* title/header optional

\* main prose area

\* choices/buttons below

\* exits/nav below that

\* black background, green text

\* keep it plain



\## What not to overbuild yet



Avoid for now:



\* full backend

\* login/auth

\* CMS

\* giant dialogue engine

\* massive graph editor

\* perfect schema formalization

\* overly smart parser



Build one thin vertical slice first.



\## What I want help with first



1\. Set up the monorepo/folder structure.

2\. Create draft TypeScript types for Area, Path, and Gate.

3\. Build a small parser for markdown/front matter + section/flow blocks.

4\. Build a tiny interpreter + projection for one Area, one Path, and one Gate.

5\. Render the result in a minimal React terminal UI.

6\. Support browser localStorage save state.



\## Constraints / preferences



\* Content-first authoring

\* Minimal UI

\* Easy to iterate

\* Prose should be easy to write

\* Logic should not live all over React components

\* Prototype-oriented, not enterprise overengineering



If you want, I can also turn this into a tighter `README.md` style starter doc.



