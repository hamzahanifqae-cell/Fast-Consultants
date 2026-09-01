<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreDepartmentRequest;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class DepartmentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $departments = Department::query()
            ->where('consultant_id', $request->user()->id)
            ->latest()
            ->get();

        return DepartmentResource::collection($departments);
    }

    public function store(StoreDepartmentRequest $request): JsonResponse
    {
        $name = $request->string('name')->toString();
        $slug = $this->uniqueSlug($request->user()->id, $name);

        $department = Department::query()->create([
            'consultant_id' => $request->user()->id,
            'name' => $name,
            'slug' => $slug,
        ]);

        return DepartmentResource::make($department)
            ->response()
            ->setStatusCode(201);
    }

    private function uniqueSlug(int $consultantId, string $name): string
    {
        $base = Str::slug($name) ?: 'department';
        $slug = $base;
        $i = 1;

        while (
            Department::query()
                ->where('consultant_id', $consultantId)
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
