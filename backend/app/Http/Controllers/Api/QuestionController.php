<?php

namespace App\Http\Controllers\Api;

use App\Enums\QuestionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreQuestionReplyRequest;
use App\Http\Requests\Api\StoreQuestionRequest;
use App\Http\Resources\QuestionResource;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class QuestionController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $questions = Question::query()
            ->with(['consultant:id,name,email', 'student:id,name,email', 'replies.user.roles'])
            ->when(
                $user->isStudent(),
                fn ($query) => $query->where('student_id', $user->id),
                fn ($query) => $query->where('consultant_id', $user->id),
            )
            ->latest()
            ->get();

        return QuestionResource::collection($questions);
    }

    public function store(StoreQuestionRequest $request): JsonResponse
    {
        $question = Question::query()->create([
            'student_id' => $request->user()->id,
            'consultant_id' => $request->integer('consultant_id'),
            'subject' => $request->string('subject')->toString(),
            'body' => $request->string('body')->toString(),
            'status' => QuestionStatus::Open,
        ]);

        $question->load(['consultant:id,name,email', 'student:id,name,email', 'replies.user.roles']);

        return QuestionResource::make($question)
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Question $question): QuestionResource
    {
        $this->ensureCanAccess($request, $question);

        $question->load(['consultant:id,name,email', 'student:id,name,email', 'replies.user.roles']);

        return QuestionResource::make($question);
    }

    public function reply(StoreQuestionReplyRequest $request, Question $question): JsonResponse
    {
        $this->ensureCanAccess($request, $question);

        $user = $request->user();

        $question->replies()->create([
            'user_id' => $user->id,
            'body' => $request->string('body')->toString(),
        ]);

        if ($user->isConsultant() && $question->status === QuestionStatus::Open) {
            $question->update([
                'status' => QuestionStatus::Answered,
            ]);
        }

        $question->load(['consultant:id,name,email', 'student:id,name,email', 'replies.user.roles']);

        return response()->json([
            'data' => QuestionResource::make($question)->resolve(),
            'message' => 'Reply sent.',
        ]);
    }

    private function ensureCanAccess(Request $request, Question $question): void
    {
        $user = $request->user();

        $allowed = ($user->isStudent() && $question->student_id === $user->id)
            || ($user->isConsultant() && $question->consultant_id === $user->id);

        abort_unless($allowed, 403);
    }
}
