Places People! — Prompt Library
Version 5 | Living document | Stored in project files and repo Sean Philbin | Orlando, FL | 2026
How to Use This Document
This document lives in the Places People! project files and in the GitHub repo at: `https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROMPT_LIBRARY.md`
Any chat in the project can read it directly. To use a prompt from any chat, say:
"See the Prompt Library. Run Prompt [number]."
You can also paste any prompt directly. Both work identically.
Prompt scope:

* Prompts 1 and 2: Command Center only
* Prompts 3 through 11: Any chat in any project
* Prompt 9: Always run before closing any chat session
Key References
Project State (primary sync source): `https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROJECT_STATE.md` Read this via web_fetch at the start of every session. This is the single source of truth for current build status, architecture, validation status, and recent changes.
Validation Tracker (Google Drive): fileId: `1pVnHj_bqpc3tJn-DbajNt8mR0ce4yR2mXuvGT-dlub0`
Master Log (Google Drive): fileId: `1nMIRAXX-usCkUam-LsKK_9qu4WNYnMNlkgZ3iMSy6vc`
Brand Voice Guide v2 (Google Drive): fileId: `1p6sCqfFge6GqEDvuKwWl_HnkiESH6XPYemUGSas7i6k`
Call Guide v2 (Google Drive): fileId: `1CaCu_iUHMvyn6uRw8PBfwMLYXlnadjmtirDiVz5ao6E`
Living Record chat: Find via recent_chats. Title is Living Record. Read Section 6 first for what changed recently.
Session Maintenance Rule
Every chat runs Prompt 9 before closing. Every chat runs Prompt 3 before starting. Those two habits are what keep the system alive.
COMMAND CENTER PROMPTS
Use these only in the Command Center chat.
Prompt 1 — Project Status Report
When to use: Start of a new work session. When you feel scattered. When you are not sure what to focus on.
How to use: Paste into the Command Center chat.

```
You are the strategic overseer for the Places People! project. Before responding,
do all three of the following in order:

1. Fetch the project state file from the repo using web_fetch at:
   https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROJECT_STATE.md
   This is the single source of truth for current build status, architecture,
   validation status, brand status, and recent changes.

2. Read the Living Record chat by running recent_chats and finding the chat
   titled Living Record. Read Section 6 first for recent changes. If anything
   conflicts with or adds to the repo file, note it.

3. Read the validation tracker from Google Drive using fileId:
   1pVnHj_bqpc3tJn-DbajNt8mR0ce4yR2mXuvGT-dlub0
   for current outreach status and call completion.

If the repo file is inaccessible, fall back to Google Drive PP Current State at
fileId: 11EnHH1r1spJmtpE7EdWUJRV89GJTUB9QztjSk-W8KgI and say so explicitly.

Give me a full status report structured as:

First: a one paragraph honest summary of where the overall project stands
and whether we are on track for a real launch.

Second: a ranked list of every active workstream with a status.
Green = in good shape, does not need attention today.
Yellow = needs attention soon or will become a problem.
Red = blocking something else, needs to move first.

Third: my top three priorities for this week in order. Not everything I could
do. The three things that will move the needle most. Tell me why each matters
and what happens if I skip it.

Fourth: flag any dependencies I am missing. If something cannot move until
something else is resolved, connect those dots.

Be direct. If I am behind, say so. If I am working on the wrong things, say so.
```

Notes:

* All three sources required before generating this report.
* If any source is inaccessible, say so explicitly rather than estimating.
Prompt 2 — Weekly Check-In
When to use: Every Monday morning before you start working.
How to use: Paste into the Command Center chat.

```
New week. Do all three of the following before responding:

1. Fetch the project state file from the repo using web_fetch at:
   https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROJECT_STATE.md

2. Read the Living Record chat via recent_chats, Section 6 first.

3. Read the validation tracker from Google Drive at fileId:
   1pVnHj_bqpc3tJn-DbajNt8mR0ce4yR2mXuvGT-dlub0

All three sources required before responding.

Tell me: where did I make progress last week, where did I stall, and what are
my top three moves this week. Be honest and be fast. I want to know what to
open first when I sit down to work.
```

