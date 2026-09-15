# Fast Consultants — Project Documentation

**Product:** Fast Consultants (education consultancy platform)
**Repository:** Monorepo (Laravel API + React web + Expo mobile)
**Last updated:** September 2026

This guide walks through what the platform does, who uses it, how it's tested, and what's been fixed along the way — written so both engineers and non-technical teammates can follow along.

---

## Table of contents

1. [Overview](#1-overview)
2. [System architecture](#2-system-architecture)
3. [Roles and access](#3-roles-and-access)
4. [Staff departments](#4-staff-departments)
5. [Student journey](#5-student-journey)
6. [API surface (summary)](#6-api-surface-summary)
7. [Key backend services](#7-key-backend-services)
8. [Test cases](#8-test-cases)
9. [Bug report](#9-bug-report)
10. [Configuration notes (no secrets)](#10-configuration-notes-no-secrets)
11. [Local development (quick start)](#11-local-development-quick-start)
12. [Document maintenance guidelines](#12-document-maintenance-guidelines)

---

## 1. Overview

Fast Consultants is an end-to-end operations platform for an education consultancy. In plain terms, it helps a consultancy team take a student from "just enquired" all the way to "ready for their visa appointment," with everything tracked in one place. It covers:

- Public lead / enquiry intake
- Student onboarding and profile completion
- Document collection and review
- University shortlisting and sharing
- Fee / charge-slip handling
- Interview preparation and live video meetings
- File Making (visa) appointments
- In-app messaging and WhatsApp Cloud API delivery
- Role-based staff workspaces by department

Students, staff, and super admins each get their own dedicated portal on web and mobile.

---

## 2. System architecture

Here's the shape of the system, from the apps people use down to where the data lives:

| Layer | Stack | Location |
|-------|--------|----------|
| API | PHP 8.4, Laravel 13, Sanctum, Spatie permissions, PostgreSQL | `backend/` |
| Web | React 19, Vite, TypeScript, React Router, TanStack Query, Zustand | `web/` |
| Mobile | Expo ~57, React Native, expo-router | `mobile/` |
| Deploy | Railway / Render (API), Vercel (web), EAS (mobile), Supabase (DB/storage) | `DEPLOYMENT.md`, `render.yaml`, `backend/railway.toml`, `web/vercel.json` |

```text
┌─────────────┐     ┌─────────────┐
│  Web (SPA)  │     │ Mobile App  │
└──────┬──────┘     └──────┬──────┘
       │   HTTPS / JSON    │
       └─────────┬─────────┘
                 ▼
         ┌───────────────┐
         │  Laravel API  │
         │   (Sanctum)   │
         └───────┬───────┘
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
 PostgreSQL   File storage  Meta WhatsApp
              (local/S3)    Cloud API
                            (+ optional OpenAI)
```

---

## 3. Roles and access

Three types of people use the platform:

| Role | What they can do |
|------|---------|
| **Student** | Completes their profile, uploads documents, tracks their status, chats with staff, and joins interviews |
| **Staff** | Works inside one assigned department (`staff_department`) — reviewing documents, sharing universities, handling fees, scheduling interviews, or managing leads |
| **Super Admin** | Has full control of the platform, including creating users and assigning permissions |

Each department has its own view and manage permissions — Universities, Finance, Student Info, Visa/File Making, Interview, and Leads. Super Admins can additionally manage users and assign these permissions.

Heads up: demo and local seed accounts use the password `password`. This is for local development and demos only — never in production.

---

## 4. Staff departments

Each staff department owns one part of the student's journey:

| Department | Label | Main responsibilities |
|------------|--------|------------------------|
| `student_info` | Student Info Collector | Review personal info & documents; approve/reject; urgent document requests; form templates |
| `universities` | Universities Related | Maintain catalog; share options with students; review suggestions |
| `finance` | A/C & Finance | Create charge slips; review student payment uploads |
| `interview` | Interview | Unlock preparation; schedule meetings; run video sessions |
| `visa` | File Making Related | Schedule embassy / File Making appointments after interview |
| `leads` | Leads / Admissions | Review enquiry inbox; classify; convert leads to student accounts |

**Chat:** Students can message departments that accept student chat. Leads does not accept student department chat.

---

## 5. Student journey

Think of this as the path a student walks through, step by step.

### 5.1 High-level stages

1. **Personal information** — student completes their profile (including WhatsApp/phone).
2. **Documents** — student uploads required files; Student Info reviews them.
3. **Universities** — once documents are approved, Universities staff share options; the student may suggest or select one.
4. **Fees (charge receipts)** — once universities are shared, Finance issues slips; the student uploads proof; Finance approves.
5. **Interview preparation** — unlocks once documents and fees are cleared.
6. **Interview meeting** — staff schedule a time; the student uses a timer and joins the in-app video (Jitsi).
7. **File Making (visa)** — staff book the appointment; the student sees it on their status / appointments pages.

### 5.2 Automated department handoff

The platform moves students forward automatically, without staff needing to remember to notify the next team. This is implemented in `backend/app/Services/DepartmentHandoffService.php`:

```text
All documents approved
        → notify Universities staff
≥1 university shared with student
        → notify Finance staff
All charge receipts approved
        → notify Interview staff
```

File Making (visa) is the next stage after the interview, handled directly by staff — it isn't part of this automatic three-step chain.

### 5.3 Progress surfaces

Students can always see where they stand:

- Student **Dashboard** next-step card and progress steps (`web/src/pages/home-page.tsx`)
- **My status** journey timeline (`web/src/pages/student-status-page.tsx`)
- Mobile journey helpers (`mobile/src/lib/student-journey-progress.ts`)

**Good to know:** after documents are approved, the student's next step is **Universities**, not Finance.

---

## 6. API surface (summary)

Base: `/api` (Sanctum for authenticated routes).

| Area | Examples |
|------|----------|
| Public | `POST /register`, `POST /login`, `POST /leads` |
| Session | `GET /me`, `POST /logout`, notifications |
| Chat | Conversations, messages, WhatsApp send/broadcast, blocks |
| Student | Profile, documents, universities, charge receipts, application status, interview video room, visa appointments |
| Staff / org | Students, documents review, finance, universities, leads, interview, visa, organization users |

Health / ops: `/up` (and deploy-specific health endpoints). Interview reminders can be triggered via a secured cron HTTP route when the platform has no persistent scheduler worker.

---

## 7. Key backend services

These behind-the-scenes services do the heavy lifting:

| Service | Responsibility |
|---------|----------------|
| `DepartmentHandoffService` | Documents → Universities → Finance → Interview unlock notifications |
| `StudentNotificationService` | Per-user and department-scoped notifications |
| `StudentApplicationService` | Preparation / interview stage unlocks |
| `StudentProgressService` | Progress reporting for dashboards |
| `WhatsAppCloudService` | Phone normalize + Cloud API text/media/template send |
| `LeadClassifierService` | Heuristic / OpenAI lead classification |
| `InterviewVideoService` | Jitsi room payloads |
| `ScheduledChatDispatcher` | Sends due scheduled chat messages |

---

## 8. Test cases

We use an automated test suite (Laravel's testing framework) to make sure the platform keeps working correctly every time something changes. Below is a plain-English summary of what's covered, grouped by area — no code-reading required.

**Running the tests:**

```bash
cd backend

# Run everything
php artisan test

# Run just one area
php artisan test --filter=DepartmentNotificationTest
```

### 8.1 Accounts and sign-in

- A new student can create an account and sign in.
- Signing in with the wrong password is correctly rejected.
- A signed-in user can view their own profile; a signed-out visitor cannot.
- Signing out properly ends the session.

### 8.2 Student profile

- A student automatically gets a blank profile the moment they register.
- A student can view and update their personal information.
- Profile updates require every field to be filled in — no half-saved profiles.
- A student can save multiple education history entries.
- Staff and visitors cannot open a student's profile.

### 8.3 Documents

- A student can upload, list, and delete their own documents.
- A student cannot delete another student's document.
- Staff can approve or reject a student's documents.
- Finance staff cannot open student documents — that's outside their department.
- A super admin can download approved documents.
- A student can edit a pending or rejected document, but not one that's already approved.

### 8.4 Universities

- Staff can add a university along with its required documents.
- Students can browse universities by country and suggest one.
- Students cannot create universities themselves.
- Staff can hide a university from student view.

### 8.5 Fees and payments

- Staff can issue a payment slip; a student can upload proof and staff can re-check it.
- Staff can reject a payment slip and give a reason.
- Students, finance staff, and super admins can view slips at any time.

### 8.6 Interview and video

- Interview preparation only unlocks once documents and fees are cleared.
- A student can join the video room only once the interview is unlocked.
- The meeting shows a waiting alarm until someone joins, and ends properly once a participant leaves.
- A student can request or decline a follow-up meeting once the interview ends.
- Staff can cancel a scheduled meeting.
- Students get a reminder before their scheduled interview time.

### 8.7 Leads

- A visitor's public enquiry is captured and automatically classified.
- Staff can convert a promising lead into a full student account.

### 8.8 Chat and messaging

- A student's message only reaches the department they contacted.
- Nobody can open a conversation that isn't theirs.
- Unread counts clear once a conversation is opened.
- Staff can block or unblock a student from chat, across every department at once.
- Staff can message each other privately.
- Staff can broadcast a message to a group of students.
- Staff can attach a file to a message.
- Scheduled messages are only sent once their time is actually due.

### 8.9 Department handoffs and notifications

- Approving a student's last document automatically hands them to the Universities team.
- Sharing a university automatically hands the student to Finance.
- Approving the last payment slip automatically hands the student to Interview.
- Each handoff is only announced once — no repeat notifications.
- Staff cannot act on a student who hasn't reached their department yet.
- Notifications only reach staff in the matching department, keeping inboxes relevant.
- A document upload notifies Student Info only, not Universities.

### 8.10 Accounts and permissions

- Public registration always creates a student account — nothing else.
- Super admins can create staff accounts with department-level permissions.
- Staff cannot create organization accounts themselves.
- Students and visitors cannot reach staff-only areas.

---

## 9. Bug report

This section covers two things: what the platform can already do, and the issues we found and fixed along the way.

### 9.1 What's implemented

A plain-English rundown of what's working today, area by area:

- **Leads & enquiries** — Visitors can browse the site and submit an enquiry form. Every new enquiry is automatically sorted (Interested / Future / Ignore) so staff can act on it quickly, and a good lead can be converted straight into a student account.
- **Sign-in & portals** — Students, staff, and super admins each sign into their own dedicated portal on web and mobile.
- **Student profile & documents** — Students fill in their personal information and upload required documents (passport, CNIC, academic records, and more). Staff review each document and can approve it, reject it, or request an urgent re-upload.
- **Universities** — Staff maintain the university catalogue and share suitable options with each student; students can also suggest a university of their own for staff to review.
- **Fees & payments** — Staff issue payment slips, students upload proof of payment, and staff approve or reject each one.
- **Interview preparation & meetings** — Once documents and fees are cleared, interview preparation unlocks. Staff schedule the meeting, and everyone joins through a built-in video room complete with a countdown timer and waiting alarms.
- **File Making (visa)** — After the interview, staff book the student's File Making / visa appointment, which the student can then see on their status page.
- **Messaging & WhatsApp** — Students and staff chat inside the app, staff can message each other privately, broadcast updates to many students at once, schedule messages for later, and send WhatsApp messages straight from the platform through Meta's Cloud API.
- **Notifications** — Everyone is notified at the right moments — new documents, new charge slips, new messages — and only the staff in the relevant department get alerted, so inboxes stay relevant.

### 9.2 Bugs we found and fixed

Issues identified during production-like testing, and how we resolved them.

#### Student journey and dashboard

| What we noticed | What we did about it |
|-------|-----|
| After documents were approved, the dashboard pointed students to **Finance** too early | The next step and progress now wait for universities to be shared first; **Universities** is correctly shown as the next stage |
| The status page and mobile journey skipped or under-emphasized the universities step | Added a clear Universities step between documents and fees on both the web status page and the mobile journey helpers |

#### Notifications

| What we noticed | What we did about it |
|-------|-----|
| Department alerts were reaching too many people across staff roles | Notifications are now limited strictly to staff whose department matches (`staff_department`) |
| Document uploads notified **Universities** as well as Student Info | Uploads now notify **Student Info only** |
| Students weren't notified when a Finance staff member created a charge slip | `ChargeReceiptController::store` now creates a student notification |

#### WhatsApp messaging

| What we noticed | What we did about it |
|-------|-----|
| Meta error **#190** (expired/invalid token) confused staff | Added a clearer authentication error message; staff now set a permanent System User token in the environment |
| A misleading "24-hour window" message was shown for unrelated auth errors | Auth errors are no longer mistaken for care-window failures |
| The API reported "sent" but the message never arrived | Root cause was mismatched phone numbers; added normalization for Pakistani mobile numbers without a country code |
| The platform was sending Meta's **hello_world** template instead of the staff's actual message | Removed the forced template preference; free text is now the default, and `hello_world` is never used as a silent fallback |
| Staff weren't sure which number a message went to | The chat header now shows the student's phone number, and the success message confirms the destination |

**Quick checklist for sending WhatsApp messages:**

1. The student's Personal Info phone number matches their real WhatsApp number.
2. The student has messaged the business/test number once, to open the 24-hour window.
3. Staff use the green **WhatsApp** button (not just the in-app **Send**).
4. `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are valid on the API host.

#### Interview experience

| What we noticed | What we did about it |
|-------|-----|
| The interview page felt bare and lacked visual structure | Redesigned the preparation and meeting panels with a stage rail, checklist, meta grid, and clearer waiting states |

#### Leads and operations (earlier releases)

| What we noticed | What we did about it |
|-------|-----|
| Leads got stuck on "Awaiting model" on hosts without a queue worker | Use `QUEUE_CONNECTION=sync` on single-dyno hosts, or run `queue:work` |
| Missing permission rows caused staff permission errors (500s) | Run the `RoleSeeder` / permission seed on the live environment |
| Interview schedule times were drifting due to timezone handling | Corrected the datetime handling and reminder timing |
| Railway / Docker deployments occasionally failed to boot | Fixed PHP version, extensions, health endpoints, and PORT binding issues |

#### Data hygiene

| Capability | Notes |
|------------|-------|
| `app:clear-student-data` | Clears student operational data while keeping organization accounts — handy for resetting a live demo |

---

## 10. Configuration notes (no secrets)

### Backend (see `backend/.env.example`)

- `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`
- Database: PostgreSQL / `DB_URL`
- `QUEUE_CONNECTION` — use `sync` if no worker process exists
- WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` (e.g. `v25.0`), `WHATSAPP_DEFAULT_COUNTRY_CODE=92`
- Leave `WHATSAPP_TEMPLATE_NAME` empty for staff free-text sends
- Optional OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`

### Clients

- Web: `VITE_API_URL`
- Mobile: `EXPO_PUBLIC_API_URL`

Never commit real `.env` values or access tokens to git.

---

## 11. Local development (quick start)

```bash
# API
cd backend
composer install
cp .env.example .env   # configure DB, etc.
php artisan key:generate
php artisan migrate --seed
php artisan serve

# Web
cd web
npm install
# set VITE_API_URL=http://127.0.0.1:8000/api
npm run dev

# Mobile
cd mobile
npm install
# set EXPO_PUBLIC_API_URL
npx expo start
```

For production deploy steps, see **`DEPLOYMENT.md`**.

---

## 12. Document maintenance guidelines

When adding a major feature or fixing a user-facing bug:

1. Update **Section 8** (test cases) with any new coverage, and **Section 9** (bug report) with what changed.
2. Note any new environment keys in **Section 10**.
3. Keep this file free of secrets, access tokens, and live phone numbers beyond illustrative examples.

---

*Fast Consultants — internal product documentation for engineering and operations.*
