<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlansTableSeeder extends Seeder
{
    public function run()
    {
        $plans = [
            [
                'slug' => 'essential',
                'name' => 'Essential',
                'description' => 'One person, one device at a time.',
                'monthly_price' => 1119,
                'yearly_price' => 558,
                'yearly_total' => 6704,
                'features' => json_encode(['Up to 3 devices','All 87 server locations','WireGuard & OpenVPN','Zero-log policy','Kill switch','Email support']),
                'popular' => 0,
                'cta' => 'Start trial',
            ],
            [
                'slug' => 'standard',
                'name' => 'Standard',
                'description' => 'All features. Unlimited devices.',
                'monthly_price' => 1679,
                'yearly_price' => 838,
                'yearly_total' => 10063,
                'features' => json_encode(['Unlimited devices','All 87 server locations','WireGuard & OpenVPN','Zero-log policy','Kill switch','Split tunneling','DNS leak protection','Priority support']),
                'popular' => 1,
                'cta' => 'Start trial',
            ],
            [
                'slug' => 'team',
                'name' => 'Team',
                'description' => 'Centralized billing for 5–50 seats.',
                'monthly_price' => null,
                'yearly_price' => null,
                'yearly_total' => null,
                'features' => json_encode(['Everything in Standard','Centralized dashboard','Usage analytics','Dedicated IP option','SSO / SAML support','Account manager','SLA guarantee']),
                'popular' => 0,
                'cta' => 'Contact us',
            ],
        ];

        foreach ($plans as $plan) {
            DB::table('plans')->updateOrInsert(
                ['slug' => $plan['slug']],
                [
                    'name' => $plan['name'],
                    'description' => $plan['description'],
                    'monthly_price' => $plan['monthly_price'],
                    'yearly_price' => $plan['yearly_price'],
                    'yearly_total' => $plan['yearly_total'],
                    'currency' => 'DZD',
                    'features' => $plan['features'],
                    'popular' => $plan['popular'],
                    'cta' => $plan['cta'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }
}
