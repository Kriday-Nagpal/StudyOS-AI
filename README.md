# StudyOS AI

StudyOS AI is an exam-aware academic operating system. It combines the student's syllabus, datesheet, progress, revision schedule, mistakes, and study history to recommend the right next action.

## Included product surfaces

- Intelligent home dashboard and daily priority engine
- Persistent daily plan with completion tracking
- Focus timer with saved session progress
- Subject map, chapter heatmap, exam roadmap, and readiness
- Spaced revision queue and recurring mistake book
- Weekly analytics and subject-balance insights
- Academic document intake with automatic classification
- Resource library, responsive mobile navigation, dark mode, and command palette
- Context-aware StudyOS assistant
- PWA manifest and branded social preview
- Supabase-ready client and secure Postgres migration with RLS and private Storage policies

The app opens in a realistic demo workspace and keeps changes in local browser storage. Connect a Supabase project using the keys in `.env.example` to replace the demo data provider.

## Run locally

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Supabase

Apply `supabase/migrations/202609190001_studyos_core.sql` to a Supabase project, then set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never expose a Supabase secret/service-role key in browser environment variables.
