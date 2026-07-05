---
name: Recurring local/origin main divergence on release pushes
description: git push origin main gets rejected as non-fast-forward on nearly every EXE release; how to resolve safely
---

Local `main` and `origin/main` have diverged repeatedly across releases (seen at
v2.4.64, v2.4.67, and others). A plain `git push origin main` is rejected as
non-fast-forward because origin has commits (often small chore/vercel-email
fixes or parallel session merges) that never made it into the local branch.

**Why:** unclear root cause — likely multiple sessions/subrepl branches pushing
to the same GitHub repo independently. Not something to "fix" by force-pushing;
history must be reconciled, not discarded.

**How to apply:**
1. Before pushing on a release task, always `git fetch origin main` first and
   diff `HEAD` vs `origin/main` — don't assume a clean push will succeed.
2. If diverged, `git merge origin/main` (do not rebase, do not force-push —
   matches the pattern already used in this repo's history, e.g. "Merge
   origin/main into main (reconcile divergent history for vX.X.X push)").
3. Expect conflicts in the version-bump files:
   `artifacts/desktop/package.json` (`version` field) and
   `artifacts/erp/src/components/Layout.tsx` (version label string) — resolve
   by keeping the version number the *current* release task specifies, not
   whichever side git picks.
4. Binary asset conflicts (e.g. `artifacts/erp/public/opengraph.jpg`) can't be
   diffed — check `git log -- <file>` on both branches; if the same feature
   commit touched it on both sides, keeping `--ours` is normally safe.
5. Commit the merge, then push `main`, then create/push the release tag last
   (tag must point at the merge commit, not the pre-merge commit).
