 create mode 100644 app/api/citizen/appeals/route.ts
 create mode 100644 app/api/citizen/badges/route.ts
 create mode 100644 app/api/citizen/me/badges/route.ts
 create mode 100644 app/api/citizen/privacy-settings/route.ts
 create mode 100644 app/api/citizen/reports/[reportId]/confirmations/route.ts
 create mode 100644 app/api/citizen/reports/[reportId]/route.ts
 create mode 100644 app/api/citizen/safety-radius/route.ts
 create mode 100644 app/api/citizen/sos/[id]/contacts/route.ts
 create mode 100644 app/api/citizen/sos/[id]/location/route.ts
 create mode 100644 app/api/citizen/sos/[id]/route.ts
 create mode 100644 app/api/citizen/sos/route.ts
 create mode 100644 app/api/community/groups/[id]/join/route.ts
 create mode 100644 app/api/community/groups/[id]/leave/route.ts
 create mode 100644 app/api/community/groups/[id]/posts/[postId]/route.ts
 create mode 100644 app/api/community/groups/[id]/posts/route.ts
 create mode 100644 app/api/community/groups/[id]/route.ts
 create mode 100644 app/api/community/groups/route.ts
 create mode 100644 app/api/internal/analytics/recompute/route.ts
 create mode 100644 app/api/police/analytics/hotspots/route.ts
 create mode 100644 app/api/police/analytics/metrics/route.ts
 create mode 100644 app/api/police/analytics/patterns/route.ts
 create mode 100644 app/api/police/cases/[id]/appeals/route.ts
 create mode 100644 app/api/police/sos/[id]/route.ts
 create mode 100644 app/api/police/sos/active/route.ts
 create mode 100644 scripts/compute-analytics.ts
 create mode 100644 src/lib/analytics/compute.ts
 create mode 100644 src/lib/cases/status-history.ts
 create mode 100644 src/lib/gamification/award.ts
 create mode 100644 src/lib/geo/distance.ts
 create mode 100644 src/lib/reports/status-history.ts






# Crime Reporting & Management System Architecture
This document provides a detailed overview of the "Crime Reporting" application, covering both the frontend mobile app and the backend infrastructure.

Project Overview
The system is a sophisticated platform for crime reporting, community safety monitoring, and police case management. It features role-based access for Citizens, Community Members, Police, and Enterprise Security.

1. Backend Architecture (crime-backend/)
The backend is built with Next.js (used primarily as a secure API layer) and utilizes PRISMA for database management with a Supabase (PostgreSQL + PostGIS) backend.

Tech Stack
Framework: Next.js (App Router)
Database: PostgreSQL with PostGIS extensions for spatial data.
ORM: Prisma
Auth: Custom JWT-based authentication with OTP (via Resend).
Validation: Zod
Storage: Supabase Storage for media (photos, videos, audio).
Communication: Resend for emails.
Key Features & Models
Incident Reporting: Supports anonymous/identified reports, AI-assisted categorization, and media attachments with forensic metadata.
Case Management: Full police workflow including case assignments, evidence tracking (checksum-verified), field notes, and suspects.
Real-time SOS: SOS alerting system with live location logging and automated emergency contact notification.
Geo-fencing: Location-based alerts and subscriptions to monitor specific areas (Home, Work, etc.).
Gamification: Trust scores, reputation points, and badges to encourage verified reporting and community participation.
Analytics: Internal scripts for computing crime hotspots and patterns.
API Structure
The API is divided into logical domains:

/api/auth: Login, Signup, OTP management.
/api/reports: Incident report lifecycle.
/api/police: Officer-specific actions (cases, patrol status, SOS response).
/api/citizen: Citizen-specific features (my reports, SOS, safety radius).
/api/community: Group interactions and posts.
/api/admin: System-level moderation and configuration.
2. Frontend Architecture (crime-reporting/)
The mobile application is built using React Native with Expo, leveraging modern mobile patterns.

Tech Stack
Framework: Expo (React Native)
Navigation: Expo Router (File-based routing)
Language: TypeScript
State Management: React Context (Auth, Drafts, Cache)
Maps: react-native-maps for incident visualization and SOS monitoring.
App Structure & Navigation
The app uses a role-based directory structure inside app/:

(auth)/: Onboarding, Login, and Signup flows.
(citizen)/: Dashboard, Report Crime (multi-step draft), SOS, and Feed.
(police)/: Case lists, Evidence collection, Patrol mode, and SOS monitoring.
Core Logic (src/)
auth/: AuthContext handles the login state and redirection based on user role.
report/: ReportDraftProvider manages multi-step reporting processes, supporting offline-first logic.
services/: API client for interacting with the backend.
verification/: Workflows for community and police identity verification.
3. Data Integrity & Security
Forensic Verification: The system stores media capture metadata (location, device info) and computes checksums for evidence integrity.
RBAC: Strict Role-Based Access Control enforced at both the API level and UI level.
Privacy: Support for truly anonymous reporting with metadata stripping for privacy.
Offline Support: Includes client-generated IDs for deduplication when uploading offline reports.
4. Key Workflows
Crime Reporting Flow
Citizen fills a multi-step form (handled by ReportDraftProvider).
Location and media (with metadata) are captured.
Backend processes the report, potentially using AI for initial categorization.
Community members can confirm/dispute the report to build trust.
Police can verify the report and "promote" it to an official Case File.
SOS Flow
User triggers SOS (can be silent/discreet).
Live location logs start streaming to the backend (SosLocationLog).
Registered emergency contacts are notified.
Nearby police officers see the active SOS on their map and can respond.