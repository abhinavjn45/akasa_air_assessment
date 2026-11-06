# Leave Tracker

**Live application:** [https://2547203-abhinavjain.vercel.app/](https://2547203-abhinavjain.vercel.app/)

A web portal for submitting and reviewing employee leave requests. Employees can check balances and request status; managers and HODs can review requests, record decisions, and request additional information.

## Requirements

- Node.js 24 and npm.
- A running MySQL server and a database user with permission to create and alter tables in the selected database.
- A Cloudinary account for uploading and previewing attachments. Requests without attachments can be submitted without Cloudinary credentials.
- Git, if cloning the repository.

## Start on a new system

The examples below use PowerShell on Windows. On macOS or Linux, use `npm` instead of `npm.cmd` and `cp` instead of `Copy-Item`.

### 1. Get the code

If you received the ZIP, extract it and open a terminal in the extracted project folder. Otherwise, clone the repository:

```powershell
git clone https://github.com/abhinavjn45/akasa_air_assessment.git
cd akasa_air_assessment
```

Make sure MySQL is running. Create an empty database using your MySQL administration tool, or use an existing empty database. The configured MySQL user must have access to it.

### 2. Configure and start the backend

Open a terminal in the repository root:

```powershell
cd backend
Copy-Item .env.example .env
npm.cmd ci
```

Edit `backend/.env`:

| Variable | Local value or purpose |
|---|---|
| `NODE_ENV` | `development` for local work. |
| `PORT` | Backend port; the example uses `4000`. |
| `DB_HOST` | MySQL host, usually `127.0.0.1` for a local server. |
| `DB_USER` | MySQL username. |
| `DB_PASSWORD` | MySQL password; an empty password is accepted only in development. |
| `DB_NAME` | Database name. |
| `CORS_ORIGIN` | Exact frontend origin; the example uses `http://localhost:5173`. |
| `JWT_ACCESS_SECRET` | A unique random secret, at least 32 characters. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary credentials, required for attachment upload and preview. |

Generate a signing secret locally and copy the output into `JWT_ACCESS_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the secret and Cloudinary credentials private. Start the backend:

```powershell
npm.cmd run dev
```

The backend runs database initialization at startup, creates missing tables and reference data, and seeds development demo users. It listens on the configured `PORT`; with the example settings, the health endpoint is `http://localhost:4000/health`. The `dev` command watches backend files for changes. To start without watching, use `npm.cmd start`.

### 3. Configure and start the frontend

Open a **second terminal** in the repository root:

```powershell
cd frontend
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run dev
```

The example frontend environment uses `VITE_API_BASE_URL=/api/v1` and proxies local API requests to `VITE_BACKEND_PROXY_TARGET=http://localhost:4000`. If you change the backend port, update the proxy target. If Vite uses a different frontend origin, update `CORS_ORIGIN` in the backend environment and restart the backend.

Open the local URL printed by Vite, normally `http://localhost:5173`. Keep both terminals running.

## Demo accounts

### Local development

On the first development startup, the backend generates one user per role with random credentials. Open `backend/.seed-credentials.json` on your machine to find the Employee, Manager, and HOD email addresses and passwords.

The file is ignored by Git and contains plaintext demo passwords. If the database was already seeded but the local credentials file is missing, initialization does not reset existing passwords. You can create another account interactively from `backend/` with `npm.cmd run user:create`.

### Assessment deployment

When `NODE_ENV=production`, the current assessment seed attempts to create these users at startup:

| Role | Display name | Email | Password |
|---|---|---|---|
| Employee | Aarav Sharma | `employee@gmail.com` | `employee@123` |
| Manager | Neha Mehta | `manager@gmail.com` | `manager@123` |
| HOD | Rajesh Kumar | `hod@gmail.com` | `hod@123` |

Existing accounts with these email addresses are left unchanged, including their passwords. These predictable credentials are for an assessment demo only; do not use them for real employee data. A deployment must contain the assessment seed change and successfully start against its database before these accounts exist there.

## How to use the application

1. Sign in with an Employee account and create a leave request. The form shows the available balance for the selected leave type.
2. Requests longer than three consecutive calendar days require a supporting document. PDF, PNG, and JPEG attachments are supported, up to three files per submission and 3 MB per file.
3. Sign in as Manager to review pending requests, approve or reject them, or request more information.
4. For requests longer than three days, manager approval moves the request to HOD review. The HOD can approve, reject, or ask for more information.
5. When more information is requested, the employee can respond and optionally add attachments. The request returns to the review stage that requested the information.

The dashboard displays the current-year leave balances, and request details include an approval journey, activity timeline, and attachment preview.

## Project structure

```text
frontend/          React, Vite, Tailwind CSS, and React Router
backend/           Express REST API, MySQL initialization, and account scripts
backend/init_db.js Creates missing database tables and seed data on startup
```

The backend uses MySQL through mysql2 and validates requests with Zod. It uses bcrypt and short-lived JWT access tokens with rotating refresh sessions. Leave attachments are stored through Cloudinary.

## Useful commands

Run these from the indicated directory:

| Directory | Command | Purpose |
|---|---|---|
| `backend` | `npm.cmd run dev` | Start the backend with file watching. |
| `backend` | `npm.cmd start` | Start the backend without file watching. |
| `backend` | `npm.cmd run db:init` | Run database initialization manually. |
| `backend` | `npm.cmd run user:create` | Create an account interactively. |
| `backend` | `npm.cmd run test:auth` | Run the local authentication integration test; the backend must already be running and development seed credentials must exist. |
| `frontend` | `npm.cmd run dev` | Start the Vite development server. |
| `frontend` | `npm.cmd run build` | Build the frontend into `frontend/dist`. |

## Deployment

The project is structured for one Vercel frontend and one Render backend. The frontend's `vercel.json` proxies `/api` requests to the configured Render URL. Set frontend and backend environment variables in their respective hosting dashboards; local `.env` files are not deployed.

For a remote MySQL database, configure network access and verify encrypted transport before using sensitive data. The current backend does not configure MySQL TLS. Review the deployed CORS origin, proxy and rate-limit configuration, cookie behavior, and credentials before sharing the application.

## Current limitations

- Password reset is not implemented.
- Reporting relationships between employees, managers, and HODs are not modeled; review access is based on role and workflow stage.
- Leave balances use provisional annual defaults of 12 days each for casual, sick, and earned leave. Pending requests reserve days. Calendar days are counted, without holiday or working-day rules.
- Database initialization creates missing tables and applies selected column additions; it is not a complete versioned migration system.
- Existing requests created before leave categories were added have no category and are not included in category balances.
- Demo account emails and passwords are predictable, and the Gmail addresses are illustrative.
