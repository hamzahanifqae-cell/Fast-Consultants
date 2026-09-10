<?php

namespace Tests\Feature;

use App\Enums\LeadClassification;
use App\Enums\LeadStatus;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\Lead;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class LeadFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_public_can_submit_lead_and_heuristic_classifies(): void
    {
        $this->postJson('/api/leads', [
            'name' => 'Ayesha Khan',
            'email' => 'ayesha@example.com',
            'phone' => '+923001112233',
            'city' => 'Lahore',
            'preferred_country' => 'UK',
            'study_level' => "Master's",
            'intended_program' => 'Computer Science',
            'preferred_intake' => 'Fall',
            'intake_year' => 2026,
            'qualification' => "Bachelor's degree",
            'grade' => '3.4 / 4.0',
            'english_status' => 'Planning to Take',
            'budget_range' => '$20,000–$30,000',
            'services' => ['University Selection', 'Complete Guidance'],
            'contact_method' => 'WhatsApp',
            'source' => 'leading_page',
        ])
            ->assertCreated()
            ->assertJsonPath('data.id', 1);

        $this->assertDatabaseHas('leads', [
            'email' => 'ayesha@example.com',
            'status' => LeadStatus::Classified->value,
            'classification' => LeadClassification::Interested->value,
        ]);
    }

    public function test_leads_staff_can_convert_lead_to_student(): void
    {
        $staff = $this->makeLeadsStaff();
        $lead = Lead::query()->create([
            'name' => 'Bilal Ahmed',
            'email' => 'bilal@example.com',
            'phone' => '03001234567',
            'status' => LeadStatus::Classified,
            'classification' => LeadClassification::Interested,
            'classification_score' => 80,
            'classification_reason' => 'Strong intent',
            'classified_at' => now(),
        ]);

        Sanctum::actingAs($staff);
        $this->postJson("/api/consultant/leads/{$lead->id}/convert", [
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])
            ->assertOk()
            ->assertJsonPath('data.credentials.email', 'bilal@example.com');

        $this->assertDatabaseHas('users', [
            'email' => 'bilal@example.com',
        ]);
        $this->assertTrue(User::query()->where('email', 'bilal@example.com')->first()?->hasRole(Role::Student));
    }

    private function makeLeadsStaff(): User
    {
        $user = User::factory()->create([
            'email' => 'leads@example.com',
            'password' => Hash::make('password'),
            'staff_department' => StaffDepartment::Leads,
        ]);
        $user->assignRole(Role::Staff);
        $user->syncPermissions(
            collect(StaffDepartment::Leads->defaultPermissions())->map->value->all(),
        );

        return $user->fresh();
    }
}
