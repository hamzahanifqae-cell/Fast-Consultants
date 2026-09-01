<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateStudentProfileRequest;
use App\Http\Resources\StudentProfileResource;
use App\Models\StudentProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $data = collect($request->validated())->except('name')->all();
        $profile->update($data);
        $profile->load('user');

        return response()->json([
            'data' => StudentProfileResource::make($profile)->resolve(),
            'message' => 'Personal information saved.',
        ]);
    }

    private function profileFor(Request $request): StudentProfile
    {
        return StudentProfile::query()->firstOrCreate(
            ['user_id' => $request->user()->id],
        )->load('user');
    }
}
