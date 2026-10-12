#!/usr/bin/env bash
# SPEC-024: apply branch protection and merge settings for Futurar.
#
# Idempotent (PUT/PATCH replace the current configuration). Requires an
# authenticated `gh` with admin permission on the repository shown below.
#
# Usage: bash scripts/github-governance.sh
set -euo pipefail

REPO="${REPO:-Andersson1712/Futurar}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required (https://cli.github.com/)" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh is not authenticated (run 'gh auth login')" >&2
  exit 1
fi

echo "==> Squash-only merge settings on ${REPO}"
gh api -X PATCH "repos/${REPO}" --input - --jq \
  '{allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge, squash_merge_commit_title, squash_merge_commit_message}' <<'JSON'
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "delete_branch_on_merge": true,
  "squash_merge_commit_title": "PR_TITLE",
  "squash_merge_commit_message": "COMMIT_MESSAGES"
}
JSON

echo "==> Protecting main (PR + 1 review + checks + linear history)"
gh api -X PUT "repos/${REPO}/branches/main/protection" --input - --jq \
  '{checks: .required_status_checks.contexts, reviews: .required_pull_request_reviews, enforce_admins: .enforce_admins.enabled, linear: .required_linear_history.enabled, force_push: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled}' <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["frontend", "frontend-e2e", "backend", "commitlint"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

echo "==> Protecting dev (checks + linear history)"
gh api -X PUT "repos/${REPO}/branches/dev/protection" --input - --jq \
  '{checks: .required_status_checks.contexts, enforce_admins: .enforce_admins.enabled, linear: .required_linear_history.enabled, force_push: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled}' <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["frontend", "frontend-e2e", "backend", "commitlint"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "==> Done."
