<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentNotificationResource;
use App\Models\UserNotification;
use Illuminate\Http\Request;

class StudentNotificationController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $unreadOnly = $request->boolean('unread_only', false);
        $limit = min(max($request->integer('limit', 20), 1), 50);

        $baseQuery = UserNotification::query()
            ->where('user_id', $userId)
            ->when($unreadOnly, fn ($q) => $q->whereNull('read_at'))
            ->orderByDesc('created_at');

        $notifications = (clone $baseQuery)->limit($limit)->get();
        $unreadCount = UserNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => StudentNotificationResource::collection($notifications)->resolve(),
            'unread_count' => $unreadCount,
        ]);
    }

    public function markAllRead(Request $request)
    {
        $userId = $request->user()->id;
        UserNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'data' => [],
            'unread_count' => 0,
        ]);
    }
}
