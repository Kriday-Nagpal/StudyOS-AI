# StudyOS AI

StudyOS AI is a personal academic operating system: a real-data study command center that combines curriculum, school syllabus, date sheets, exam blueprints, study sessions, progress, revision, mistakes, and academic documents to recommend the right next action.

## Current architecture

- **Landing page:** premium StudyOS product experience at `/`
- **Student workspace:** authenticated connected app at `/app`
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Motion, Lucide
- **Backend:** Supabase Postgres, Auth, Storage, Row Level Security
- **Academic data:** versioned source-aware curriculum metadata with official source links
- **Private documents:** syllabus/date-sheet/blueprint/paper uploads in private Supabase Storage

## Real product surfaces

- Study Next recommendation surface
- Exam-aware dashboard
- Daily plan and focus-session logging
- Subject and chapter progress
- Verified curriculum library
- Exam syllabus comparison fields (new content, prior assessment count, blueprint weight, priority)
- Exam roadmaps and readiness data
- Spaced revision queue
- Question-paper records and source-aware paper architecture
- Real analytics computed from saved study sessions
- Private academic document center
- Learning resources
- Video progress data model
- Flashcards and spaced review data model
- Doubt tracking
- Notification preferences
- Context-aware StudyOS assistant grounded in saved workspace data

## No fake production data

The production app does not silently fall back to demo student statistics. If there is not enough evidence for a metric, the UI shows an explicit empty state.

Curriculum content is source-aware. StudyOS can store verified book/chapter/topic metadata, provenance, official links, and permitted content, but it must not republish full copyrighted textbook content without permission.

## Environment

Create `.env.local` from `.env.example` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never expose a Supabase service-role/secret key to the browser.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run lint
npm run build
```

## Database

The connected Supabase project currently includes the academic intelligence core plus the additive learning-library migration:

- `supabase/migrations/202609190001_studyos_core.sql`
- `supabase/migrations/202609190002_learning_library_and_engagement.sql`

RLS is required for all student-owned tables and private storage paths.