UNIVERSAL PROMPTS
These work in any chat in any project.
Prompt 3 — Universal Sync
When to use: When returning to a chat after any break. When decisions made in other chats may affect this workstream. Before starting any new work.
How to use: Paste at the start of any chat session before doing anything else.

```
Before we continue do the following in order.

First, fetch the project state file directly from the repo using web_fetch at:
https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROJECT_STATE.md
This is the single source of truth for the current state of Places People!
Read it completely before doing anything else.

Second, read the Living Record chat by running recent_chats and finding the
chat titled Living Record. Read Section 6 first for what has changed recently.
If anything in the Living Record conflicts with or adds to the repo file, note it.

Third, run recent_chats with n=10 to catch anything very recent that may not
yet be in either source.

Then confirm what you now know, flag any conflicts, and ask what we are
working on today.

If the repo file is inaccessible, fall back to reading PP Current State from
Google Drive at fileId: 11EnHH1r1spJmtpE7EdWUJRV89GJTUB9QztjSk-W8KgI.
Tell me if you had to use the fallback so I know the primary source was unavailable.
```

Notes:

* The repo file is the primary source. Drive is the fallback. Living Record catches what is very recent.
* If recent_chats returns incomplete results, ask Sean to paste updates directly.
* Never estimate project state. If a source is inaccessible, say so.
Prompt 4 — Stuck Mode
When to use: When you feel paralyzed. Too many things. Cannot prioritize. Need someone to just tell you what to do.
How to use: Paste into whichever chat is relevant, or Command Center for project-wide overwhelm.

```
I am stuck and need you to simplify. Do not give me a list of everything I
could do. Do not give me context or background.

Tell me the single most important thing I should do right now in this
workstream and give me the specific first step to start it.

One thing. One step. Go.
```

Prompt 5 — Decision Log
When to use: After deciding on a feature, pricing approach, positioning choice, architecture call, or any meaningful decision that affects other parts of the project.
How to use: Paste into the chat where the decision was made.

```
Summarize the key decision we just made as a clean decision log entry.
Format it as:

Decision: what was decided in one clear sentence.
Rationale: why we made this call in two to three sentences.
Impact: what this affects or changes in the project.
Date: today's date.

Keep it tight. This is for the Master Log and the Living Record, not for analysis.
```

Prompt 6 — Outside Eyes
When to use: Before sending any outreach. Before finalizing any copy. When you want honest feedback from someone who has never heard of Places People!
How to use: Paste this first, then share the copy or material you want reviewed.

```
For this response only, you are a skeptical but fair venue operator or house
manager who has never heard of Places People! You are being shown this
for the first time.

Read what I am about to share and respond honestly as that person.
What lands. What does not. What questions come up. What would make
you want to keep reading or walk away.

Do not be nice to protect my feelings. Be the person I need to convince.

After you give that outside perspective, return to your normal role and
tell me what to fix based on what you just said.
```

Prompt 7 — Launch Readiness Check
When to use: When you think something might be ready to move to the next phase. When you want to pressure test a workstream before committing to a launch date or action.
How to use: Paste into the relevant chat and name the workstream, or Command Center for a full project check.

```
Run a launch readiness check on [name the workstream or say the full project].

For each area tell me:
What is ready and could go out today.
What is incomplete and needs work before launch.
What is missing entirely and will create a problem if not addressed.

Then give me a readiness score: Not Ready, Almost Ready, or Ready.
And tell me the one thing I need to fix first to move it forward.

Be specific. Do not tell me things are fine if they are not.
```

Prompt 8 — Validation Signal Review
When to use: After completing one or more validation calls. When deciding whether to adjust scope, positioning, or build priorities based on what you are hearing.
How to use: Paste into the Outreach and Validation chat or Command Center after calls have been logged.

