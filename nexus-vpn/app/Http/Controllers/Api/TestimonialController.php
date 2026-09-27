<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Testimonial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TestimonialController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'testimonials' => Testimonial::query()
                ->with('user:id,name')
                ->latest()
                ->get()
                ->map(fn (Testimonial $testimonial) => [
                    'id' => $testimonial->id,
                    'content' => $testimonial->content,
                    'name' => $testimonial->user->name,
                    'createdAt' => $testimonial->created_at->toISOString(),
                ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'min:10', 'max:1000'],
        ]);

        $testimonial = $request->user()->testimonials()->create($validated);
        $testimonial->load('user:id,name');

        return response()->json([
            'testimonial' => [
                'id' => $testimonial->id,
                'content' => $testimonial->content,
                'name' => $testimonial->user->name,
                'createdAt' => $testimonial->created_at->toISOString(),
            ],
        ], 201);
    }
}
