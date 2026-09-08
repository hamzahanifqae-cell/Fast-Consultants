<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentType;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreUniversityRequest;
use App\Http\Requests\Api\UpdateUniversityRequest;
use App\Http\Resources\UniversityResource;
use App\Models\University;
use App\Services\DepartmentHandoffService;
use App\Services\StudentNotificationService;
use App\Support\StudyCountries;
use App\Support\StudyUniversities;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UniversityController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
        private readonly DepartmentHandoffService $handoffs,
    ) {
    }

    public function consultantIndex(Request $request): AnonymousResourceCollection
    {
        $universities = University::query()
            ->with(['requiredDocuments', 'consultant:id,name,email'])
            ->latest()
            ->get();

        return UniversityResource::collection($universities);
    }

    public function studentIndex(Request $request): AnonymousResourceCollection
    {
        $student = $request->user();

        $assigned = $student->assignedUniversities()
            ->with(['requiredDocuments', 'consultant:id,name,email'])
            ->where('is_visible_to_students', true)
            ->latest('student_university.created_at')
            ->get();

        return UniversityResource::collection($assigned);
    }

    public function studentCountries(Request $request): JsonResponse
    {
        return response()->json([
            'data' => StudyCountries::all(),
        ]);
    }

    public function studentCatalog(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'country' => ['required', 'string', Rule::in(StudyCountries::all())],
        ]);

        $country = $validated['country'];

        $catalog = University::query()
            ->where('is_visible_to_students', true)
            ->where('country', $country)
            ->orderBy('name')
            ->get(['id', 'name', 'country', 'city']);

        $catalogNames = $catalog
            ->map(fn (University $university) => mb_strtolower($university->name))
            ->all();

        $options = $catalog->map(fn (University $university) => [
            'id' => $university->id,
            'name' => $university->name,
            'country' => $university->country,
            'city' => $university->city,
            'in_catalog' => true,
        ])->all();

        foreach (StudyUniversities::forCountry($country) as $entry) {
            if (in_array(mb_strtolower($entry['name']), $catalogNames, true)) {
                continue;
            }

            $options[] = [
                'id' => null,
                'name' => $entry['name'],
                'country' => $country,
                'city' => $entry['city'],
                'in_catalog' => false,
            ];
        }

        usort(
            $options,
            fn (array $left, array $right) => strcasecmp($left['name'], $right['name']),
        );

        return response()->json([
            'data' => array_values($options),
        ]);
    }

    public function studentSuggest(Request $request): JsonResponse
    {
        $student = $request->user();

        $validated = $request->validate([
            'university_ids' => ['required', 'array', 'min:1'],
            'university_ids.*' => ['integer', Rule::exists('universities', 'id')],
        ]);

        $ids = collect($validated['university_ids'])->unique()->values();

        $universities = University::query()
            ->whereIn('id', $ids)
            ->where('is_visible_to_students', true)
            ->get();

        abort_if(
            $universities->count() !== $ids->count(),
            422,
            'One or more universities are unavailable.',
        );

        $alreadyAssigned = $student->assignedUniversities()
            ->pluck('universities.id')
            ->all();

        $attach = [];
        foreach ($universities as $university) {
            if (in_array($university->id, $alreadyAssigned, true)) {
                continue;
            }

            $attach[$university->id] = [
                'assigned_by' => $student->id,
                'source' => 'student_selected',
                'notes' => null,
            ];
        }

        if ($attach !== []) {
            $student->assignedUniversities()->syncWithoutDetaching($attach);

            $names = $universities
                ->whereIn('id', array_keys($attach))
                ->pluck('name')
                ->implode(', ');

            $this->notifications->notifyDepartment(
                StaffDepartment::Universities,
                $student,
                $student->name.' suggested universit'.(count($attach) === 1 ? 'y' : 'ies').': '.$names.'.',
                'university_suggested',
                '/departments/universities',
            );

            $this->handoffs->syncUniversities($student, $student);
        }

        $assigned = $student->assignedUniversities()
            ->with(['requiredDocuments', 'consultant:id,name,email'])
            ->where('is_visible_to_students', true)
            ->latest('student_university.created_at')
            ->get();

        return response()->json([
            'data' => UniversityResource::collection($assigned)->resolve(),
            'added' => count($attach),
        ], $attach === [] ? 200 : 201);
    }

    public function studentDeselect(Request $request, University $university): JsonResponse
    {
        $student = $request->user();

        $attached = $student->assignedUniversities()
            ->where('universities.id', $university->id)
            ->first();

        abort_unless($attached, 404);

        abort(403, 'Once a university is shared or accepted by staff, only staff can remove it.');
    }

    public function store(StoreUniversityRequest $request): JsonResponse
    {
        $university = DB::transaction(function () use ($request) {
            $university = University::query()->create([
                'consultant_id' => $request->user()->id,
                'name' => $request->string('name')->toString(),
                'country' => $request->string('country')->toString(),
                'city' => $request->input('city'),
                'description' => $request->input('description'),
                'is_visible_to_students' => $request->boolean('is_visible_to_students', true),
            ]);

            $this->syncRequiredDocuments($university, $request->input('required_documents', []));

            return $university->load(['requiredDocuments', 'consultant:id,name,email']);
        });

        return UniversityResource::make($university)
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateUniversityRequest $request, University $university): UniversityResource
    {
        abort_unless($request->user()?->isConsultant(), 403);

        $university = DB::transaction(function () use ($request, $university) {
            $university->update($request->safe()->except('required_documents'));

            if ($request->exists('required_documents')) {
                $this->syncRequiredDocuments($university, $request->input('required_documents', []));
            }

            return $university->fresh(['requiredDocuments', 'consultant:id,name,email']);
        });

        return UniversityResource::make($university);
    }

    public function destroy(Request $request, University $university): JsonResponse
    {
        abort_unless($request->user()?->isConsultant(), 403);

        $university->delete();

        return response()->json([
            'message' => 'University deleted.',
        ]);
    }

    private function syncRequiredDocuments(University $university, array $documentTypes): void
    {
        $university->syncRequiredDocumentTypes($documentTypes);
    }
}