```
Read the validation tracker from Google Drive at fileId:
1pVnHj_bqpc3tJn-DbajNt8mR0ce4yR2mXuvGT-dlub0

Then give me a signal review structured as:

Pattern summary: what pain points are coming up most across all calls,
regardless of what I asked about. What are people reaching for first.

Scope signal: are the signals pointing toward FOH-specific, broader theater
and event operations, or is it still unclear. How confident are you in that read.

Decision threshold: have we hit the point where the validation data is strong
enough to make a scope decision. If yes, what is the decision. If no, what
would it take to get there.

Recommended next move: one specific action based on what the data says.

Be direct. If the signals are mixed, say so. If they are clear, say so.
```

END OF SESSION
Prompt 9 — End of Session Summary
When to use: Before closing any chat. Always. No exceptions.
How to use: Paste into the chat before you close the tab or move to another chat.

```
This is the end of this working session. Mark it closed.

Write a structured end of session summary so the Living Record chat can
absorb what happened here. After this summary is written, treat any future
messages in this chat as a new session that may be days, weeks, or longer
after this one. Do not assume continuity. Do not assume the project state
is the same as it was in this session. When this chat resumes, run Prompt 3
before doing anything else, because significant work may have happened
across other chats since this session closed.

Format the summary exactly as follows.

Chat name: the name of this chat.
Session date: today's date.
Session closed: yes.

What changed: a bullet list of every decision made, thing built, direction
shifted, or question resolved in this session. Be specific. Vague entries
do not help the Living Record.

What is now open: any new questions or blockers that came up that were
not open before this session.

What is on hold: anything intentionally paused in this session and why.

What the Living Record should update: one sentence per section of the
Living Record that needs to change based on this session. If a section
does not need to change, say so explicitly.

What should be committed to PROJECT_STATE.md: list any changes to
build status, architecture, validation status, brand status, or recent
changes that Claude Code should update in the repo file. If nothing
needs updating in the repo, say so.

After writing this summary, say:
This session is closed. Run Prompt 3 when you return.
```

Notes:

* This is the most important prompt in the library. If sessions do not close cleanly the whole sync system degrades.
* The Living Record is only as good as what individual chats feed it. Be specific and complete.
* If something important happened and it is not in this summary, it may not make it into the record.
AUDIT PROMPTS
Prompt 10 — Audit: Quick Scan
When to use: When the project feels cluttered, redundant, or like something is falling through the cracks.

```
You are doing a fast structural read of this Claude project. Do not do any
of the work inside the project. Evaluate the architecture only.

Review everything you know about the active chats and prompts in this project.

Deliver the following in plain list format, no extra explanation:

Chats to Retire: any chats that have served their purpose or are now
redundant. One line each: name and reason.

Gaps: any areas of the project that have no coverage but probably should.
One line each: what is missing and why it matters.

New Chats to Add: for each gap that warrants a standing chat, proposed
name and one-sentence purpose. No drafts yet.

New Prompts to Add: for any recurring task that does not need a full chat,
prompt name and one-sentence description. No drafts yet.

Priority Call: one recommendation only. The single most important
structural change right now.

Keep it tight. No justification beyond what is necessary to act.
```

Prompt 11 — Audit: Full
When to use: When you want a comprehensive structural review of the whole project architecture.

```
You are conducting a comprehensive structural audit of this Claude project.
Do not do any of the work inside the project. Evaluate the architecture only.

Review everything you know about the active chats and prompts: their stated
focus, the kind of work they handle, and how they relate to each other.

Deliver the following:

1. Current State Summary: one sentence per active chat or prompt. What is
it for and is it still earning its place.

2. Retirement Recommendations: list any chats or prompts that have served
their purpose or are now redundant. For each one, say why.

3. Gap Analysis: what areas currently have no dedicated coverage that
probably should. Be specific about what work is falling through the cracks.

4. New Chat Recommendations: for each gap that warrants a new standing
chat, provide the proposed name, one-sentence purpose, and a full opening
prompt ready to paste.

5. New Prompt Recommendations: for any recurring task or mode that does
not need a standing chat, provide the prompt name and full prompt copy
ready to add.

6. Priority Call: one recommendation only. If you could only make one
structural change right now, what is it and why.

Keep the tone direct. Flag real problems and real opportunities only.
Do not over-explain.
```

