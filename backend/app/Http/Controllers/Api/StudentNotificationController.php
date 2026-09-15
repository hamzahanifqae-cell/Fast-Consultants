<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentNotificationResource;
use App\Models\UserNotification;
use App\Support\NotificationSection;
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
            'unread_by_section' => $this->unreadBySection($userId),
        ]);
    }

    public function markAllRead(Request $request)
    {
        $userId = $request->user()->id;
        $section = $request->string('section')->toString();
        $section = $section !== '' ? $section : null;

        $query = UserNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at');

        if ($section !== null) {
            abort_unless(
                in_array($section, NotificationSection::keys(), true),
                422,
                'Invalid notification section.',
            );

            $matchingIds = UserNotification::query()
                ->where('user_id', $userId)
                ->whereNull('read_at')
                ->get(['id', 'type', 'action'])
                ->filter(
                    fn (UserNotification $notification) => NotificationSection::for(
                        $notification->type,
                        $notification->action,
                    ) === $section,
                )
                ->pluck('id')
                ->all();

            if ($matchingIds === []) {
                return response()->json([
                    'data' => [],
                    'unread_count' => UserNotification::query()
                        ->where('user_id', $userId)
                        ->whereNull('read_at')
                        ->count(),
                    'unread_by_section' => $this->unreadBySection($userId),
                ]);
            }

            UserNotification::query()
                ->whereIn('id', $matchingIds)
                ->update(['read_at' => now()]);
        } else {
            $query->update(['read_at' => now()]);
        }

        return response()->json([
            'data' => [],
            'unread_count' => UserNotification::query()
                ->where('user_id', $userId)
                ->whereNull('read_at')
                ->count(),
            'unread_by_section' => $this->unreadBySection($userId),
        ]);
    }

    /**
     * @return array<string, int>
     */
    private function unreadBySection(int $userId): array
    {
        $counts = array_fill_keys(NotificationSection::keys(), 0);
        /** @var array<string, array<string, true>> $seen */
        $seen = [];

        UserNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->get(['id', 'type', 'action', 'subject_key'])
            ->each(function (UserNotification $notification) use (&$counts, &$seen) {
                $section = NotificationSection::for($notification->type, $notification->action);
                if ($section === null) {
                    return;
                }

                $dedupeKey = filled($notification->subject_key)
                    ? (string) $notification->subject_key
                    : 'notification:'.$notification->id;

                if (isset($seen[$section][$dedupeKey])) {
                    return;
                }

                $seen[$section][$dedupeKey] = true;
                $counts[$section]++;
            });

        return $counts;
    }
}
