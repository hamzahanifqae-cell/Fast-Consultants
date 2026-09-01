<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentQuestionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_a_student_can_list_consultants_and_ask_a_question(): void
    {
        $student = User::factory()->student()->create();
        $consultant = User::factory()->consultant()->create([
            'name' => 'Demo Consultant',
        ]);

        Sanctum::actingAs($student);

        $this->getJson('/api/consultants')
            ->assertOk()
            ->assertJsonPath('data.0.id', $consultant->id)
            ->assertJsonPath('data.0.name', 'Demo Consultant');

        $response = $this->postJson('/api/questions', [
            'consultant_id' => $consultant->id,
            'subject' => 'Visa timeline',
            'body' => 'How long does the UK student visa usually take?',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.subject', 'Visa timeline')
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.consultant.id', $consultant->id);

        $this->assertDatabaseHas('questions', [
            'student_id' => $student->id,
            'consultant_id' => $consultant->id,
            'subject' => 'Visa timeline',
        ]);
    }

    public function test_a_consultant_can_reply_and_the_student_can_see_it(): void
    {
        $student = User::factory()->student()->create();
        $consultant = User::factory()->consultant()->create();

        $question = Question::query()->create([
            'student_id' => $student->id,
            'consultant_id' => $consultant->id,
            'subject' => 'Documents',
            'body' => 'Which documents do I need?',
            'status' => 'open',
        ]);

        Sanctum::actingAs($consultant);

        $this->postJson("/api/consultant/questions/{$question->id}/replies", [
            'body' => 'Please prepare your passport and transcripts.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'answered')
            ->assertJsonPath('data.replies.0.body', 'Please prepare your passport and transcripts.');

        Sanctum::actingAs($student);

        $this->getJson("/api/questions/{$question->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'answered')
            ->assertJsonCount(1, 'data.replies');
    }

    public function test_a_student_cannot_ask_a_non_consultant(): void
    {
        $student = User::factory()->student()->create();
        $otherStudent = User::factory()->student()->create();

        Sanctum::actingAs($student);

        $this->postJson('/api/questions', [
            'consultant_id' => $otherStudent->id,
            'subject' => 'Hello',
            'body' => 'Can you help?',
        ])->assertUnprocessable();
    }

    public function test_a_student_cannot_view_another_students_question(): void
    {
        $student = User::factory()->student()->create();
        $otherStudent = User::factory()->student()->create();
        $consultant = User::factory()->consultant()->create();

        $question = Question::query()->create([
            'student_id' => $otherStudent->id,
            'consultant_id' => $consultant->id,
            'subject' => 'Private',
            'body' => 'Secret question',
            'status' => 'open',
        ]);

        Sanctum::actingAs($student);

        $this->getJson("/api/questions/{$question->id}")->assertForbidden();
    }
}
