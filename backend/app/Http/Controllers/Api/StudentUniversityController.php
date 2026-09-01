<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UniversityResource;
use App\Models\University;
use App\Models\User;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class StudentUniversityController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
    }

    public function index(Request $request, User $student): AnonymousResourceCollection
    {
        abort_unless($request->user()?->isConsultant(), 403);
        abort_unless($student->isStudent(), 404);

        $universities = $student->assignedUniversities()
            ->with(['requiredDocuments', 'consultant:id,name,email'])
            ->latest('student_university.created_at')
            ->get();

        return UniversityResource::collection($universities);
    }

    public function store(Request $request, User $student): JsonResponse
    {
        abort_unless($request->user()?->isConsultant(), 403);
        abort_unless($student->isStudent(), 404);

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

        return UniversityResource::make($university)
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(Request $request, User $student, University $university): JsonResponse
    {
        abort_unless($request->user()?->isConsultant(), 403);
        abort_unless($student->isStudent(), 404);

        $student->assignedUniversities()->detach($university->id);

        return response()->json([
            'message' => 'University removed from this student.',
        ]);
    }
}
