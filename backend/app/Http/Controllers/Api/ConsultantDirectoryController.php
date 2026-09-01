<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\ConsultantSummaryResource;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ConsultantDirectoryController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        // Students message organization staff, never Super Admin.
        $consultants = User::query()
            ->role([
                Role::Admin->value,
                Role::Staff->value,
                Role::Consultant->value,
            ])
            ->whereDoesntHave('roles', fn ($query) => $query->where('name', Role::SuperAdmin->value))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return ConsultantSummaryResource::collection($consultants);
    }
}
