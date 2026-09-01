<?php

namespace Database\Seeders;

use App\Enums\Permission;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\Department;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Demo org credentials (password for all: password):
     * - student@example.com
     * - superadmin@example.com
     * - admin@example.com
     * - consultant@example.com (legacy admin alias)
     * - universities@example.com
     * - finance@example.com
     * - student_info@example.com
     * - visa@example.com
     * - interview@example.com
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        $student = User::query()->updateOrCreate(
            ['email' => 'student@example.com'],
            [
                'name' => 'Demo Student',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'staff_department' => null,
            ],
        );
        $student->syncRoles([Role::Student]);
        StudentProfile::query()->firstOrCreate(['user_id' => $student->id]);

        $superAdmin = User::query()->updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'staff_department' => null,
            ],
        );
        $superAdmin->syncRoles([Role::SuperAdmin]);
        $superAdmin->syncPermissions(
            collect(Permission::cases())->map->value->all(),
        );

        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Demo Admin',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'staff_department' => null,
            ],
        );
        $admin->syncRoles([Role::Admin]);
        $admin->syncPermissions(
            collect(Permission::assignableBySuperAdmin())->map->value->all(),
        );

        // Legacy consultant account → treated as admin for mobile compatibility.
        $consultant = User::query()->updateOrCreate(
            ['email' => 'consultant@example.com'],
            [
                'name' => 'Demo Consultant',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'staff_department' => null,
            ],
        );
        $consultant->syncRoles([Role::Admin, Role::Consultant]);
        $consultant->syncPermissions(
            collect(Permission::assignableBySuperAdmin())->map->value->all(),
        );

        foreach (StaffDepartment::cases() as $department) {
            $staff = User::query()->updateOrCreate(
                ['email' => $department->value.'@example.com'],
                [
                    'name' => $department->label().' Staff',
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                    'staff_department' => $department,
                ],
            );
            $staff->syncRoles([Role::Staff]);
            $staff->syncPermissions(
                collect($department->defaultPermissions())->map->value->all(),
            );
        }

        foreach (['Student Department', 'Finance Department', 'Visa Department'] as $name) {
            Department::query()->firstOrCreate(
                [
                    'consultant_id' => $consultant->id,
                    'slug' => Str::slug($name),
                ],
                [
                    'name' => $name,
                    'is_active' => true,
                ],
            );
        }
    }
}
