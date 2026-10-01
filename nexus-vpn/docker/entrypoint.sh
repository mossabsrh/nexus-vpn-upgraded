#!/bin/sh
set -eu

if [ -z "${APP_KEY:-}" ]; then
    : "${APP_KEY_SECRET:?APP_KEY_SECRET must be set}"
    export APP_KEY="base64:${APP_KEY_SECRET}"
fi

mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

su -s /bin/sh www-data -c 'php artisan migrate --force --seed'

port="${PORT:-10000}"
sed -i "s/^Listen 80$/Listen ${port}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \\*:80>/<VirtualHost *:${port}>/" /etc/apache2/sites-enabled/000-default.conf

exec apache2-foreground
