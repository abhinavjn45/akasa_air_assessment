# Project

## Project overview
Employee Leave Management System assessment project. Employees submit leave requests and track their status. Managers review requests and may approve, reject, or request more information. Requests longer than three consecutive days require supporting documents and approvals from both a manager and the HOD. The login interface is the first implemented screen; the backend and leave workflow are planned.

## Live URLs
STATUS: PENDING - not deployed
Add verified live URLs after deployment.

## Demo credentials per role
STATUS: PENDING - demo accounts have not been created
Document safe demo credentials for Employee, Manager, and HOD after controlled seed setup; never use production credentials.

## Architecture diagram
See the system diagram in [`ARCHITECTURE.md`](ARCHITECTURE.md). The repository contains one React frontend and one planned Express backend.

## Tech stack
See the locked stack in `PRD.md`; list the technologies actually used after implementation.

## Features by role
- **Employee:** apply for leave, view history/status, attach supporting documents when required, and respond to a request for information.
- **Manager:** view all pending requests, review documents, and approve/reject/request information when the request is at manager stage.
- **HOD:** review requests routed to the second approval stage and record the second decision.

These are assessment requirements and proposed workflow behavior; mark them as implemented only after verification.

## Folder structure
```text
frontend/           React/Vite web application
backend/            One Express application (currently a placeholder)
docs/               API and supporting documentation
infra/              Vercel/Render configuration, if needed
```

## Setup (local)
Install the frontend dependencies and start the development server from `frontend/`:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Run `npm.cmd run build` to create the frontend production build. The backend is not implemented yet. Deployment guidance remains in `DEPLOYMENT.md` for later.

## Environment variables
See `.env.example` and `DEPLOYMENT.md`; document actual variables without values containing secrets.

## API documentation
The proposed API surface is in `PRD.md`. Generate [`docs/API.md`](docs/API.md) from the implemented routes before submission.

## Security measures implemented
STATUS: PENDING - implementation not started
List measures verified in the delivered implementation, mapped to `SECURITY.md`.

## Design decisions and trade-offs
See `DECISIONS.md`; summarize only decisions relevant to the delivered project.

## Testing
The frontend production build has been run with `npm.cmd run build`. Add backend and end-to-end verification results as those features are implemented.

## Deployment
See `DEPLOYMENT.md`; add the real target, URLs, and verified release steps after deployment.

## Known limitations
The login page is a frontend interface only. Authentication, password reset, remember-me persistence, backend APIs, and the leave workflow are not yet implemented. Attachment storage/format limits remain open; see `PRD.md`.

## Future improvements
After the MVP, consider only user-approved follow-up scope such as leave balances, holiday calendars, notifications, or organization administration. These are not part of the supplied requirements.
