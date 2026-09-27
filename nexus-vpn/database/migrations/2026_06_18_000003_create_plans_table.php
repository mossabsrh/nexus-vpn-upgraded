<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 100)->unique();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->integer('monthly_price')->nullable();
            $table->integer('yearly_price')->nullable();
            $table->integer('yearly_total')->nullable();
            $table->string('currency', 10)->default('DZD');
            $table->json('features')->nullable();
            $table->boolean('popular')->default(false);
            $table->string('cta', 100)->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('plans');
    }
};
