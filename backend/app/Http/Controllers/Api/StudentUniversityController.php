<?php

namespace App\Http\Controllers\Api;

use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Resources\UniversityResource;
use App\Models\University;
use App\Models\User;
use App\Services\DepartmentHandoffService;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class StudentUniversityController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
        private readonly DepartmentHandoffService $handoffs,
    ) {
    }

    public function index(Request $request, User $student): AnonymousResourceCollection
    {
        $this->assertUniversitiesStaff($request);
        abort_unless($student->isStudent(), 404);

        $universities = $student->assignedUniversities()
            ->with(['requiredDocuments', 'consultant:id,name,email'])
            ->latest('student_university.created_at')
            ->get();

        return UniversityResource::collection($universities);
    }

    public function store(Request $request, User $student): JsonResponse
    {
        $this->assertUniversitiesStaff($request);
        abort_unless($student->isStudent(), 404);

        abort_unless(
            $this->handoffs->documentsApproved($student),
            422,
            'Student Info has not approved all of this student\'s documents yet.',
        );

        $validated = $request->validate([
            'university_id' => ['required', 'integer', Rule::exists('universities', 'id')],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $university = University::query()->findOrFail($validated['university_id']);

        $student->assignedUniversities()->syncWithoutDetaching([
            $university->id => [
                'assigned_by' => $request->user()->id,
                'notes' => $validated['notes'] ?? null,
            ],
        ]);

        $university->load(['requiredDocuments', 'consultant:id,name,email']);

        $this->notifications->createForStudent(
            $student,
            $request->user(),
            'A university option was shared with you: '.$university->name.'.',
            'university_assigned',
            '/student-universities',
        );

        $this->handoffs->syncUniversities($student, $request->user());

        return UniversityResource::make($university)
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(Request $request, User $student, University $university): JsonResponse
    {
        $this->assertUniversitiesStaff($request);
        abort_unless($student->isStudent(), 404);

        $student->assignedUniversities()->detach($university->id);

        $this->handoffs->syncUniversities($student, $request->user());

        return response()->json([
            'message' => 'University removed from this student.',
        ]);
    }

    private function assertUniversitiesStaff(Request $request): void
    {
        abort_unless(
            $request->user()?->canWorkInDepartment(StaffDepartment::Universities),
            403,
            'Only Universities staff can share university options.',
        );
    }
}
