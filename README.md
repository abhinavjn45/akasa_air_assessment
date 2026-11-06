# Project

## Project overview
Employee Leave Management System assessment project. Sign-in and a shared role-aware dashboard are implemented. Leave requests and approval workflows are planned.

## Live URLs
STATUS: PENDING - not deployed
Add verified live URLs after deployment.

## Demo credentials per role
In development, startup creates one account each for Employee, Manager, and HOD. Find their generated credentials in the local, Git-ignored `backend/.seed-credentials.json`. Keep this file private; these accounts are for local development only. Production does not automatically seed demo users.

## Architecture diagram
See [`ARCHITECTURE.md`](ARCHITECTURE.md). The repository contains one React frontend, one Express backend, and MySQL.

## Tech stack
React, Vite, Tailwind CSS, React Router, Node.js, Express, MySQL, mysql2, Zod, bcrypt, and JWT.

## Features by role
- **Employee:** apply for leave, view history/status, attach supporting documents when required, and respond to a request for information.
- **Manager:** view all pending requests, review documents, and approve/reject/request information when the request is at manager stage.
- **HOD:** review requests routed to the second approval stage and record the second decision.

These leave capabilities are planned. Each role can currently sign in and access the shared dashboard.

## Folder structure
```text
frontend/           React/Vite web application
backend/            Express API and database initialization
docs/               API and supporting documentation
infra/              Vercel/Render configuration, if needed
```

## Setup (local)
Run MySQL, then copy `backend/.env.example` to `backend/.env`. Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` to your local database connection. Set `JWT_ACCESS_SECRET` to a unique random value of at least 32 characters; `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` generates one. Keep the value private.

From `backend/`:

```powershell
npm.cmd install
npm.cmd start
```

Startup initializes missing tables and creates the development demo accounts. Existing table definitions are not migrated automatically. Then copy `frontend/.env.example` to `frontend/.env` and start the frontend in another terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Run `npm.cmd run build` in `frontend/` for a production build. Deployment guidance remains in `DEPLOYMENT.md` for later.

## Environment variables
See `backend/.env.example`, `frontend/.env.example`, and `DEPLOYMENT.md`. Credentials belong only in the local backend environment file, never the frontend bundle.

## API documentation
See [`docs/API.md`](docs/API.md) for implemented endpoints and `PRD.md` for proposed leave endpoints.

## Security measures implemented
The sign-in flow uses bcrypt hashes, short-lived access tokens, rotating server-revocable refresh sessions, HttpOnly cookies, request validation, login throttling, server-side role checks, and generic login errors. See `SECURITY.md` for the full checklist; a complete security review remains pending.

## Design decisions and trade-offs
See `DECISIONS.md`; summarize only decisions relevant to the delivered project.

## Testing
With the backend running, run `npm.cmd run test:auth` from `backend/` to check all three roles, session rotation, replay, and logout. Run `npm.cmd run build` from `frontend/` to verify the frontend build. Interactive browser verification remains pending.

## Deployment
See `DEPLOYMENT.md`; add the real target, URLs, and verified release steps after deployment.

## Known limitations
Password reset and leave workflows are not implemented. Attachment storage/format limits remain open; see `PRD.md`. Deployment and cross-site cookie configuration are deferred. The development seed file contains plaintext demo passwords and must remain private.

## Future improvements
After the MVP, consider only user-approved follow-up scope such as leave balances, holiday calendars, notifications, or organization administration. These are not part of the supplied requirements.
