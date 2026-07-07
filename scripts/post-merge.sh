#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push-force

git config user.email "taby.bbk@gmail.com"
git config user.name "nafybbk"

# Remove any stale lock files that can block git operations
find .git -name "*.lock" -not -name "gc.pid.lock" -not -name "maintenance.lock" -delete 2>/dev/null || true

# Stash any working-tree changes so git merge doesn't abort
git stash --include-untracked 2>/dev/null || true

# Fetch remote and merge (local changes win on conflict)
git fetch origin main
git merge --no-edit -X ours origin/main 2>/dev/null || true

# Restore any stashed changes
git stash pop 2>/dev/null || true

# Push to GitHub
git push origin main

# Auto-create and push version tag from desktop/package.json
VERSION=$(node -e "console.log(require('./artifacts/desktop/package.json').version)" 2>/dev/null || true)
if [ -n "$VERSION" ]; then
  TAG="v${VERSION}"
  # Only push tag if it doesn't already exist on remote
  if ! git ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
    git tag "$TAG" 2>/dev/null || true
    git push origin "$TAG" && echo "Tagged and pushed $TAG" || echo "Tag push failed (may already exist)"
  else
    echo "Tag $TAG already exists on remote — skipping"
  fi
fi
