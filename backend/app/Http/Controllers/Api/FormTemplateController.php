<?php

namespace App\Http\Controllers\Api;

use App\Enums\FormTemplateStatus;
use App\Enums\Permission;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreFormTemplateRequest;
use App\Http\Requests\Api\SubmitFormTemplateAnswersRequest;
use App\Http\Requests\Api\UpdateFormTemplateStatusRequest;
use App\Http\Resources\FormTemplateAssignmentResource;
use App\Models\FormTemplateAssignment;
use App\Models\User;
use App\Services\StudentNotificationService;
use App\Support\FormTemplates\FormTemplateCatalog;
use App\Support\FormTemplates\SponsorshipLetter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class FormTemplateController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
    }

    public function catalog(Request $request): JsonResponse
    {
        $this->assertCanAccess($request);

        return response()->json([
            'data' => FormTemplateCatalog::all(),
        ]);
    }

    public function consultantIndex(Request $request): AnonymousResourceCollection
    {
        $this->assertCanAccess($request);

        $assignments = FormTemplateAssignment::query()
            ->with(['student:id,name,email', 'sender:id,name,email'])
            ->when(
                $request->filled('student_id'),
                fn ($query) => $query->where('student_id', $request->integer('student_id')),
            )
            ->latest()
            ->get();

        return FormTemplateAssignmentResource::collection($assignments);
    }

    public function studentIndex(Request $request): AnonymousResourceCollection
    {
        $assignments = FormTemplateAssignment::query()
            ->with(['student:id,name,email', 'sender:id,name,email'])
            ->where('student_id', $request->user()->id)
            ->latest()
            ->get();

        return FormTemplateAssignmentResource::collection($assignments);
    }

    public function store(StoreFormTemplateRequest $request): JsonResponse
    {
        $this->assertCanManage($request);

        $student = User::query()->findOrFail($request->integer('student_id'));
        abort_unless($student->isStudent(), 404);

        $definition = SponsorshipLetter::definition();

        $assignment = FormTemplateAssignment::query()->create([
            'student_id' => $student->id,
            'sent_by' => $request->user()->id,
            'template_key' => $definition['key'],
            'title' => $definition['title'],
            'instructions' => $request->filled('instructions')
                ? $request->string('instructions')->toString()
                : null,
            'answers' => null,
            'status' => FormTemplateStatus::AwaitingStudent,
        ]);

        $assignment->load(['student:id,name,email', 'sender:id,name,email']);

        $this->notifications->createForStudent(
            $student,
            $request->user(),
            'A Sponsorship letter was sent for you to complete in Form templates.',
            'form_template_sent',
            '/student/form-templates',
        );

        return FormTemplateAssignmentResource::make($assignment)
            ->response()
            ->setStatusCode(201);
    }

    public function submitAnswers(
        SubmitFormTemplateAnswersRequest $request,
        FormTemplateAssignment $formTemplateAssignment,
    ): FormTemplateAssignmentResource {
        abort_unless($formTemplateAssignment->student_id === $request->user()->id, 403);
        abort_unless(in_array($formTemplateAssignment->status, [
            FormTemplateStatus::AwaitingStudent,
            FormTemplateStatus::Rejected,
        ], true), 422, 'This letter cannot be submitted right now.');

        /** @var array<string, mixed> $raw */
        $raw = $request->input('answers', []);
        $answers = SponsorshipLetter::normalizeAnswers($raw);
        $errors = SponsorshipLetter::validationErrors($answers);

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $formTemplateAssignment->update([
            'answers' => $answers,
            'status' => FormTemplateStatus::AwaitingReview,
            'rejection_reason' => null,
            'reviewed_by' => null,
            'reviewed_at' => null,
        ]);

        $formTemplateAssignment->load(['student:id,name,email', 'sender:id,name,email']);

        $this->notifications->notifyDepartment(
            StaffDepartment::StudentInfo,
            $request->user(),
            $request->user()->name.' submitted a Sponsorship letter for review.',
            'form_template_submitted',
            '/departments/form-templates',
        );

        return FormTemplateAssignmentResource::make($formTemplateAssignment);
    }

    public function updateStatus(
        UpdateFormTemplateStatusRequest $request,
        FormTemplateAssignment $formTemplateAssignment,
    ): FormTemplateAssignmentResource {
        $this->assertCanManage($request);
        abort_unless(
            $formTemplateAssignment->status === FormTemplateStatus::AwaitingReview,
            422,
            'Only letters awaiting review can be approved or rejected.',
        );
        abort_unless(
            is_array($formTemplateAssignment->answers) && $formTemplateAssignment->answers !== [],
            422,
            'Student has not submitted answers yet.',
        );

        $status = FormTemplateStatus::from($request->string('status')->toString());

        $formTemplateAssignment->update([
            'status' => $status,
            'rejection_reason' => $status === FormTemplateStatus::Rejected
                ? $request->string('rejection_reason')->toString()
                : null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        $formTemplateAssignment->load(['student:id,name,email', 'sender:id,name,email']);

        $this->notifications->createForStudent(
            $formTemplateAssignment->student,
            $request->user(),
            $status === FormTemplateStatus::Approved
                ? 'Your Sponsorship letter was approved.'
                : 'Your Sponsorship letter was rejected. Reason: '.($formTemplateAssignment->rejection_reason ?? 'Not provided.'),
            $status === FormTemplateStatus::Approved ? 'form_template_approved' : 'form_template_rejected',
            '/student/form-templates',
        );

        return FormTemplateAssignmentResource::make($formTemplateAssignment);
    }

    public function destroy(
        Request $request,
        FormTemplateAssignment $formTemplateAssignment,
    ): JsonResponse {
        $this->assertCanManage($request);

        abort_unless(
            in_array($formTemplateAssignment->status, [
                FormTemplateStatus::AwaitingStudent,
                FormTemplateStatus::AwaitingReview,
                FormTemplateStatus::Rejected,
            ], true),
            422,
            'Approved letters cannot be deleted.',
        );

        $formTemplateAssignment->delete();

        return response()->json(['message' => 'Letter deleted.']);
    }

    private function assertCanAccess(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user
                && (
                    $user->hasAppPermission(Permission::StudentInfoView)
                    || $user->hasAppPermission(Permission::StudentInfoManage)
                ),
            403,
            'Only Student Info staff and Super Admin can access form templates.',
        );
    }

    private function assertCanManage(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user && $user->hasAppPermission(Permission::StudentInfoManage),
            403,
            'Only Student Info staff and Super Admin can manage form templates.',
        );
    }
}
