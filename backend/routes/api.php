<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChargeReceiptController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ConsultantDirectoryController;
use App\Http\Controllers\Api\ConsultantStudentDocumentController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\FormTemplateController;
use App\Http\Controllers\Api\QuestionController;
use App\Http\Controllers\Api\StudentApplicationController;
use App\Http\Controllers\Api\StudentDirectoryController;
use App\Http\Controllers\Api\StudentNotificationController;
use App\Http\Controllers\Api\StudentDocumentController;
use App\Http\Controllers\Api\StudentProfileController;
use App\Http\Controllers\Api\InterviewVideoController;
use App\Http\Controllers\Api\OrganizationUserController;
use App\Http\Controllers\Api\UniversityController;
use App\Http\Controllers\Api\UniversitySuggestionController;
use App\Http\Controllers\Api\StudentUniversityController;
use App\Http\Controllers\Api\VisaAppointmentController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/notifications', [StudentNotificationController::class, 'index']);
    Route::patch('/notifications/mark-read', [StudentNotificationController::class, 'markAllRead']);

    Route::get('/chat/conversations', [ChatController::class, 'conversations']);
    Route::get('/chat/conversations/{conversation}/messages', [ChatController::class, 'messages']);
    Route::post('/chat/conversations/{conversation}/messages', [ChatController::class, 'send']);
    Route::get('/chat/messages/{message}/attachment', [ChatController::class, 'downloadAttachment']);
    Route::post('/chat/conversations/{conversation}/typing', [ChatController::class, 'typing']);
    Route::post('/chat/conversations/{conversation}/block', [ChatController::class, 'block']);
    Route::delete('/chat/conversations/{conversation}/block', [ChatController::class, 'unblock']);
    Route::get('/chat/blocks', [ChatController::class, 'blocks']);
    Route::delete('/chat/blocks/{student}', [ChatController::class, 'unblockStudent']);
    Route::get('/chat/departments', [ChatController::class, 'departments']);
    Route::get('/chat/staff/directory', [ChatController::class, 'staffDirectory']);
    Route::post('/chat/staff/conversations', [ChatController::class, 'startStaff']);
    Route::post('/chat/broadcast', [ChatController::class, 'broadcast']);

    Route::middleware('role:student')->group(function () {
        Route::get('/student/profile', [StudentProfileController::class, 'show']);
        Route::put('/student/profile', [StudentProfileController::class, 'update']);

        Route::get('/student/documents', [StudentDocumentController::class, 'index']);
        Route::post('/student/documents', [StudentDocumentController::class, 'store']);
        Route::post('/student/documents/{document}', [StudentDocumentController::class, 'update']);
        Route::delete('/student/documents/{document}', [StudentDocumentController::class, 'destroy']);
        Route::get('/student/documents/{document}/download', [StudentDocumentController::class, 'download']);

        Route::get('/consultants', [ConsultantDirectoryController::class, 'index']);
        Route::post('/chat/conversations', [ChatController::class, 'start']);

        Route::get('/questions', [QuestionController::class, 'index']);
        Route::post('/questions', [QuestionController::class, 'store']);
        Route::get('/questions/{question}', [QuestionController::class, 'show']);
        Route::post('/questions/{question}/replies', [QuestionController::class, 'reply']);

        Route::get('/student/universities', [UniversityController::class, 'studentIndex']);
        Route::get('/student/universities/countries', [UniversitySuggestionController::class, 'countries']);
        Route::get('/student/universities/catalog', [UniversityController::class, 'studentCatalog']);
        Route::post('/student/universities', [UniversityController::class, 'studentSuggest']);
        Route::delete('/student/universities/{university}', [UniversityController::class, 'studentDeselect']);

        Route::get('/student/university-suggestions', [UniversitySuggestionController::class, 'studentIndex']);
        Route::post('/student/university-suggestions', [UniversitySuggestionController::class, 'studentStore']);
        Route::delete('/student/university-suggestions/{suggestion}', [UniversitySuggestionController::class, 'studentDestroy']);

        Route::get('/student/charge-receipts', [ChargeReceiptController::class, 'studentIndex']);
        Route::post('/student/charge-receipts/{chargeReceipt}/upload', [ChargeReceiptController::class, 'uploadStudentSlip']);
        Route::get('/student/charge-receipts/{chargeReceipt}/consultant-file', [ChargeReceiptController::class, 'downloadConsultantFile']);
        Route::get('/student/charge-receipts/{chargeReceipt}/student-file', [ChargeReceiptController::class, 'downloadStudentFile']);

        Route::get('/student/form-templates', [FormTemplateController::class, 'studentIndex']);
        Route::put('/student/form-templates/{formTemplateAssignment}/answers', [FormTemplateController::class, 'submitAnswers']);

        Route::get('/student/application-status', [StudentApplicationController::class, 'studentStatus']);
        Route::post('/student/application/complete-preparation', [StudentApplicationController::class, 'studentCompletePreparation']);
        Route::post('/student/interview/followup-preference', [StudentApplicationController::class, 'studentFollowupPreference']);
        Route::get('/student/interview/video-room', [InterviewVideoController::class, 'studentRoom']);
        Route::get('/student/interview/call-status', [InterviewVideoController::class, 'studentCallStatus']);
        Route::post('/student/interview/call/join', [InterviewVideoController::class, 'studentJoinCall']);
        Route::post('/student/interview/call/leave', [InterviewVideoController::class, 'studentLeaveCall']);

        Route::get('/student/visa-appointments', [VisaAppointmentController::class, 'studentIndex']);

        Route::get('/student/notifications', [StudentNotificationController::class, 'index']);
        Route::patch('/student/notifications/mark-read', [StudentNotificationController::class, 'markAllRead']);
    });

    Route::middleware('role:consultant|super_admin|admin|staff')->group(function () {
        Route::get('/organization/catalog', [OrganizationUserController::class, 'catalog']);
        Route::get('/organization/users', [OrganizationUserController::class, 'index']);
        Route::post('/organization/users', [OrganizationUserController::class, 'store']);
        Route::put('/organization/users/{user}', [OrganizationUserController::class, 'update']);
        Route::delete('/organization/users/{user}', [OrganizationUserController::class, 'destroy']);

        Route::get('/departments', [DepartmentController::class, 'index']);
        Route::post('/departments', [DepartmentController::class, 'store']);

        Route::get('/consultant/students', [StudentDirectoryController::class, 'index']);
        Route::get('/consultant/students/progress', [StudentDirectoryController::class, 'progress']);
        Route::get('/consultant/students/{student}', [StudentDirectoryController::class, 'show']);

        Route::get('/consultant/applications', [StudentApplicationController::class, 'consultantIndex']);
        Route::get('/consultant/applications/{student}', [StudentApplicationController::class, 'consultantShow']);
        Route::put('/consultant/applications/{student}', [StudentApplicationController::class, 'consultantUpdate']);
        Route::get('/consultant/applications/{student}/video-room', [InterviewVideoController::class, 'consultantRoom']);
        Route::get('/consultant/applications/{student}/call-status', [InterviewVideoController::class, 'consultantCallStatus']);
        Route::post('/consultant/applications/{student}/call/join', [InterviewVideoController::class, 'consultantJoinCall']);
        Route::post('/consultant/applications/{student}/call/leave', [InterviewVideoController::class, 'consultantLeaveCall']);
        Route::post('/consultant/applications/{student}/cancel-meeting', [InterviewVideoController::class, 'consultantCancelMeeting']);

        Route::get('/consultant/documents', [ConsultantStudentDocumentController::class, 'index']);
        Route::get('/consultant/documents/{document}/download', [ConsultantStudentDocumentController::class, 'download']);
        Route::patch('/consultant/documents/{document}/status', [ConsultantStudentDocumentController::class, 'updateStatus']);
        Route::get('/consultant/urgent-documents', [ConsultantStudentDocumentController::class, 'urgentIndex']);
        Route::post('/consultant/urgent-documents', [ConsultantStudentDocumentController::class, 'storeUrgent']);
        Route::post('/consultant/urgent-documents/{urgentDocumentRequest}/resolve', [ConsultantStudentDocumentController::class, 'resolveUrgent']);

        Route::get('/consultant/form-templates/catalog', [FormTemplateController::class, 'catalog']);
        Route::get('/consultant/form-templates', [FormTemplateController::class, 'consultantIndex']);
        Route::post('/consultant/form-templates', [FormTemplateController::class, 'store']);
        Route::patch('/consultant/form-templates/{formTemplateAssignment}/status', [FormTemplateController::class, 'updateStatus']);
        Route::delete('/consultant/form-templates/{formTemplateAssignment}', [FormTemplateController::class, 'destroy']);

        Route::get('/consultant/universities', [UniversityController::class, 'consultantIndex']);
        Route::post('/consultant/universities', [UniversityController::class, 'store']);
        Route::put('/consultant/universities/{university}', [UniversityController::class, 'update']);
        Route::delete('/consultant/universities/{university}', [UniversityController::class, 'destroy']);

        Route::get('/consultant/students/{student}/universities', [StudentUniversityController::class, 'index']);
        Route::post('/consultant/students/{student}/universities', [StudentUniversityController::class, 'store']);
        Route::delete('/consultant/students/{student}/universities/{university}', [StudentUniversityController::class, 'destroy']);

        Route::get('/consultant/university-suggestions', [UniversitySuggestionController::class, 'staffIndex']);
        Route::post('/consultant/university-suggestions/{suggestion}/accept', [UniversitySuggestionController::class, 'accept']);
        Route::post('/consultant/university-suggestions/{suggestion}/reject', [UniversitySuggestionController::class, 'reject']);

        Route::get('/consultant/charge-receipts', [ChargeReceiptController::class, 'consultantIndex']);
        Route::post('/consultant/charge-receipts', [ChargeReceiptController::class, 'store']);
        Route::patch('/consultant/charge-receipts/{chargeReceipt}/status', [ChargeReceiptController::class, 'updateStatus']);
        Route::get('/consultant/charge-receipts/{chargeReceipt}/consultant-file', [ChargeReceiptController::class, 'downloadConsultantFile']);
        Route::get('/consultant/charge-receipts/{chargeReceipt}/student-file', [ChargeReceiptController::class, 'downloadStudentFile']);

        Route::get('/consultant/visa-appointments', [VisaAppointmentController::class, 'consultantIndex']);
        Route::post('/consultant/visa-appointments', [VisaAppointmentController::class, 'store']);
        Route::put('/consultant/visa-appointments/{visaAppointment}', [VisaAppointmentController::class, 'update']);
        Route::delete('/consultant/visa-appointments/{visaAppointment}', [VisaAppointmentController::class, 'destroy']);

        Route::get('/consultant/questions', [QuestionController::class, 'index']);
        Route::get('/consultant/questions/{question}', [QuestionController::class, 'show']);
        Route::post('/consultant/questions/{question}/replies', [QuestionController::class, 'reply']);
    });
});
