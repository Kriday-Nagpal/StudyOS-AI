import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/server-supabase';

type Dict = Record<string, unknown>;

function asArray(value: unknown): Dict[] {
  return Array.isArray(value) ? value.filter((x): x is Dict => Boolean(x) && typeof x === 'object') : [];
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function subjectIdFor(supabase: SupabaseClient, userId: string, name: string) {
  if (!name) return null;
  const { data } = await supabase
    .from('subjects')
    .select('id,name')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    const body = await request.json() as { extractionId?: string; examId?: string };

    if (!body.extractionId) {
      return Response.json({ error: 'extractionId is required' }, { status: 400 });
    }

    const { data: extraction, error } = await supabase
      .from('document_extractions')
      .select('*')
      .eq('id', body.extractionId)
      .single();

    if (error || !extraction) {
      return Response.json({ error: 'Extraction not found' }, { status: 404 });
    }

    const payload = (extraction.payload || {}) as Dict;
    const type = extraction.extraction_type;
    const documentId = extraction.document_id;

    if (type === 'date_sheet') {
      const sheet = (payload.date_sheet || {}) as Dict;
      const examName = asString(sheet.exam_name) || 'School Examination';
      const entries = asArray(sheet.entries);

      const rows = [];
      for (const entry of entries) {
        const date = asString(entry.date);
        if (!date) continue;
        const subject = asString(entry.subject);
        rows.push({
          user_id: user.id,
          subject_id: await subjectIdFor(supabase, user.id, subject),
          name: subject ? `${examName} — ${subject}` : examName,
          exam_date: new Date(`${date}T09:00:00+05:30`).toISOString(),
          maximum_marks: asNumber(entry.maximum_marks),
          confirmed: true,
        });
      }

      if (!rows.length) return Response.json({ error: 'No valid exam dates were extracted' }, { status: 400 });
      const { error: insertError } = await supabase.from('exams').insert(rows);
      if (insertError) throw insertError;
    } else if (type === 'syllabus') {
      if (!body.examId) return Response.json({ error: 'Choose an exam before confirming a syllabus' }, { status: 400 });
      const syllabus = (payload.syllabus || {}) as Dict;
      const subjects = asArray(syllabus.subjects);
      const items = [];

      for (const subject of subjects) {
        const subjectName = asString(subject.subject);
        const subjectId = await subjectIdFor(supabase, user.id, subjectName);
        for (const item of asArray(subject.items)) {
          const label = asString(item.label) || asString(item.chapter_title) || asString(item.topic);
          if (!label) continue;
          items.push({
            exam_id: body.examId,
            user_id: user.id,
            subject_id: subjectId,
            chapter_id: null,
            topic_id: null,
            source_document_id: documentId,
            label,
            inclusion: asString(item.inclusion) || 'included',
            prior_assessment_count: 0,
            is_new_content: false,
            blueprint_weight: 0,
            priority_score: 0,
            extraction_confidence: extraction.confidence,
            user_verified: true,
          });
        }
      }

      if (!items.length) return Response.json({ error: 'No syllabus items were extracted' }, { status: 400 });
      const { error: insertError } = await supabase.from('exam_syllabus_items').insert(items);
      if (insertError) throw insertError;
    } else if (type === 'blueprint') {
      if (!body.examId) return Response.json({ error: 'Choose an exam before confirming a blueprint' }, { status: 400 });
      const blueprint = (payload.blueprint || {}) as Dict;
      const { data: savedBlueprint, error: bpError } = await supabase
        .from('exam_blueprints')
        .insert({
          exam_id: body.examId,
          user_id: user.id,
          source_document_id: documentId,
          total_marks: asNumber(blueprint.total_marks),
          duration_minutes: asNumber(blueprint.duration_minutes),
          status: 'confirmed',
          extraction_confidence: extraction.confidence,
        })
        .select('id')
        .single();

      if (bpError || !savedBlueprint) throw bpError || new Error('Could not save blueprint');
      const sections = asArray(blueprint.sections).map((section, index) => ({
        blueprint_id: savedBlueprint.id,
        section_order: index + 1,
        name: asString(section.name) || `Section ${index + 1}`,
        question_type: asString(section.question_type) || null,
        question_count: asNumber(section.question_count),
        marks_each: asNumber(section.marks_each),
        section_marks: asNumber(section.section_marks),
        internal_choice: typeof section.internal_choice === 'object' && section.internal_choice ? section.internal_choice : {},
        rules: typeof section.rules === 'object' && section.rules ? section.rules : {},
      }));

      if (sections.length) {
        const { error: sectionError } = await supabase.from('blueprint_sections').insert(sections);
        if (sectionError) throw sectionError;
      }
    } else {
      return Response.json({ error: 'This document type does not create exam records automatically' }, { status: 400 });
    }

    await supabase
      .from('document_extractions')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', extraction.id);

    await supabase
      .from('documents')
      .update({ processing_status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Confirmation failed';
    return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
