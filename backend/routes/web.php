<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/health', fn () => response('ok', 200));

Route::get('/cron/interview-reminders', function () {
    $secret = config('app.cron_secret');
    abort_unless($secret && request()->header('X-Cron-Secret') === $secret, 401);

    Artisan::call('interview:send-reminders');

    return response()->json(['ok' => true]);
});
