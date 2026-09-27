#!/bin/sh
set -eu

: "${APP_KEY_SECRET:?APP_KEY_SECRET must be set}"
export APP_KEY="base64:${APP_KEY_SECRET}"

php artisan migrate --force