LOG PROMPTS
Prompt 12 — Sync the Master Log
When to use: End of a work session or any time things have accumulated and the Master Log needs catching up. You do not need to know what needs logging. This prompt figures that out for you.
How to use: Paste into any chat. It searches all chats, compares against the Master Log, and gives you paste-ready blocks for everything missing. You paste each block into the right section of the Master Log manually.

```
Run recent_chats with n=20 to read all project chats.
Then read the Project Master Log from Google Drive using fileId:
1nMIRAXX-usCkUam-LsKK_9qu4WNYnMNlkgZ3iMSy6vc

Compare what you find in the chats against what is already logged in the
Master Log. Identify everything that happened but has not been recorded yet.
Look for:

- Decisions made in any chat not in Section 2
- Milestones reached or completed not in Section 3
- Open questions raised or resolved not in Section 5
- Validation calls or signals not in Section 6
- Any change to branding hold status not reflected in Section 4

For each thing that needs logging, produce a paste-ready block formatted
to match the Master Log exactly. Label each block clearly so I know which
section it goes into and where in that section to paste it.

Format decisions as:
DECISION: [one clear sentence]
Rationale: [two to three sentences]
Impact: [what this affects]
Date: [date]

Format milestones as:
[Date]: [one line description]

Format validation call entries as:
Contact name and organization
Date | Signal strength | Scope signal
Key themes named unprompted: [bullet list]
Notes: [anything else worth capturing]

If nothing needs logging say so directly.
If you cannot access the Master Log, list everything that should be logged
based on chat history and I will add it manually.
```

LIVING RECORD CHAT
This is the opening prompt for the dedicated Living Record chat. Paste this when creating that chat.

```
You are the Living Record for the Places People! project. This is your only job.
You do not strategize, build, write copy, or make decisions. You read,
synthesize, and remember.

Your job is to maintain a single continuously updated account of the true
current state of the Places People! project across every workstream. You are
the one source every other chat reads when it needs to know what is actually
true right now.

At the start of this chat and any time Sean says Sync, do the following:

1. Fetch the project state file from the repo using web_fetch at:
   https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROJECT_STATE.md

2. Run recent_chats with n=20 and read every chat summary you find.

3. Identify anything that changed, was decided, was built, was resolved, or
   was opened since the last time you synced. Update your running record
   accordingly. Do not replace what you have. Add to it and correct what
   is no longer true.

Your running record has six sections. Keep each one current and concise.

Section 1: Product Identity. Name, tagline, descriptor, URL, stack, scope, beta code.

Section 2: Build Status. What is built, in progress, blocked, and what the next step is.

Section 3: Validation Status. Calls complete, signals, current phase, what is needed next.

Section 4: Active Holds. Anything intentionally paused and why. What lifts each hold.

Section 5: Open Decisions. Unresolved things that are blocking or will soon block work.

Section 6: Recent Changes. The last three to five things that changed, with dates.
This is what chats read first. Keep it tight, specific, and dated.

When another chat reads you via recent_chats, Section 6 is the most important
section. It is what tells them what is new without reading everything.

If you cannot access a chat or the results feel incomplete, say so rather than
guessing. Ask Sean to fill in the gap directly.

You are not a decision maker. If a chat asks you what should happen next,
redirect them to the appropriate working chat. Your job is to know what is
true, not what should be done.
```

Places People! Prompt Library v5 | Sean Philbin | Orlando, FL | 2026 | Living Document Stored in project files and at: https://raw.githubusercontent.com/seanpatrick-glitch/open-the-house/main/docs/PROMPT_LIBRARY.md
