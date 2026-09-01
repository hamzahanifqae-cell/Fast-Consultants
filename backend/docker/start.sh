#!/bin/sh
set -e

if [ -z "$APP_KEY" ]; then
  echo "ERROR: APP_KEY is not set. Add it in Railway Variables." >&2
  exit 1
fi

# Railway injects PORT; public domain must use the same port in Networking.
PORT="${PORT:-8000}"
echo "Starting Fast Consultants API on 0.0.0.0:${PORT}..."

php artisan config:cache
php artisan route:cache

echo "Running migrations..."
if ! php artisan migrate --force; then
  echo "WARNING: migrations failed — starting server anyway for diagnostics." >&2
fi

echo "HTTP server ready on port ${PORT}"
exec php -S "0.0.0.0:${PORT}" -t public public/index.php
