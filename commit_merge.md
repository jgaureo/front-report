# Git Commit & Merge Guide

## Quick Reference

### Option A: Direct Push to Main (small/urgent fixes)

```bash
# 1. Make your changes, then stage and commit
git add webapp/server/index.js
git commit -m "Fix: description of what you fixed"

# 2. Push directly to main
git push
```

### Option B: Branch + PR (recommended for reviewable changes)

```bash
# 1. Create a feature branch
git checkout -b fix/short-description

# 2. Stage and commit your changes
git add webapp/server/index.js
git commit -m "Fix: description of what you fixed"

# 3. Push the branch to GitHub
git push -u origin fix/short-description
```

#### Merge via GitHub (Manual)

1. Go to the link printed in the terminal, or visit:
   `https://github.com/jgaureo/front-report/pull/new/fix/short-description`
2. Click **"Create pull request"**
3. Review the changes, then click **"Merge pull request"**
4. Sync your local main:
   ```bash
   git checkout main
   git pull
   git branch -d fix/short-description   # delete merged branch
   ```

#### Merge via Terminal (Automatic)

Requires [GitHub CLI](https://cli.github.com/) (`gh`). Install once:
```bash
winget install GitHub.cli
gh auth login
```

Then create + merge the PR entirely from terminal:
```bash
# Create the PR
gh pr create --title "Fix: short description" --body "Summary of changes"

# Merge it (after review)
gh pr merge --merge

# Sync local main
git checkout main
git pull
git branch -d fix/short-description
```

---

## Full Workflow Example

```bash
# Start from main, make sure it's up to date
git checkout main
git pull

# Create branch
git checkout -b fix/reply-time-calculation

# ... make your code changes ...

# Check what changed
git status
git diff

# Stage specific files (avoid staging secrets like .env, credentials.json)
git add webapp/server/index.js

# Commit with a descriptive message
git commit -m "Fix: Scope reply time calculations to selected date range"

# Push branch
git push -u origin fix/reply-time-calculation

# --- WITH gh CLI (automatic) ---
gh pr create --title "Fix: Reply time calculations" --body "Scoped inbound messages to date range"
gh pr merge --merge
git checkout main && git pull
git branch -d fix/reply-time-calculation

# --- WITHOUT gh CLI (manual) ---
# 1. Open the GitHub PR link from the push output
# 2. Create PR and merge on GitHub
# 3. Then locally:
git checkout main && git pull
git branch -d fix/reply-time-calculation
```

---

## Deployment Flow

After merging to `main`:
- **Backend (Render):** Auto-deploys when `main` is updated. Takes ~1-2 min.
- **Frontend (GitHub Pages):** GitHub Actions builds and deploys to `gh-pages`. Takes ~1-2 min.

No manual deployment steps needed.

---

## Useful Commands

| Command | What it does |
|---|---|
| `git status` | See changed/staged files |
| `git diff` | See unstaged changes |
| `git log --oneline -5` | See last 5 commits |
| `git branch` | List local branches |
| `git branch -d branch-name` | Delete a merged local branch |
| `git stash` | Temporarily save uncommitted changes |
| `git stash pop` | Restore stashed changes |
