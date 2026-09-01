#!/bin/sh
set -e

PORT="${PORT:-8000}"
echo "Starting Fast Consultants API on port ${PORT}..."

php artisan config:cache
php artisan route:cache

echo "Running migrations..."
if ! php artisan migrate --force; then
  echo "WARNING: migrations failed — starting server anyway for diagnostics." >&2
fi

echo "HTTP server listening on 0.0.0.0:${PORT}"
exec php artisan serve --host=0.0.0.0 --port="${PORT}"
