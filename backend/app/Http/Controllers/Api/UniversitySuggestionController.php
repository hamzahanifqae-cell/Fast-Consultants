<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentType;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Models\University;
use App\Models\UniversitySuggestion;
use App\Models\User;
use App\Services\DepartmentHandoffService;
use App\Services\StudentNotificationService;
use App\Support\StudyCountries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UniversitySuggestionController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
        private readonly DepartmentHandoffService $handoffs,
    ) {
    }

    public function countries(): JsonResponse
    {
        return response()->json([
            'data' => StudyCountries::all(),
        ]);
    }

    public function studentIndex(Request $request): JsonResponse
    {
        $student = $request->user();
        $assignedIds = $student->assignedUniversities()->pluck('universities.id');

        // Clean accepted suggestions whose university staff already removed.
        UniversitySuggestion::query()
            ->where('student_id', $student->id)
            ->where('status', 'accepted')
            ->whereNotNull('university_id')
            ->whereNotIn('university_id', $assignedIds)
            ->delete();

        $suggestions = UniversitySuggestion::query()
            ->where('student_id', $student->id)
            ->latest()
            ->get();

        return response()->json([
            'data' => $suggestions->map(fn (UniversitySuggestion $item) => $this->payload($item)),
        ]);
    }

    public function studentStore(Request $request): JsonResponse
    {
        $student = $request->user();

        $validated = $request->validate([
            'country' => ['required', 'string', Rule::in(StudyCountries::all())],
            'universities' => ['required', 'array', 'min:1', 'max:20'],
            'universities.*.name' => ['required', 'string', 'max:180'],
            'universities.*.city' => ['nullable', 'string', 'max:120'],
        ]);

        $created = [];

        foreach ($validated['universities'] as $row) {
            $name = trim($row['name']);
            $city = isset($row['city']) ? trim((string) $row['city']) : null;
            if ($city === '') {
                $city = null;
            }

            $exists = UniversitySuggestion::query()
                ->where('student_id', $student->id)
                ->where('status', 'pending')
                ->where('country', $validated['country'])
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->exists();

            if ($exists) {
                continue;
            }

            $suggestion = UniversitySuggestion::query()->create([
                'student_id' => $student->id,
                'country' => $validated['country'],
                'name' => $name,
                'city' => $city,
                'status' => 'pending',
            ]);

            $created[] = $suggestion;
        }

        if ($created !== []) {
            $names = collect($created)->pluck('name')->implode(', ');
            $this->notifications->notifyDepartment(
                StaffDepartment::Universities,
                $student,
                $student->name.' suggested universit'.(count($created) === 1 ? 'y' : 'ies').' in '.$validated['country'].': '.$names.'.',
                'university_suggested',
                '/departments/universities',
            );
        }

        $suggestions = UniversitySuggestion::query()
            ->where('student_id', $student->id)
            ->latest()
            ->get();

        return response()->json([
            'data' => $suggestions->map(fn (UniversitySuggestion $item) => $this->payload($item)),
            'added' => count($created),
        ], $created === [] ? 200 : 201);
    }

    public function studentDestroy(Request $request, UniversitySuggestion $suggestion): JsonResponse
    {
        abort_unless($suggestion->student_id === $request->user()->id, 404);
        abort_unless($suggestion->status === 'pending', 422, 'Only pending suggestions can be removed.');

        $suggestion->delete();

        return response()->json([
            'message' => 'Suggestion removed.',
        ]);
    }

    public function staffIndex(Request $request): JsonResponse
    {
        $this->assertUniversitiesStaff($request);

        $status = $request->string('status')->toString() ?: 'pending';
        abort_unless(in_array($status, ['pending', 'accepted', 'rejected', 'all'], true), 422);

        $query = UniversitySuggestion::query()
            ->with(['student:id,name,email', 'reviewer:id,name,email', 'university:id,name,country,city'])
            ->latest();

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', (int) $request->input('student_id'));
        }

        $suggestions = $query->get();

        return response()->json([
            'data' => $suggestions->map(fn (UniversitySuggestion $item) => $this->payload($item, true)),
        ]);
    }

    public function accept(Request $request, UniversitySuggestion $suggestion): JsonResponse
    {
        $this->assertUniversitiesStaff($request);
        abort_unless($suggestion->status === 'pending', 422, 'This suggestion was already reviewed.');

        $validated = $request->validate([
            'required_documents' => ['required', 'array', 'min:1'],
            'required_documents.*' => ['required', 'string', Rule::enum(DocumentType::class)],
        ]);

        $staff = $request->user();

        $suggestion = DB::transaction(function () use ($suggestion, $staff, $validated) {
            $university = University::query()
                ->where('country', $suggestion->country)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($suggestion->name)])
                ->first();

            if (! $university) {
                $university = University::query()->create([
                    'consultant_id' => $staff->id,
                    'name' => $suggestion->name,
                    'country' => $suggestion->country,
                    'city' => $suggestion->city,
                    'description' => null,
                    'is_visible_to_students' => true,
                ]);
            }

            $university->syncRequiredDocumentTypes($validated['required_documents']);

            $student = User::query()->findOrFail($suggestion->student_id);

            $student->assignedUniversities()->syncWithoutDetaching([
                $university->id => [
                    'assigned_by' => $staff->id,
                    'source' => 'student_selected',
                    'notes' => null,
                ],
            ]);

            $suggestion->update([
                'status' => 'accepted',
                'reviewed_by' => $staff->id,
                'reviewed_at' => now(),
                'university_id' => $university->id,
            ]);

            $this->handoffs->syncUniversities($student, $staff);

            $this->notifications->createForStudent(
                $student,
                $staff,
                'Your university suggestion was accepted: '.$suggestion->name.'. Please upload any required documents listed for it.',
                'university_suggestion_accepted',
                '/student-documents',
            );

            return $suggestion->fresh(['student:id,name,email', 'reviewer:id,name,email', 'university:id,name,country,city']);
        });

        return response()->json([
            'data' => $this->payload($suggestion, true),
        ]);
    }

    public function reject(Request $request, UniversitySuggestion $suggestion): JsonResponse
    {
        $this->assertUniversitiesStaff($request);
        abort_unless($suggestion->status === 'pending', 422, 'This suggestion was already reviewed.');

        $staff = $request->user();

        $suggestion->update([
            'status' => 'rejected',
            'reviewed_by' => $staff->id,
            'reviewed_at' => now(),
        ]);

        $suggestion->loadMissing('student');

        if ($suggestion->student) {
            $this->notifications->createForStudent(
                $suggestion->student,
                $staff,
                'Your university suggestion was not accepted: '.$suggestion->name.'. You can suggest another option.',
                'university_suggestion_rejected',
                '/student-universities',
            );
        }

        return response()->json([
            'data' => $this->payload($suggestion->fresh(['student:id,name,email', 'reviewer:id,name,email']), true),
        ]);
    }

    private function assertUniversitiesStaff(Request $request): void
    {
        abort_unless(
            $request->user()?->canWorkInDepartment(StaffDepartment::Universities),
            403,
            'Only Universities staff can review suggestions.',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(UniversitySuggestion $suggestion, bool $includeStudent = false): array
    {
        return [
            'id' => $suggestion->id,
            'country' => $suggestion->country,
            'name' => $suggestion->name,
            'city' => $suggestion->city,
            'status' => $suggestion->status,
            'status_label' => match ($suggestion->status) {
                'accepted' => 'Accepted',
                'rejected' => 'Rejected',
                default => 'Pending review',
            },
            'university_id' => $suggestion->university_id,
            'university' => $suggestion->relationLoaded('university') && $suggestion->university
                ? [
                    'id' => $suggestion->university->id,
                    'name' => $suggestion->university->name,
                    'country' => $suggestion->university->country,
                    'city' => $suggestion->university->city,
                ]
                : null,
            'student' => $includeStudent && $suggestion->relationLoaded('student') && $suggestion->student
                ? [
                    'id' => $suggestion->student->id,
                    'name' => $suggestion->student->name,
                    'email' => $suggestion->student->email,
                ]
                : null,
            'reviewed_by' => $suggestion->relationLoaded('reviewer') && $suggestion->reviewer
                ? [
                    'id' => $suggestion->reviewer->id,
                    'name' => $suggestion->reviewer->name,
                    'email' => $suggestion->reviewer->email,
                ]
                : null,
            'reviewed_at' => $suggestion->reviewed_at?->toIso8601String(),
            'created_at' => $suggestion->created_at?->toIso8601String(),
        ];
    }
}
