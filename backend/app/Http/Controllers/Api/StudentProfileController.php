<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateStudentProfileRequest;
use App\Http\Resources\StudentProfileResource;
use App\Models\StudentProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $profile = $this->profileFor($request);

        return response()->json([
            'data' => StudentProfileResource::make($profile)->resolve(),
        ]);
    }

    public function update(UpdateStudentProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $profile = $this->profileFor($request);

        if ($request->filled('name')) {
            $user->update([
                'name' => $request->string('name')->toString(),
            ]);
        }

        /** @var list<array{education_level: string, institution_name: string, field_of_study: string, graduation_year: string}> $educations */
        $educations = array_values($request->validated('educations'));
        $primary = $educations[0];

        $data = collect($request->validated())
            ->except(['name', 'educations'])
            ->merge([
                'education_level' => $primary['education_level'],
                'institution_name' => $primary['institution_name'],
                'field_of_study' => $primary['field_of_study'],
                'graduation_year' => $primary['graduation_year'],
            ])
            ->all();

        DB::transaction(function () use ($profile, $data, $educations): void {
            $profile->update($data);

            $profile->educations()->delete();

            foreach ($educations as $index => $education) {
                $profile->educations()->create([
                    'education_level' => $education['education_level'],
                    'institution_name' => $education['institution_name'],
                    'field_of_study' => $education['field_of_study'],
                    'graduation_year' => $education['graduation_year'],
                    'sort_order' => $index,
                ]);
            }
        });

        $profile->load(['user', 'educations']);

        return response()->json([
            'data' => StudentProfileResource::make($profile)->resolve(),
            'message' => 'Personal information saved.',
        ]);
    }

    private function profileFor(Request $request): StudentProfile
    {
        return StudentProfile::query()->firstOrCreate(
            ['user_id' => $request->user()->id],
        )->load(['user', 'educations']);
    }
}
