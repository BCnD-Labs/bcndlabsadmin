#!/usr/bin/env bash
# After a builder run: commit, push and open the pull request, or comment on
# the issue and mark it "needs decision" (so the next button skips it) when the
# agent stopped, changed nothing, touched files it must not, or left local-only
# files in the change. Needs AGENT, ISSUE, BRANCH, GH_TOKEN (a token whose pull
# requests trigger CI) and GITHUB_REPOSITORY.
set -euo pipefail

# Files a builder may not change without Blake's approval: CI, dependencies,
# the server image and the deploy stack.
PROTECTED=(
  ".github"
  ":(glob)**/package.json"
  ":(glob)**/package-lock.json"
  "blackwall-admin/Dockerfile"
  "blackwall-admin/deploy"
)

stop() {
  gh issue comment "$ISSUE" --body "**${AGENT^} stopped and needs Blake:** $1"
  gh issue edit "$ISSUE" --add-label "needs decision"
  echo "Stopped on #$ISSUE (marked needs decision): $1" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
}

if [ -s .agent/blocked.md ]; then
  stop "$(cat .agent/blocked.md)"
fi
if [ -z "$(git status --porcelain)" ]; then
  stop "the run finished without changing any files."
fi
if [ -n "$(git status --porcelain -- "${PROTECTED[@]}")" ]; then
  git status --porcelain -- "${PROTECTED[@]}"
  stop "the change touches CI, dependencies or deploy files, which need Blake's approval first. Nothing was pushed."
fi
if [ ! -s .agent/commit-message.txt ] || [ ! -s .agent/pr-body.md ]; then
  stop "the run did not write its commit message and pull request description. Nothing was pushed."
fi
if ! guard=$(python3 .github/agents/repo_guard.py 2>&1); then
  echo "$guard"
  stop "the change includes files that must stay out of the repo. Nothing was pushed. $(echo "$guard" | tail -n +2 | head -5 | tr '\n' ' ')"
fi

git switch -q -c "$BRANCH"
git add -A
# Commit as the repo owner's account (its private GitHub noreply address) so a
# squash merge by that account adds no "Co-authored-by" lines; the <agent>/
# branch name shows which agent built it.
git -c user.name="BCnD-Labs" -c user.email="342127827+BCnD-Labs@users.noreply.github.com" \
  commit -q -F .agent/commit-message.txt
git push -q --force "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "HEAD:refs/heads/$BRANCH"
url=$(gh pr create --base main --head "$BRANCH" --title "$(head -1 .agent/commit-message.txt)" \
  --body-file .agent/pr-body.md)
echo "Opened $url" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
if grep -qi '^\*\*decision needed' .agent/pr-body.md || grep -qi '^#* *decision needed' .agent/pr-body.md; then
  gh pr edit "$url" --add-label "needs decision"
  echo "Marked it 'needs decision' for Blake (not a failure)." | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
fi
