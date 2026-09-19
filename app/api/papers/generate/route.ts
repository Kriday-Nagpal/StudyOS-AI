import { gatewayJson } from '@/lib/ai-gateway';
import { requireUser } from '@/lib/server-supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Dict = Record<string, unknown>;

function asArray(value: unknown): Dict[] {
  return Array.isArray(value) ? value.filter((x): x is Dict => Boolean(x) && typeof x === 'object') : [];
}

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown) {
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    const body = await request.json() as { examId?: string; subjectId?: string; title?: string };

    if (!body.examId) {
      return Response.json({ error: 'examId is required' }, { status: 400 });
    }

    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', body.examId)
      .single();

    if (examError || !exam) return Response.json({ error: 'Exam not found' }, { status: 404 });

    const subjectId = body.subjectId || exam.subject_id;
    if (!subjectId) {
      return Response.json({ error: 'Choose a subject before generating a paper' }, { status: 400 });
    }

    const [{ data: subject }, { data: syllabus }, { data: blueprint }] = await Promise.all([
      supabase.from('subjects').select('id,name').eq('id', subjectId).single(),
      supabase.from('exam_syllabus_items').select('*')
        .eq('exam_id', body.examId).eq('subject_id', subjectId)
        .eq('user_verified', true).neq('inclusion', 'excluded')
        .order('priority_score',{ascending:false}),
      supabase.from('exam_blueprints').select('*')
        .eq('exam_id', body.examId).eq('status','confirmed')
        .order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ]);

    if (!subject) return Response.json({ error: 'Subject not found' }, { status: 404 });
    if (!syllabus?.length) {
      return Response.json({ error: 'Confirm the subject syllabus before generating a paper' }, { status: 400 });
    }
    if (!blueprint) {
      return Response.json({ error: 'Confirm an exam blueprint before generating a paper' }, { status: 400 });
    }

    const { data: sections } = await supabase
      .from('blueprint_sections')
      .select('*')
      .eq('blueprint_id', blueprint.id)
      .order('section_order');

    if (!sections?.length) {
      return Response.json({ error: 'The confirmed blueprint has no sections' }, { status: 400 });
    }

    const totalMarks = num(blueprint.total_marks) || sections.reduce((sum, section) => sum + num(section.section_marks), 0);
    if (!totalMarks) {
      return Response.json({ error: 'Blueprint total marks are missing' }, { status: 400 });
    }

    const syllabusSummary = syllabus.map(item => ({
      label: item.label,
      inclusion: item.inclusion,
      is_new_content: item.is_new_content,
      prior_assessment_count: item.prior_assessment_count,
      blueprint_weight: item.blueprint_weight
    }));

    const blueprintSummary = sections.map(section => ({
      section_order: section.section_order,
      name: section.name,
      question_type: section.question_type,
      question_count: section.question_count,
      marks_each: section.marks_each,
      section_marks: section.section_marks,
      internal_choice: section.internal_choice,
      rules: section.rules
    }));

    const prompt = [
      'You are StudyOS Question Paper Studio.',
      '',
      'Create ONE original school practice paper. This is practice material, not a prediction of the real exam.',
      'You MUST obey the confirmed syllabus and blueprint below. Do not include excluded or unlisted chapters/topics.',
      '',
      'Subject: ' + subject.name,
      'Exam: ' + exam.name,
      'Maximum marks: ' + totalMarks,
      'Duration minutes: ' + (blueprint.duration_minutes ?? 'not specified'),
      '',
      'CONFIRMED SYLLABUS:',
      JSON.stringify(syllabusSummary),
      '',
      'CONFIRMED BLUEPRINT:',
      JSON.stringify(blueprintSummary),
      '',
      'Return ONLY JSON with this structure:',
      JSON.stringify({
        title: '',
        instructions: [''],
        total_marks: totalMarks,
        duration_minutes: blueprint.duration_minutes ?? null,
        sections: [{
          name: '',
          questions: [{
            question_number: '',
            question_type: '',
            prompt: '',
            marks: 1,
            syllabus_label: '',
            answer_key: { answer: '', marking_points: [''] }
          }]
        }]
      }),
      '',
      'Rules:',
      '- Total marks across all generated questions MUST equal exactly ' + totalMarks + '.',
      '- Match each blueprint section question count and marks per question.',
      '- Follow internal-choice rules where they are explicit.',
      '- Every question must cite exactly one syllabus_label copied from CONFIRMED SYLLABUS.',
      '- Questions must be age/class appropriate and educational.',
      '- Avoid reproducing long copyrighted passages or exact textbook wording.',
      '- Use original question wording.',
      '- Do not add material beyond the confirmed syllabus.',
      '- Answer keys must be concise and useful for self-checking.'
    ].join('\n');

    const generated = await gatewayJson({
      prompt,
      feature: 'question-paper-generation',
      userId: user.id,
    });

    const generatedSections = asArray(generated.sections);
    const questions = generatedSections.flatMap((section, sectionIndex) =>
      asArray(section.questions).map((question, questionIndex) => ({
        section_name: str(section.name) || sections[sectionIndex]?.name || 'Section ' + (sectionIndex + 1),
        question_number: str(question.question_number) || String(questionIndex + 1),
        question_type: str(question.question_type) || sections[sectionIndex]?.question_type || null,
        prompt: str(question.prompt),
        marks: num(question.marks),
        answer_key: typeof question.answer_key === 'object' && question.answer_key ? question.answer_key : {},
        syllabus_label: str(question.syllabus_label),
        sort_order: sectionIndex * 100 + questionIndex,
      }))
    ).filter(question => question.prompt && question.marks > 0);

    const generatedMarks = questions.reduce((sum, question) => sum + question.marks, 0);
    const allowedLabels = new Set(syllabus.map(item => item.label));
    const unknownLabels = questions.filter(question => !allowedLabels.has(question.syllabus_label));

    const validation = {
      expected_marks: totalMarks,
      generated_marks: generatedMarks,
      marks_match: generatedMarks === totalMarks,
      unknown_syllabus_labels: unknownLabels.map(question => question.syllabus_label),
      syllabus_compliant: unknownLabels.length === 0,
      blueprint_section_count: sections.length,
      generated_section_count: generatedSections.length,
    };

    if (!validation.marks_match || !validation.syllabus_compliant) {
      return Response.json({
        error: 'Generated paper failed StudyOS validation and was not saved',
        validation,
      }, { status: 422 });
    }

    const { data: paper, error: paperError } = await supabase
      .from('question_papers')
      .insert({
        user_id: user.id,
        exam_id: body.examId,
        subject_id: subjectId,
        blueprint_id: blueprint.id,
        title: str(generated.title) || body.title || subject.name + ' Practice Paper',
        total_marks: totalMarks,
        duration_minutes: blueprint.duration_minutes,
        status: 'ready',
        validation,
        generated_from: {
          exam_id: body.examId,
          syllabus_item_ids: syllabus.map(item => item.id),
          blueprint_id: blueprint.id,
          generator: 'StudyOS AI Gateway',
        },
      })
      .select('*')
      .single();

    if (paperError || !paper) throw paperError || new Error('Could not save question paper');

    const rows = questions.map(question => {
      const matched = syllabus.find(item => item.label === question.syllabus_label);
      return {
        paper_id: paper.id,
        section_name: question.section_name,
        question_number: question.question_number,
        question_type: question.question_type,
        prompt: question.prompt,
        marks: question.marks,
        chapter_id: matched?.chapter_id || null,
        topic_id: matched?.topic_id || null,
        answer_key: question.answer_key,
        source_refs: {
          syllabus_item_id: matched?.id || null,
          syllabus_label: question.syllabus_label,
          source_document_id: matched?.source_document_id || null,
        },
        sort_order: question.sort_order,
      };
    });

    const { error: itemError } = await supabase.from('question_paper_items').insert(rows);
    if (itemError) throw itemError;

    return Response.json({ paper, validation });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paper generation failed';
    return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
