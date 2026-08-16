# Data Model Architecture Proposal: Departments, Productions, Venues, Tasks
> Date: 2026-08-03
> Status: Discussion document. No code or schema has been changed. This is planning only.
> Prompted by: Sean's architecture question following the 2026-08-04 UI audit re-run, which found that Departments, Productions, Venues, and Tasks don't currently connect to each other in the ways the product's own design intends.

---

## Purpose of this doc

This isn't a bug list. It's a "let's think this through before building it" conversation, written down. Sean's instinct is that the siloing the audit found isn't just a wiring gap to patch — it might be evidence that the underlying relationship model itself needs a decision, not just a fix. This doc grounds that conversation in exactly what's built today, gives direct feedback on his proposed model, and lays out a concrete structural approach that stays simple by default while allowing real flexibility.

---

## Part 1: What's actually there today

Before reacting to any proposal, here's the ground truth — read directly from the current code, not assumed.

**Department** is its own freestanding record. It has a name and a department head. That's it. It does not reference a venue, a production, or anything else. A department today cannot be told "you belong to this venue" or "you belong to this production" — there's no field for it, in the data or in the "create a department" form.

**Venue** (called "Place" in the code) is also close to bare — a name, and that's essentially it. No department reference, no production reference.

**Production**, on the other hand, is *not* freestanding — every production is created underneath a specific venue. This isn't a loose reference field that could be empty; it's baked into how the record is stored (a production physically lives "inside" its venue's record, the way a folder lives inside another folder). A production cannot exist without a venue. This already matches Sean's instinct that venue is an attribute of production, not a separate thing to track — the app already treats it that way for productions. It's just that the same idea was never extended to tasks.

Worth flagging as a small pre-existing wrinkle, not something Sean's proposal creates: the venue a production belongs to is currently stored in *two* places on the production record under two different names (`placeId` and `venueId`, both holding the same value). Minor, low-stakes, but worth cleaning up rather than adding a third way to say the same thing.

**Task** has a real, working relationship to Department — every task is either org-wide or scoped to one specific department. That part functions correctly. But a task's relationship to Production is a field that exists on paper and nowhere else: every single task gets created with that field permanently empty, there's no way to set it in the task creation screen, and the timeline view even has a little "Production linked" tag sitting in the code waiting to display something that can never happen, because nothing ever fills it in.

**Person Type** and **Person** (individual people/artists/volunteers) can already, today, be linked directly to a specific production or a specific venue — that mechanism exists and works. What's missing is the department side of that same picture (a separate, narrower problem — see the "what this doc is not" note at the end).

### The one-paragraph summary of where things actually stand

Department and Production/Venue are not "over-connected" — they're **not connected at all**, in either direction. Departments have no idea what productions or venues exist. Productions and venues have no idea what departments exist. Tasks have a working link to department, and a completely inert, never-populated link to production. So the "siloing" the audit found isn't the result of the app forcing too rigid a relationship — it's the result of a relationship that was designed to exist (the field is right there in the schema) but was never actually wired up.

That distinction matters for what comes next.

---

## Part 2: Direct feedback on the proposed model

Sean, taking your points one at a time, and being straight about where I'd push back:

### "Departments shouldn't be forced to relate to both a production and a venue"

**This is correct, but it's not actually a change from today** — departments already don't relate to either one, in the current build. What you're describing isn't loosening an over-strict rule; it's a design principle for how to build the connection that doesn't exist yet, so that when it does get built, it doesn't accidentally become the over-strict thing you're worried about. Worth naming clearly so we're solving the right problem: the risk isn't "the current model is too rigid," it's "the natural, easy way to build this next *would* make it too rigid if we're not careful." Your instinct here is the right guardrail for the next step, even though the diagnosis of how we got here is slightly different than "everything's forced through department."

### "Tasks should primarily attach to production, and venue is just an attribute of production, not a separate axis"

**This is right, and it's already how the app treats production-and-venue everywhere else.** A production is already always tied to exactly one venue by construction. If a task is tied to a production, the venue comes along for free — there's no reason to ever ask "which venue is this task for" separately from "which production is this task for." Building a separate venue field on tasks would just be a second way to answer a question the production link already answers, and this codebase already has a couple of those redundant-duplicate-field situations (the `placeId`/`venueId` thing on productions I flagged above, and one on the production's own date fields). I'd actively avoid adding a third. One link — task to production — covers both.

### "Some departments (marketing) need production, some (custodial) don't need either, even though real life ties custodial to productions"

**Here's my honest pushback, and I think it's a useful refinement, not a disagreement.** I don't think the right way to say this is "custodial's *department* doesn't need a production link." I think what you're actually describing is that custodial's *tasks* are a mix — some genuinely aren't tied to any specific show ("replace the mop," "quarterly deep clean"), and some absolutely are ("clean the green room before Friday's opening"). If the data model says "custodial doesn't relate to productions," you lose the second kind of task from ever showing up when someone asks "what needs to happen before Friday's show" — even though in real life, that's exactly the kind of thing a stage manager would want on that list.

So I'd reframe it one level down from where you put it: it's not that *departments* have variable relationships to production — it's that *individual tasks* have an optional relationship to production, and different departments will naturally end up using that option at different rates. Marketing's tasks will almost always have it filled in, because that's what marketing work looks like. Custodial's will be a mix. Nobody has to configure this difference anywhere — it just falls out of how each department actually works, task by task. This is a small shift in where the flexibility lives, but it changes the whole shape of the solution — see Part 3.

### One thing you didn't raise, that's worth naming honestly as a trade-off, not a hidden gotcha

If the production link on a task is optional and nobody's required to fill it in, some departments will be diligent about it and some won't — which means a report like "show me everything happening before Friday's show, across every department" will only be as complete as however consistently people actually used the link. There's no fully automatic way to close that gap without either making the field mandatory (which you don't want) or accepting that it's a "garbage in, garbage out" situation for departments that don't bother. I don't think this kills the idea — I think it's just worth you knowing that's the actual cost of the flexibility you're asking for, not something a clever default fully solves. Part 3 includes a default that reduces this, but doesn't eliminate it.

---

## Part 3: A concrete structural approach

Goal, restated in your words: simple and low-friction for a brand-new org that just wants to get started, real flexibility for orgs whose departments genuinely work differently — without a configuration screen that asks Sean (or an org admin) to define rules for every department up front.

**The core move: put the optional connection on the Task, not on the Department.**

Concretely: give every task one new, always-optional field — "which production is this for" (using the exact same "venue-plus-production" reference the app already uses elsewhere for the org's "currently active production" setting, so this isn't a new pattern, it's reusing one that's already proven in the codebase). Leave it blank by default. Nothing about Department, Venue, or Production changes shape — no new required fields anywhere, no new relationships between those three at all. Department stays exactly what it is today: a "who" — a team and its head. Production stays a "when and where" that already fully includes its venue. The only new thing is a single optional bridge on the one entity that actually needs to answer both questions at once: a task.

**Why this gets you the flexibility without a configuration screen:**

- Marketing creates a task, links it to Winter Minifest. Custodial creates "replace the mop," doesn't link it to anything — it's not for a specific show, and there's nothing forcing them to pretend otherwise. Custodial creates "clean the green room before opening," links it to Winter Minifest, same as marketing would.
- Nobody defined a rule anywhere that says "marketing requires production, custodial doesn't." The difference just shows up naturally, task by task, because the option exists uniformly and different work uses it differently. That's the whole mechanism — no per-department settings, no admin decision tree, no mode-switching.
- A brand-new, single-show org (Theatre Winter Haven doing one production at a time) can go through an entire season and functionally never notice this field exists, if they don't need it — there's only ever one production anyway, so there's rarely a reason to filter by it.

**The one piece of "smart default" worth adding, to reduce the trade-off named above:**

The app already has a concept of "the org's current active production" (used today to drive the admin and department-head dashboards). When someone creates a task, that field could default to whatever the org's current active production is, instead of defaulting to blank — still fully optional, still one click to clear it or point it somewhere else, but it means most tasks get linked *without anyone having to actively remember to do it*. This meaningfully narrows the "garbage in, garbage out" risk from Part 2 without adding a single new decision for anyone to make during normal use. It only becomes a real choice at all for orgs juggling more than one production at once — which is exactly the situation where the choice actually matters.

**What this deliberately does NOT do, and why that's the right call for now:**

- It does not give Department a required or even optional link to Production or Venue. If a real need shows up later for "this department only exists for one specific event" (a guest-services team hired for one festival weekend, say), that's a genuinely different idea — a production-scoped department — and it deserves its own conversation later, once there's a real org asking for it. Building it speculatively now is exactly the kind of complexity you said you want to avoid.
- It does not add a separate venue field to tasks. Venue comes for free through whichever production a task is linked to, the same way it already does everywhere else in the app.
- It does not touch how Person Types or People relate to productions and venues — that part already works today and isn't part of this problem.

---

## A note on scope: what this doc is not solving

The audit also found that Departments and People/Person Types don't connect to each other properly — specifically, the Departments page shows a "0 people" count on every card because nothing ever creates the kind of link that count depends on, and a Department Head's "message the department" feature can't actually reach the artists and volunteers in that department because the same underlying link is missing on the people side.

That's a real problem, but it's a **narrower, more mechanical one** than what this doc is about — it's closer to "finish wiring up a connection the app already has 90% of the pieces for" than "decide how a whole relationship model should work." I'd treat it as separate follow-up work, not because it doesn't matter, but because folding it into this conversation risks exactly the kind of scope creep you explicitly said you want to avoid. Worth its own short, focused fix once you're ready, but it doesn't need to wait on anything decided in this doc, and this doc doesn't need to solve it.

---

## Summary, if you want the two-sentence version

The current siloing isn't the model being too strict — it's the model being unfinished; Department, Venue, and Production genuinely don't talk to each other at all right now. The fix that matches what you're describing is to add one optional link from Task to Production (which already carries venue for free), default it sensibly from the org's active production, and leave Department, Venue, and Production themselves exactly as simple as they are today — no per-department configuration, no new required relationships, no second axis for venue.
