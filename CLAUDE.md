# Places People! — rules for Claude Code

Source of truth for status and decisions: `docs/PROJECT_STATE.md`. Read Section 3 before any People module work.

## Locked architecture
- People **Group** (Company / Your People / Collaborators) and **Role** (Admin / Department Head / base-level) are separate fields. Never merge them; never derive one from the other. Routing uses Role only.
- Role and org membership live at `users/{uid}.organizations[orgId]`. Only the Cloud Functions `acceptInvite`, `setMemberRole` and `revokeMember` write them. Never write a role from the client; `firestore.rules` blocks it.
- A user can belong to several orgs. Add or remove one org at a time; never overwrite the `organizations` map.
- Role list: `src/models/roles.js`, mirrored by `functions/roles.js`. Keep them in sync.

## Before pushing changes to roles, invites, or rules
Run `npm run test:roles` (Firebase emulators; needs Java 11+ and `npm install` in the root and `functions/`).
