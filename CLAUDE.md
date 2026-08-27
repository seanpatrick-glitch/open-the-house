# Workflow

Open a pull request for every change instead of pushing straight to `main`, even
small fixes. Push commits to a session/feature branch, open a PR against `main`
with a summary of what changed and why, and wait for Sean to review and merge it
himself — don't merge your own PRs.

This matters here specifically because `.github/workflows/firebase-deploy.yml`
auto-deploys on every push to `main`. A PR is the pause before that happens, and
it leaves a paper trail (diff, description, timestamp) of what shipped and why —
decided 2026-08-27.
