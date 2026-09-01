#!/usr/bin/env bash
# Serve the API with upload limits that match Laravel validation (10 MB files).
set -euo pipefail
cd "$(dirname "$0")"
exec php \
  -d upload_max_filesize=20M \
  -d post_max_size=25M \
  artisan serve --host=127.0.0.1 --port=8000 "$@"
