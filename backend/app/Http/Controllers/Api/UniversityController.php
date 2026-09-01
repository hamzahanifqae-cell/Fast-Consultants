<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreUniversityRequest;
use App\Http\Requests\Api\UpdateUniversityRequest;
use App\Http\Resources\UniversityResource;
use App\Models\University;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class UniversityController extends Controller
{
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

        // Students only see universities staff have shared with them.
        return UniversityResource::collection($assigned);
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

    /**
     * @param  list<string>  $documentTypes
     */
    private function syncRequiredDocuments(University $university, array $documentTypes): void
    {
        $uniqueTypes = collect($documentTypes)
            ->map(fn (string $type) => DocumentType::from($type))
            ->unique(fn (DocumentType $type) => $type->value)
            ->values();

        $university->requiredDocuments()->delete();

        foreach ($uniqueTypes as $type) {
            $university->requiredDocuments()->create([
                'document_type' => $type,
            ]);
        }
    }
}
