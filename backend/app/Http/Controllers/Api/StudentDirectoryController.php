<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\ConsultantSummaryResource;
use App\Http\Resources\StudentProfileResource;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\StudentProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StudentDirectoryController extends Controller
{
    public function __construct(
        private readonly StudentProgressService $progressService,
    ) {
    }

    public function index(): AnonymousResourceCollection
    {
        $students = User::role(Role::Student)
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return ConsultantSummaryResource::collection($students);
    }

    public function progress(): JsonResponse
    {
        return response()->json([
            'data' => $this->progressService->allStudents(),
        ]);
    }

    public function show(User $student): JsonResponse
    {
        abort_unless($student->hasRole(Role::Student), 404);

        $profile = StudentProfile::query()->firstOrCreate([
            'user_id' => $student->id,
        ]);
        $profile->load('user');

        return response()->json([
            'data' => [
                'id' => $student->id,
                'profile' => StudentProfileResource::make($profile)->resolve(),
            ],
        ]);
    }
}
