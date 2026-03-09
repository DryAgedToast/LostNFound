#!/bin/bash
echo "Fetching latest from remote..."
git fetch origin
echo "Rebasing suvilkaushik onto latest master/main..."
git rebase origin/master 2>/dev/null || git rebase origin/main 2>/dev/null
echo "Done. Your branch is now up to date."
