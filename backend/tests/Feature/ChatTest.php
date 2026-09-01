<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\ChatConversation;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_student_messages_go_only_to_selected_department(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');
        $visa = $this->makeStaff('visa@example.com', StaffDepartment::Visa, 'Visa Staff');

        Sanctum::actingAs($student);

        $start = $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
            'message' => 'Hi, I need a fee invoice.',
        ]);

        $start
            ->assertCreated()
            ->assertJsonPath('data.conversation.department', 'finance')
            ->assertJsonPath('data.conversation.other_user.name', 'A/C & Finance')
            ->assertJsonPath('data.messages.0.body', 'Hi, I need a fee invoice.');

        $conversationId = $start->json('data.conversation.id');

        Sanctum::actingAs($finance);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.other_user.name', 'Sara')
            ->assertJsonPath('data.0.department', 'finance');

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->postJson("/api/chat/conversations/{$conversationId}/messages", [
            'body' => 'I will send the invoice.',
        ])->assertCreated();

        Sanctum::actingAs($visa);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson("/api/chat/conversations/{$conversationId}/messages")
            ->assertForbidden();

        Sanctum::actingAs($student);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.message', 'New message from Finance Staff: I will send the invoice.');

        Sanctum::actingAs($finance);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        Sanctum::actingAs($visa);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0);
    }

    public function test_admin_sees_all_department_conversations(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');
        $admin = User::factory()->create([
            'name' => 'Demo Admin',
            'email' => 'admin@example.com',
        ]);
        $admin->assignRole(Role::Admin);

        Sanctum::actingAs($student);
        $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
            'message' => 'Need help with fees.',
        ])->assertCreated();

        Sanctum::actingAs($student);
        $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Visa->value,
            'message' => 'Visa question.',
        ])->assertCreated();

        Sanctum::actingAs($finance);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        Sanctum::actingAs($admin);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('unread_count', 2);
    }

    public function test_unread_count_clears_when_conversation_is_opened(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');

        Sanctum::actingAs($student);
        $start = $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
            'message' => 'Hello finance',
        ])->assertCreated();

        $conversationId = $start->json('data.conversation.id');

        Sanctum::actingAs($finance);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.unread_count', 1)
            ->assertJsonPath('unread_count', 1);

        $this->getJson("/api/chat/conversations/{$conversationId}/messages")
            ->assertOk();

        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.unread_count', 0)
            ->assertJsonPath('unread_count', 0);
    }

    public function test_user_cannot_open_someone_elses_conversation(): void
    {
        $student = User::factory()->student()->create();
        $otherStudent = User::factory()->student()->create();

        $conversation = ChatConversation::query()->create([
            'student_id' => $otherStudent->id,
            'department' => StaffDepartment::Finance,
        ]);

        Sanctum::actingAs($student);

        $this->getJson("/api/chat/conversations/{$conversation->id}/messages")
            ->assertForbidden();
    }

    public function test_peer_sees_typing_indicator(): void
    {
        $student = User::factory()->student()->create();
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance);

        Sanctum::actingAs($student);

        $start = $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
        ])->assertCreated();

        $conversationId = $start->json('data.conversation.id');

        $this->postJson("/api/chat/conversations/{$conversationId}/typing", [
            'typing' => true,
        ])->assertOk();

        Sanctum::actingAs($finance);

        $this->getJson("/api/chat/conversations/{$conversationId}/messages")
            ->assertOk()
            ->assertJsonPath('data.peer_typing', true);

        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.other_user_typing', true);

        Sanctum::actingAs($student);

        $this->postJson("/api/chat/conversations/{$conversationId}/typing", [
            'typing' => false,
        ])->assertOk();

        Sanctum::actingAs($finance);

        $this->getJson("/api/chat/conversations/{$conversationId}/messages")
            ->assertOk()
            ->assertJsonPath('data.peer_typing', false);
    }

    public function test_staff_can_block_and_unblock_student_chat(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');

        Sanctum::actingAs($student);
        $start = $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
            'message' => 'Hello finance',
        ])->assertCreated();

        $conversationId = $start->json('data.conversation.id');

        Sanctum::actingAs($finance);
        $this->postJson("/api/chat/conversations/{$conversationId}/block")
            ->assertOk()
            ->assertJsonPath('data.conversation.is_blocked', true);

        Sanctum::actingAs($student);
        $this->postJson("/api/chat/conversations/{$conversationId}/messages", [
            'body' => 'Still trying',
        ])->assertForbidden();

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'chat_blocked');

        Sanctum::actingAs($finance);
        $this->deleteJson("/api/chat/conversations/{$conversationId}/block")
            ->assertOk()
            ->assertJsonPath('data.conversation.is_blocked', false);

        Sanctum::actingAs($student);
        $this->postJson("/api/chat/conversations/{$conversationId}/messages", [
            'body' => 'Back again',
        ])->assertCreated();
    }

    private function makeStaff(string $email, StaffDepartment $department, string $name = 'Staff'): User
    {
        $user = User::factory()->create([
            'name' => $name,
            'email' => $email,
            'staff_department' => $department,
        ]);
        $user->assignRole(Role::Staff);
        $user->syncPermissions(
            collect($department->defaultPermissions())->map->value->all(),
        );

        return $user->fresh();
    }
}
