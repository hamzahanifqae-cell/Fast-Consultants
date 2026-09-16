# Fast Consultants — Project Documentation

**Product:** Fast Consultants (education consultancy platform)
**Repository:** Monorepo (Laravel API + React web + Expo mobile)
**Last updated:** 15 September 2026

This document covers three things: how a student moves through the platform, how it's tested, and the bugs we've found and fixed along the way.

---

## Table of contents

1. [Project flow](#1-project-flow)
2. [Test cases](#2-test-cases)
3. [Bugs we fixed](#3-bugs-we-fixed)

---

## 1. Project flow

Think of this as the path a student walks through, step by step.

### 1.1 High-level stages

1. **Enquiry (lead)** — a visitor fills out the public enquiry form. Leads staff review it, and if it's a good fit, convert it into a student account — this is what creates the student's sign-in credentials.
2. **Self-registration** — a student can also create an account from sign-in. Leads staff must approve it before the student can sign in (pending/rejected messaging appears on login).
3. **Personal information** — student signs in and completes their profile (including WhatsApp/phone).
4. **Documents** — student uploads required files; Student Info reviews them.
5. **Universities** — once documents are approved, Universities staff share options; the student may suggest or select one.
6. **Fees (charge receipts)** — once universities are shared, Finance issues slips; the student uploads proof; Finance approves.
7. **Interview meeting** — staff schedule a time; the student uses a timer and joins the in-app video (Jitsi).
8. **File Making (visa)** — staff book the appointment; the student sees it on their status / appointments pages.

### 1.2 Automated department handoff

The platform moves students forward automatically, without staff needing to remember to notify the next team.

```text
All documents approved
        → notify Universities staff
≥1 university shared with student
        → notify Finance staff
All charge receipts approved
        → notify Interview staff
```

File Making (visa) is the next stage after the interview, handled directly by staff — it isn't part of this automatic three-step chain.

### 1.3 Progress surfaces

Students can always see where they stand:

- Student **Dashboard** — next-step card and progress steps
- **My status** — journey timeline
- Mobile app — same journey progress, built in

**Good to know:** after documents are approved, the student's next step is **Universities**, not Finance.

---

## 2. Test cases

We use an automated test suite to make sure the platform keeps working correctly every time something changes. Below is a plain-English summary of what's covered, grouped by area — no code-reading required.

**Running the tests:**

```bash
cd backend

# Run everything
php artisan test

# Run just one area
php artisan test --filter=DepartmentNotificationTest
```

### 2.1 Accounts and sign-in

- A new student can create an account; it stays pending until Leads staff approve it.
- Pending or rejected students cannot sign in — the login screen explains the status.
- After approval, the student can sign in normally.
- Signing in with the wrong password is correctly rejected.
- A signed-in user can view their own profile; a signed-out visitor cannot.
- Signing out properly ends the session.

### 2.2 Student profile

- A student automatically gets a blank profile the moment they register.
- A student can view and update their personal information.
- Profile updates require every field to be filled in — no half-saved profiles.
- A student can save multiple education history entries.
- Staff and visitors cannot open a student's profile.

### 2.3 Documents

- A student can upload, list, and delete their own documents.
- A student cannot delete another student's document.
- Staff can approve or reject a student's documents.
- Finance staff cannot open student documents — that's outside their department.
- A super admin can download approved documents.
- A student can edit a pending or rejected document, but not one that's already approved.

### 2.4 Universities

- Staff can add a university along with its required documents.
- Students can browse universities by country and suggest one.
- Students cannot create universities themselves.
- Staff can hide a university from student view.

### 2.5 Fees and payments

- Staff can issue a payment slip; a student can upload proof and staff can re-check it.
- Staff can reject a payment slip and give a reason.
- Students, finance staff, and super admins can view slips at any time.

### 2.6 Interview and video

- Interview preparation only unlocks once documents and fees are cleared.
- A student can join the video room only once the interview is unlocked.
- The meeting shows a waiting alarm until someone joins, and ends properly once a participant leaves.
- A student can request or decline a follow-up meeting once the interview ends.
- Staff can cancel a scheduled meeting.
- Students get a reminder before their scheduled interview time.

### 2.7 Leads

- A visitor's public enquiry is captured and automatically classified.
- Staff can convert a promising lead into a full student account.
- Staff can approve or reject student self-registration account requests.

### 2.8 Chat and messaging

- A student's message only reaches the department they contacted.
- Nobody can open a conversation that isn't theirs.
- Unread counts clear once a conversation is opened.
- Staff can block or unblock a student from chat, across every department at once.
- Staff can message each other privately.
- Staff can broadcast a message to a group of students.
- Staff can attach a file to a message.
- Scheduled messages are only sent once their time is actually due.

### 2.9 Department handoffs and notifications

- Approving a student's last document automatically hands them to the Universities team.
- Sharing a university automatically hands the student to Finance.
- Approving the last payment slip automatically hands the student to Interview.
- Each handoff is only announced once — no repeat notifications.
- Staff cannot act on a student who hasn't reached their department yet.
- Notifications only reach staff in the matching department, keeping inboxes relevant.
- A document upload notifies Student Info only, not Universities.

### 2.10 Accounts and permissions

- Public registration always creates a pending student account — nothing else — and notifies Leads.
- Super admins can create staff accounts with department-level permissions.
- Staff cannot create organization accounts themselves.
- Students and visitors cannot reach staff-only areas.

---

## 3. Bugs we fixed

Issues identified during production-like testing, and how we resolved them.

### Student journey and dashboard

| What we noticed | What we did about it |
|-------|-----|
| After documents were approved, the dashboard pointed students to **Finance** too early | The next step and progress now wait for universities to be shared first; **Universities** is correctly shown as the next stage |
| The status page and mobile journey skipped or under-emphasized the universities step | Added a clear Universities step between documents and fees on both the web status page and the mobile journey helpers |

### Notifications and sidebar badges

| What we noticed | What we did about it |
|-------|-----|
| Department alerts were reaching too many people across staff roles | Notifications are now limited strictly to staff whose department matches |
| Document uploads notified **Universities** as well as Student Info | Uploads now notify **Student Info only** |
| Students weren't notified when a Finance staff member created a charge slip | Creating a charge slip now notifies the student |
| Staff had no way to see new-item counts for Leads, Documents, Finance, and other sections — only Messages showed a number | Added unread badges to every section (Leads, Documents, Finance, Universities, Interview, File Making, Form templates), matching how Messages already worked |
| Badges sometimes over-counted — for example, one new lead showed as **2** | Fixed the counting logic so an update to an existing item (a lead being classified, a document edited, a payment re-uploaded, and similar cases) no longer creates a duplicate notification — badge counts are now accurate everywhere |

### WhatsApp messaging

| What we noticed | What we did about it |
|-------|-----|
| Meta error **#190** (expired/invalid token) confused staff | Added a clearer authentication error message; staff now set a permanent System User token in the environment |
| A plain login/auth error was confusingly labeled as a "24-hour window" issue | Auth errors and 24-hour-window errors are now shown separately, so staff aren't misled about the cause |
| The API reported "sent" but the message never arrived | Usually caused by a mismatched phone number or a missing country code (e.g. `300…` instead of `92300…`); fixed the number formatting and the UI now shows exactly which number was messaged |
| The platform was sending Meta's **hello_world** template instead of the staff's actual message | Free text is now the default; `hello_world` is never used as a silent fallback |
| Staff weren't sure which number a message went to | Chat header now shows the student's phone number, and the success message confirms the destination |

**Quick checklist for sending WhatsApp messages:**

1. The student's Personal Info phone number matches their real WhatsApp number.
2. The student has messaged the business/test number once, to open the 24-hour window.
3. Staff use the green **WhatsApp** button (not just the in-app **Send**).
4. The WhatsApp connection settings are valid on the server.

### Interview experience

| What we noticed | What we did about it |
|-------|-----|
| The interview page felt bare and lacked visual structure | Redesigned the preparation and meeting panels with a stage rail, checklist, meta grid, and clearer waiting states |

### Leads classification and UI

| What we noticed | What we did about it |
|-------|-----|
| A student planning to start in **2030** was still labelled **Interested now** | Fixed the classification logic: intake this year or next can be "Interested now," but anything **2+ years away is now "For the future"** — the season alone no longer forces "Interested" |
| It wasn't clear when a lead should be **Ignored** versus marked **Future** | Clarified the rule: Ignore is for spam or junk enquiries; a distant intake date alone is Future, not Ignore |
| The "Interested now" badge was hard to read in **light mode** | Fixed the badge colors so they're readable in both light and dark mode |
| Leads got stuck on "Awaiting model" on hosts without a background worker | Fixed by using the correct background-processing setup on single-worker hosts |
| Students who self-registered could sign in before staff reviewed them | Self-registration now waits for Leads approval; pending/rejected status is shown on sign-in, and Leads has an Account requests inbox |

### Operations and earlier releases

| What we noticed | What we did about it |
|-------|-----|
| Missing permission rows caused staff permission errors | Fixed by seeding the required roles and permissions on the live environment |
| Interview schedule times were drifting due to timezone handling | Corrected the datetime handling and reminder timing |
| Deployments occasionally failed to boot | Fixed version, extension, and configuration issues that were blocking startup |

### Data hygiene

| Capability | Notes |
|------------|-------|
| Clear student data tool | Clears student operational data while keeping organization accounts — handy for resetting a live demo |
| Notification-badge database update | Applied to the live server as part of the badge-counting fix |

---

*Fast Consultants — internal product documentation for engineering and operations.*
