<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('team_user', function (Blueprint $table) {
            $table->foreignId('team_id')->constrained('teams')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('role', 50)->default('member');
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['team_id','user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('team_user');
    }
};
