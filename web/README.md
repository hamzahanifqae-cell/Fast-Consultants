# Fast Consultants — Web App

Browser workspace for students and consultants. Uses the same Laravel API as the mobile app.

## Run locally

1. Start the API:

```bash
cd backend
php artisan serve
```

2. Start the web app:

```bash
cd web
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Demo accounts

Password for all: `password`

- Super Admin: `superadmin@example.com`
- Admin: `admin@example.com`
- Consultant (legacy admin): `consultant@example.com`
- Staff: `universities@example.com`, `finance@example.com`, `student_info@example.com`, `visa@example.com`, `interview@example.com`

Students are not seeded — register from the student portal.

## Environment

Copy `.env.example` to `.env` if needed:

```
VITE_API_URL=http://127.0.0.1:8000/api
```
