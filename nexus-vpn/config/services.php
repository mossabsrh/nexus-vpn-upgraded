<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    // Production e-mail: Render's free tier blocks outbound SMTP, so mail goes through Brevo's HTTP API.
    'brevo' => [
        'key' => env('BREVO_API_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'chargily' => [
        'mode' => env('CHARGILY_MODE', 'test'),
        'secret_key' => env('CHARGILY_SECRET_KEY'),
        // Optional: overrides the dashboard webhook endpoint per checkout (useful for a local tunnel).
        'webhook_url' => env('CHARGILY_WEBHOOK_URL'),
    ],

    /*
    | WireGuard gateway that issued client configs connect to. Peers are exported
    | to the gateway with `php artisan vpn:peers`.
    */
    'vpn' => [
        'server_public_key' => env('VPN_SERVER_PUBLIC_KEY'),
        'endpoint' => env('VPN_SERVER_ENDPOINT'),
        'dns' => env('VPN_DNS', '1.1.1.1'),
        'allowed_ips' => env('VPN_ALLOWED_IPS', '0.0.0.0/0, ::/0'),
        'address_pool' => env('VPN_ADDRESS_POOL', '10.66.0.0/16'),
        'client_prefix' => (int) env('VPN_CLIENT_PREFIX', 32),
    ],

    'frontend_url' => env('FRONTEND_URL') ?: 'https://nexus-vpn-upgraded.vercel.app',

];
