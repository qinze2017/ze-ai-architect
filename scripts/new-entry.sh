#!/usr/bin/env bash
set -euo pipefail

TYPE="${1:-}"
SLUG="${2:-}"

if [[ -z "$TYPE" || -z "$SLUG" ]]; then
  echo "Usage: ./scripts/new-entry.sh <posts|learning|progress|projects> <slug>"
  exit 1
fi

case "$TYPE" in
  posts|learning|progress|projects) ;;
  *) echo "Unsupported type: $TYPE"; exit 1 ;;
esac

hugo new content "$TYPE/$SLUG.md"
echo "Created content/$TYPE/$SLUG.md"
