# NRP Capitals Workspace

A responsive company workspace for event operations and office task management.

## Stack

React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS, Firebase Authentication, and Cloud Firestore.

## Run locally

Use Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal. The app uses the supplied Firebase project, teammanagement-882f0.

For a read-only design preview using fictional sample records, open /?preview=admin or /?preview=team on the development server. These previews are disabled in production builds. They never write sample records to Firebase.

## Validate and build

```sh
npm run typecheck
npm test
npm run test:rules
npm run build
npm run preview
```

The static frontend is built into dist/. Domain tests cover permissions, group completion, deadline history, and validation. A successful build is not confirmation that Firebase has been deployed.

`npm run test:rules` checks firestore.rules against the Firestore emulator: who counts as a member, which records each person can read, and which direct Firestore changes each role can make. It needs **Java** on the PATH because the emulator runs on the JVM.

## Firebase setup and deployment

1. Enable Email/Password in Firebase Authentication.
2. Create a Cloud Firestore database. Choose the database region deliberately before creating it.
3. Keep the project on the free Spark plan. This app does not require Cloud Functions.
4. Install the official Firebase CLI, authenticate as a project owner, then deploy:

```sh
npm install -g firebase-tools
firebase login
firebase use teammanagement-882f0
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

5. Add the frontend hostname to Authentication's authorized domains if using another host.
6. At the real sign-in page, use the existing Firebase Authentication account for nrpcapital99@gmail.com, or use First-time admin setup. The admin workspace is initialized automatically after email/password sign-in. Email verification and manual activation are not required.
7. Add employees through Team members. Each employee receives an email/password login; share their temporary password privately. Password reset is available on the login screen.

## Workflows

- Home admin control board with one card per employee, assigned/completed counts, and direct add, complete, and remove task controls.
- Team-wide Gantt chart directly below the employee cards, plus event-specific timelines inside each event.
- A compact Event button in the top-right opens the separate event workspace.
- Persistent Home, Office, Clients, and Expenses navigation on desktop and mobile.
- Tile and list views for tasks, events, guests, clients, expenses, and team members.
- Event plans, event tasks, read-only Gantt timeline, and event-day responsibilities.
- Personal office tasks and admin-created individual or group assignments.
- Each assignee completes their own part. A task completes only when everyone finishes.
- Only admins can change assigned deadlines or assign tasks to other people.
- Reusable searchable clients; event client list, invitation log, RSVP, and manual attendance.
- Walk-ins can be added directly, with a total number of people attending.
- Out-of-pocket INR expenses. No receipt, approval, or reimbursement workflow.
- Event hits and misses.
- Task activity logs, original deadlines, and completion timestamps.
- Light and dark themes. No notification integrations yet.

## Access model

Firebase Authentication identifies users. Active `nrp_members` records determine authorization. The app writes directly to Firestore, and deployed Firestore rules validate permissions for every read and write. This design works on Firebase's free Spark plan.

Employees can read only tasks whose assigneeIds include their UID, see co-assignees, and update only their own progress. They can create office tasks for themselves but cannot edit their deadlines after creation. Employee expense views contain only their own entries.

Active members can access shared event and client records to support guest operations. Admins can manage events, employees, assignments, and deadlines. Deactivation immediately blocks workspace data while retaining task history. On Spark, it does not delete or disable the underlying Firebase Authentication account.

The first administrator can be bootstrapped only by the designated admin email, signed in with its password. A Firestore initialization lock prevents claiming the first-admin role more than once. Production data is never seeded automatically.

## Data

Collections are prefixed nrp_: members, tasks, events, clients, guests, expenses, reviews, and settings. Task activity is stored under each task's activity subcollection. Expenses use integer paise. Dates are rendered in IST.

The live test dataset uses stable IDs beginning with `test_` and clear names such as `TEST 1`, `TEST 2`, and `TEST 3`. An authenticated project owner can restore the same records without creating duplicates by running `npm run seed:test-data`.

Lists currently use live Firestore subscriptions and client-side search; the larger tables paginate their rendered rows. Before using very large datasets, add server-side pagination and a dedicated full-text search index. Firestore rules now have emulator tests (`npm run test:rules`). Real-device testing and live concurrent-user checks remain release-gate work.

## Configuration

The supplied Analytics measurement ID is configured. Analytics loads only in production, checks browser support, and cannot block sign-in if unavailable. Development previews do not initialize Analytics.

The Firebase web configuration in `lib/firebase.ts` is public client configuration, not an administrative credential. Security relies on the deployed Firestore rules. Never commit Firebase Admin credentials, service-account JSON, CLI auth state, or `.env` secrets.
