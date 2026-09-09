<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\ChatConversation;
use App\Models\ChatScheduledMessage;
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
        $visa = $this->makeStaff('visa@example.com', StaffDepartment::Visa, 'File Making Staff');

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

    public function test_a_block_from_one_staff_blocks_student_from_all_departments(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');

        Sanctum::actingAs($student);
        $financeChat = $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
            'message' => 'Hello finance',
        ])->assertCreated();

        $financeId = $financeChat->json('data.conversation.id');

        Sanctum::actingAs($finance);
        $this->postJson("/api/chat/conversations/{$financeId}/block")
            ->assertOk()
            ->assertJsonPath('data.conversation.is_blocked', true);

        Sanctum::actingAs($student);

        $this->postJson("/api/chat/conversations/{$financeId}/messages", [
            'body' => 'Still trying',
        ])->assertForbidden();

        $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Visa->value,
            'message' => 'Hello visa',
        ])->assertForbidden();

        $this->getJson("/api/chat/conversations/{$financeId}/messages")
            ->assertOk()
            ->assertJsonPath('data.conversation.is_blocked', true);

        Sanctum::actingAs($finance);
        $this->getJson('/api/chat/blocks')
            ->assertOk()
            ->assertJsonPath('data.0.student_id', $student->id)
            ->assertJsonPath('data.0.student.name', 'Sara');

        $this->deleteJson("/api/chat/blocks/{$student->id}")
            ->assertOk()
            ->assertJsonPath('data.unblocked', true);

        Sanctum::actingAs($student);
        $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Visa->value,
            'message' => 'Hello visa',
        ])
            ->assertCreated()
            ->assertJsonPath('data.conversation.is_blocked', false);
    }

    public function test_staff_can_start_and_message_each_other_privately(): void
    {
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');
        $visa = $this->makeStaff('visa@example.com', StaffDepartment::Visa, 'Visa Staff');
        $student = User::factory()->student()->create(['name' => 'Sara']);

        Sanctum::actingAs($finance);

        $directory = $this->getJson('/api/chat/staff/directory')
            ->assertOk()
            ->assertJsonFragment(['email' => 'visa@example.com']);

        $this->assertFalse(
            collect($directory->json('data'))->contains(fn (array $row) => $row['email'] === 'finance@example.com'),
        );

        $start = $this->postJson('/api/chat/staff/conversations', [
            'peer_user_id' => $visa->id,
            'message' => 'Can you check this file?',
        ])
            ->assertCreated()
            ->assertJsonPath('data.conversation.kind', 'staff_dm')
            ->assertJsonPath('data.conversation.other_user.name', 'Visa Staff')
            ->assertJsonPath('data.messages.0.body', 'Can you check this file?');

        $conversationId = $start->json('data.conversation.id');

        Sanctum::actingAs($visa);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.kind', 'staff_dm')
            ->assertJsonPath('data.0.other_user.name', 'Finance Staff');

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->postJson("/api/chat/conversations/{$conversationId}/messages", [
            'body' => 'Yes, looking now.',
        ])->assertCreated();

        Sanctum::actingAs($student);
        $this->getJson('/api/chat/conversations')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/chat/conversations/{$conversationId}/messages")->assertForbidden();
        $this->getJson('/api/chat/staff/directory')->assertForbidden();

        Sanctum::actingAs($finance);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.message', 'New message from Visa Staff: Yes, looking now.');

        // Starting again reuses the same DM thread.
        $this->postJson('/api/chat/staff/conversations', [
            'peer_user_id' => $visa->id,
        ])
            ->assertCreated()
            ->assertJsonPath('data.conversation.id', $conversationId);
    }

    public function test_staff_can_broadcast_to_selected_students(): void
    {
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');
        $sara = User::factory()->student()->create(['name' => 'Sara']);
        $ali = User::factory()->student()->create(['name' => 'Ali']);
        $blocked = User::factory()->student()->create(['name' => 'Blocked']);

        $this->seedStudentThread($blocked, StaffDepartment::Finance);

        Sanctum::actingAs($finance);
        $blockedConversationId = ChatConversation::query()
            ->where('student_id', $blocked->id)
            ->where('department', StaffDepartment::Finance)
            ->value('id');
        $this->postJson("/api/chat/conversations/{$blockedConversationId}/block")
            ->assertOk();

        Sanctum::actingAs($finance);
        $broadcast = $this->postJson('/api/chat/broadcast', [
            'student_ids' => [$sara->id, $ali->id, $blocked->id],
            'message' => 'Fee reminder for everyone.',
            'department' => StaffDepartment::Visa->value,
        ])
            ->assertCreated()
            ->assertJsonPath('data.sent_count', 2)
            ->assertJsonPath('data.skipped_blocked_count', 1)
            ->assertJsonPath('data.department', 'finance');

        $this->assertCount(2, $broadcast->json('data.conversation_ids'));

        Sanctum::actingAs($sara);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.department', 'finance')
            ->assertJsonPath('data.0.last_message.body', 'Fee reminder for everyone.');

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        Sanctum::actingAs($ali);
        $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->assertJsonPath('data.0.last_message.body', 'Fee reminder for everyone.');

        Sanctum::actingAs($blocked);
        $conversations = $this->getJson('/api/chat/conversations')
            ->assertOk()
            ->json('data');
        $this->assertFalse(
            collect($conversations)->contains(
                fn (array $row) => ($row['last_message']['body'] ?? null) === 'Fee reminder for everyone.',
            ),
        );
    }

    public function test_student_cannot_broadcast_and_admin_must_pick_department(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $peer = User::factory()->student()->create(['name' => 'Ali']);
        $admin = User::factory()->create([
            'name' => 'Demo Admin',
            'email' => 'admin@example.com',
        ]);
        $admin->assignRole(Role::Admin);

        Sanctum::actingAs($student);
        $this->postJson('/api/chat/broadcast', [
            'student_ids' => [$peer->id],
            'message' => 'Nope',
        ])->assertForbidden();

        Sanctum::actingAs($admin);
        $this->postJson('/api/chat/broadcast', [
            'student_ids' => [$student->id],
            'message' => 'Need a department',
        ])->assertStatus(422);

        $this->postJson('/api/chat/broadcast', [
            'student_ids' => [$student->id],
            'message' => 'Admin notice',
            'department' => StaffDepartment::Interview->value,
        ])
            ->assertCreated()
            ->assertJsonPath('data.sent_count', 1)
            ->assertJsonPath('data.department', 'interview');
    }

    public function test_staff_can_send_message_with_attachment(): void
    {
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');
        $student = User::factory()->student()->create(['name' => 'Sara']);

        Sanctum::actingAs($student);
        $conversationId = (int) $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
            'message' => 'Hello',
        ])->assertCreated()->json('data.conversation.id');

        Sanctum::actingAs($finance);
        $file = \Illuminate\Http\UploadedFile::fake()->create('clip.mp4', 240, 'video/mp4');

        $this->post("/api/chat/conversations/{$conversationId}/messages", [
            'body' => 'Watch this',
            'attachment' => $file,
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.message.body', 'Watch this')
            ->assertJsonPath('data.message.attachment.name', 'clip.mp4');

        $messageId = (int) $this->post("/api/chat/conversations/{$conversationId}/messages", [
            'body' => '',
            'attachment' => \Illuminate\Http\UploadedFile::fake()->create('note.pdf', 80, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.message.id');

        $this->get("/api/chat/messages/{$messageId}/attachment")
            ->assertOk();

        Sanctum::actingAs($student);
        $this->getJson("/api/chat/conversations/{$conversationId}/messages")
            ->assertOk()
            ->assertJsonPath('data.messages.2.attachment.name', 'note.pdf');
    }

    public function test_staff_can_schedule_message_and_student_cannot(): void
    {
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');
        $student = User::factory()->student()->create(['name' => 'Sara']);

        Sanctum::actingAs($student);
        $conversationId = (int) $this->postJson('/api/chat/conversations', [
            'department' => StaffDepartment::Finance->value,
            'message' => 'Hello',
        ])->assertCreated()->json('data.conversation.id');

        Sanctum::actingAs($student);
        $this->postJson("/api/chat/conversations/{$conversationId}/messages", [
            'body' => 'Later',
            'scheduled_at' => now()->addHour()->toIso8601String(),
        ])->assertStatus(422);

        Sanctum::actingAs($finance);
        $this->postJson("/api/chat/conversations/{$conversationId}/messages", [
            'body' => 'Scheduled note',
            'scheduled_at' => now()->addHour()->toIso8601String(),
        ])
            ->assertCreated()
            ->assertJsonPath('data.scheduled', true);

        $this->assertDatabaseHas('chat_scheduled_messages', [
            'conversation_id' => $conversationId,
            'body' => 'Scheduled note',
            'status' => 'pending',
        ]);

        $this->assertDatabaseMissing('chat_messages', [
            'conversation_id' => $conversationId,
            'body' => 'Scheduled note',
        ]);
    }

    public function test_due_scheduled_message_is_sent_when_chat_is_polled(): void
    {
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance, 'Finance Staff');
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $conversationId = $this->seedStudentThread($student, StaffDepartment::Finance);

        ChatScheduledMessage::query()->create([
            'sender_id' => $finance->id,
            'type' => ChatScheduledMessage::TYPE_CONVERSATION,
            'conversation_id' => $conversationId,
            'body' => 'Due soon',
            'scheduled_at' => now()->subMinute(),
            'status' => ChatScheduledMessage::STATUS_PENDING,
        ]);

        Sanctum::actingAs($finance);
        $this->getJson("/api/chat/conversations/{$conversationId}/messages")
            ->assertOk()
            ->assertJsonFragment(['body' => 'Due soon']);

        $this->assertDatabaseHas('chat_scheduled_messages', [
            'conversation_id' => $conversationId,
            'body' => 'Due soon',
            'status' => 'sent',
        ]);

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $finance->id,
            'type' => 'chat_scheduled_sent',
            'conversation_id' => $conversationId,
        ]);
    }

    private function seedStudentThread(User $student, StaffDepartment $department): int
    {
        Sanctum::actingAs($student);
        $start = $this->postJson('/api/chat/conversations', [
            'department' => $department->value,
            'message' => 'Hello',
        ])->assertCreated();

        return (int) $start->json('data.conversation.id');
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
