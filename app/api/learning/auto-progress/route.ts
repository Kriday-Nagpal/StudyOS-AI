/* eslint-disable @typescript-eslint/no-explicit-any */
import { gatewayJson } from '@/lib/ai-gateway';
import { requireUser } from '@/lib/server-supabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Row = Record<string, any>;
type CoverageRange = [number, number];
type TrackingSource = 'theater'|'extension'|'bookmark'|'smart_launch'|'manual';

const SUPPORTED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'pw.live',
  'physicswallah.live',
  'physicswallah.com',
  'pwskills.com',
  'diksha.gov.in',
  'khanacademy.org',
];

const TRACKING_SOURCES = new Set<TrackingSource>(['theater','extension','bookmark','smart_launch','manual']);

function hostAllowed(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return SUPPORTED_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed));
}

function providerFor(hostname: string) {
  const host = hostname.toLowerCase();
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('diksha.gov.in')) return 'diksha';
  if (host.includes('khanacademy.org')) return 'khan_academy';
  return 'other';
}

function normalized(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(value: unknown) {
  return new Set(
    normalized(value)
      .split(' ')
      .filter((word) => word.length >= 3 && !['class','chapter','lesson','lecture','part','video','live','full'].includes(word)),
  );
}

function overlapScore(a: unknown, b: unknown) {
  const aa = words(a);
  const bb = words(b);
  if (!aa.size || !bb.size) return 0;
  let matches = 0;
  for (const token of aa) if (bb.has(token)) matches++;
  return matches / Math.max(aa.size, bb.size);
}

function stripTracking(raw: string) {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || ['si','feature','pp','ab_channel'].includes(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

function clamp(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

function sourceConfidence(source: TrackingSource) {
  if (source === 'theater') return 1;
  if (source === 'extension') return 0.94;
  if (source === 'bookmark') return 0.78;
  if (source === 'smart_launch') return 0.55;
  return 0.45;
}

function confidenceStars(source: TrackingSource) {
  return Math.max(1, Math.min(5, Math.round(sourceConfidence(source) * 5)));
}

function trackingSource(value: unknown): TrackingSource {
  return TRACKING_SOURCES.has(value as TrackingSource) ? value as TrackingSource : 'extension';
}

function safeSessionId(value: unknown) {
  const sessionId = String(value || '').trim().slice(0, 160);
  return sessionId.length >= 8 ? sessionId : '';
}

function mergeCoverageRanges(input: unknown, duration: number): CoverageRange[] {
  if (!Array.isArray(input) || duration <= 0) return [];
  const ranges: CoverageRange[] = [];
  for (const raw of input.slice(0, 300)) {
    if (!Array.isArray(raw) || raw.length < 2) continue;
    const start = clamp(raw[0], 0, duration);
    const end = clamp(raw[1], 0, duration);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const left = Math.min(start, end);
    const right = Math.max(start, end);
    if (right - left < 0.2) continue;
    ranges.push([left, right]);
  }
  ranges.sort((a,b)=>a[0]-b[0]);
  const merged: CoverageRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range[0] > last[1] + 1.25) merged.push([...range] as CoverageRange);
    else last[1] = Math.max(last[1], range[1]);
  }
  return merged.slice(0, 180).map(([start,end])=>[
    Number(start.toFixed(2)),
    Number(end.toFixed(2)),
  ]);
}

function coverageSeconds(ranges: CoverageRange[]) {
  return ranges.reduce((total,[start,end])=>total + Math.max(0,end-start),0);
}

function validIsoDate(value: unknown) {
  const parsed = new Date(String(value || ''));
  if (!Number.isFinite(parsed.getTime())) return null;
  const now = Date.now();
  if (parsed.getTime() > now + 5 * 60 * 1000 || parsed.getTime() < now - 24 * 60 * 60 * 1000) return null;
  return parsed.toISOString();
}

async function heuristicMapping(supabase: any, profile: Row | null, title: string, userId: string) {
  const { data: subjects } = await supabase.from('subjects').select('*').order('sort_order');
  if (!subjects?.length) return { subject_id: null, chapter_id: null, topic_id: null, confidence: 0 };

  const titleNorm = normalized(title);
  const subjectAliases: Record<string,string[]> = {
    mathematics:['math','maths','mathematics','ganita','गणित'],
    science:['science','physics','chemistry','biology','विज्ञान'],
    'social science':['social science','sst','history','geography','civics','economics','समाज'],
    english:['english','grammar','literature','poorvi'],
    hindi:['hindi','malhar','हिंदी'],
    sanskrit:['sanskrit','deepakam','संस्कृत'],
  };

  let bestSubject: Row | null = null;
  let subjectScore = 0;
  for (const subject of subjects) {
    const name = normalized(subject.name);
    let score = titleNorm.includes(name) ? 0.92 : overlapScore(title, subject.name);
    for (const alias of subjectAliases[name] || []) {
      if (titleNorm.includes(normalized(alias))) score = Math.max(score, 0.88);
    }
    if (score > subjectScore) {
      subjectScore = score;
      bestSubject = subject;
    }
  }

  let books: Row[] = [];
  if (profile?.board && profile?.class_level) {
    const { data } = await supabase
      .from('curriculum_books')
      .select('*')
      .eq('board', profile.board)
      .eq('class_level', profile.class_level)
      .eq('status', 'current');
    books = data || [];
  }

  const matchingBooks = bestSubject
    ? books.filter((book) => normalized(book.subject) === normalized(bestSubject?.name))
    : books;

  let chapters: Row[] = [];
  if (matchingBooks.length) {
    const { data } = await supabase
      .from('curriculum_chapters')
      .select('*')
      .in('curriculum_book_id', matchingBooks.map((book) => book.id))
      .order('sort_order');
    chapters = data || [];
  }

  let bestChapter: Row | null = null;
  let chapterScore = 0;
  for (const chapter of chapters) {
    const exact = titleNorm.includes(normalized(chapter.title));
    const score = exact ? 0.98 : overlapScore(title, chapter.title);
    if (score > chapterScore) {
      chapterScore = score;
      bestChapter = chapter;
    }
  }

  let topics: Row[] = [];
  if (bestChapter) {
    const { data } = await supabase.from('curriculum_topics').select('*').eq('chapter_id', bestChapter.id).order('sort_order');
    topics = data || [];
  }

  let bestTopic: Row | null = null;
  let topicScore = 0;
  for (const topic of topics) {
    const exact = titleNorm.includes(normalized(topic.title));
    const score = exact ? 0.99 : overlapScore(title, topic.title);
    if (score > topicScore) {
      topicScore = score;
      bestTopic = topic;
    }
  }

  let confidence = Math.max(subjectScore, chapterScore, topicScore);
  let subjectId = bestSubject?.id || null;
  let chapterId = chapterScore >= 0.35 ? bestChapter?.id || null : null;
  const topicId = topicScore >= 0.42 ? bestTopic?.id || null : null;

  if (chapterId && bestChapter) {
    const owningBook = books.find((book) => book.id === bestChapter?.curriculum_book_id);
    const owner = subjects.find((subject: Row) => normalized(subject.name) === normalized(owningBook?.subject));
    if (owner) {
      subjectId = owner.id;
      confidence = Math.max(confidence, chapterScore);
    }
  }

  if (confidence < 0.52 && books.length) {
    try {
      const candidates = chapters.slice(0, 120).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        subject: books.find((book) => book.id === chapter.curriculum_book_id)?.subject || '',
      }));
      const ai = await gatewayJson({
        feature: 'auto-learning-classification',
        userId,
        prompt: [
          'Classify a learning-video title into the supplied curriculum candidates.',
          'Return only JSON with chapter_id and confidence between 0 and 1.',
          'Do not invent a chapter. If uncertain, use null.',
          JSON.stringify({ video_title: title, candidates }),
        ].join('\n'),
      });
      const chapter = chapters.find((candidate) => candidate.id === ai.chapter_id);
      const aiConfidence = clamp(ai.confidence, 0, 1);
      if (chapter && aiConfidence >= 0.62) {
        const owningBook = books.find((book) => book.id === chapter.curriculum_book_id);
        const owner = subjects.find((subject: Row) => normalized(subject.name) === normalized(owningBook?.subject));
        chapterId = chapter.id;
        subjectId = owner?.id || subjectId;
        confidence = aiConfidence;
      }
    } catch {
      // Deterministic curriculum matching remains the fallback.
    }
  }

  return {
    subject_id: confidence >= 0.45 ? subjectId : null,
    chapter_id: confidence >= 0.55 ? chapterId : null,
    topic_id: confidence >= 0.68 ? topicId : null,
    confidence: Number(confidence.toFixed(3)),
  };
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    const body = await request.json() as {
      url?: string;
      title?: string;
      currentTime?: number;
      duration?: number;
      ended?: boolean;
      source?: TrackingSource;
      clientSessionId?: string;
      sessionStartedAt?: string;
      sessionEngagedSeconds?: number;
      sessionContentSeconds?: number;
      coverageRanges?: CoverageRange[];
      seekCount?: number;
      pauseCount?: number;
      bufferSeconds?: number;
      playbackRate?: number;
      event?: string;
      visible?: boolean;
    };

    if (!body.url || !body.title) return Response.json({ error: 'url and title are required' }, { status: 400 });

    let parsed: URL;
    try { parsed = new URL(body.url); }
    catch { return Response.json({ error: 'Invalid learning URL' }, { status: 400 }); }

    if (!['https:','http:'].includes(parsed.protocol) || !hostAllowed(parsed.hostname)) {
      return Response.json({ error: 'This domain is not enabled for automatic learning tracking.' }, { status: 400 });
    }

    const canonicalUrl = stripTracking(parsed.toString());
    const provider = providerFor(parsed.hostname);
    const source = trackingSource(body.source);
    const clientSessionId = safeSessionId(body.clientSessionId);
    const currentTime = clamp(body.currentTime, 0, 24 * 60 * 60);
    const duration = clamp(body.duration, 0, 24 * 60 * 60);
    const positionCompletion = duration > 0 ? Math.min(100, currentTime / duration * 100) : 0;

    const [{ data: profile }, { data: existingVideo }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('videos').select('*').eq('user_id', user.id).eq('provider', provider).eq('external_id', canonicalUrl).maybeSingle(),
    ]);

    let mapping = {
      subject_id: existingVideo?.subject_id || null,
      chapter_id: existingVideo?.chapter_id || null,
      topic_id: existingVideo?.topic_id || null,
      confidence: Number(existingVideo?.classification_confidence || 0),
    };

    if (!mapping.subject_id || !mapping.chapter_id) {
      const guessed = await heuristicMapping(supabase, profile || null, body.title, user.id);
      mapping = {
        subject_id: mapping.subject_id || guessed.subject_id,
        chapter_id: mapping.chapter_id || guessed.chapter_id,
        topic_id: mapping.topic_id || guessed.topic_id,
        confidence: Math.max(mapping.confidence, guessed.confidence),
      };
    }

    const { data: video, error: videoError } = await supabase.from('videos').upsert({
      user_id: user.id,
      subject_id: mapping.subject_id,
      chapter_id: mapping.chapter_id,
      topic_id: mapping.topic_id,
      provider,
      external_id: canonicalUrl,
      title: String(body.title).slice(0, 400),
      url: canonicalUrl,
      duration_seconds: duration > 0 ? Math.round(duration) : existingVideo?.duration_seconds || null,
      classification_confidence: mapping.confidence,
      user_verified: Boolean(existingVideo?.user_verified),
    }, { onConflict: 'user_id,provider,external_id' }).select('*').single();

    if (videoError || !video) throw videoError || new Error('Could not save automatic learning item');

    const { data: previous } = await supabase
      .from('video_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('video_id', video.id)
      .maybeSingle();

    const previousRanges = mergeCoverageRanges(previous?.coverage_ranges || [], duration);
    const incomingRanges = mergeCoverageRanges(body.coverageRanges || [], duration);
    const allRanges = mergeCoverageRanges([...previousRanges, ...incomingRanges], duration);
    const uniqueCoverageSeconds = coverageSeconds(allRanges);
    const verifiedCompletion = duration > 0
      ? Math.min(100, uniqueCoverageSeconds / duration * 100)
      : Number(previous?.verified_completion || 0);

    let engagedDelta = 0;
    let contentDelta = 0;
    let sessionIncrement = 0;
    let sessionCoverageSeconds = incomingRanges.length ? coverageSeconds(incomingRanges) : 0;

    if (clientSessionId) {
      const { data: existingSession } = await supabase
        .from('video_tracking_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('video_id', video.id)
        .eq('client_session_id', clientSessionId)
        .maybeSingle();

      const incomingEngaged = Math.round(clamp(body.sessionEngagedSeconds, 0, 24 * 60 * 60));
      const incomingContent = Math.round(clamp(body.sessionContentSeconds, 0, 24 * 60 * 60 * 4));
      const oldEngaged = Number(existingSession?.engaged_seconds || 0);
      const oldContent = Number(existingSession?.content_seconds || 0);
      engagedDelta = Math.max(0, incomingEngaged - oldEngaged);
      contentDelta = Math.max(0, incomingContent - oldContent);
      sessionIncrement = existingSession ? 0 : 1;

      const sessionRanges = mergeCoverageRanges([
        ...(Array.isArray(existingSession?.coverage_ranges) ? existingSession.coverage_ranges : []),
        ...incomingRanges,
      ], duration);
      sessionCoverageSeconds = coverageSeconds(sessionRanges);

      const startedAt = existingSession?.started_at || validIsoDate(body.sessionStartedAt) || new Date().toISOString();
      const sessionPayload = {
        user_id: user.id,
        video_id: video.id,
        client_session_id: clientSessionId,
        source,
        started_at: startedAt,
        last_event_at: new Date().toISOString(),
        ended_at: body.ended ? new Date().toISOString() : existingSession?.ended_at || null,
        engaged_seconds: Math.max(oldEngaged, incomingEngaged),
        content_seconds: Math.max(oldContent, incomingContent),
        coverage_seconds: Math.round(sessionCoverageSeconds),
        seek_count: Math.max(Number(existingSession?.seek_count || 0), Math.round(clamp(body.seekCount, 0, 10000))),
        pause_count: Math.max(Number(existingSession?.pause_count || 0), Math.round(clamp(body.pauseCount, 0, 10000))),
        buffer_seconds: Math.max(Number(existingSession?.buffer_seconds || 0), Math.round(clamp(body.bufferSeconds, 0, 24 * 60 * 60))),
        last_position_seconds: Math.round(currentTime),
        furthest_position_seconds: Math.max(Number(existingSession?.furthest_position_seconds || 0), Math.round(currentTime)),
        playback_rate: Number(clamp(body.playbackRate || 1, 0.25, 4).toFixed(2)),
        tracking_confidence: sourceConfidence(source),
        coverage_ranges: sessionRanges,
        metadata: {
          last_event: String(body.event || 'progress').slice(0, 40),
          visible: body.visible !== false,
          tracking_version: 2,
        },
      };

      const { error: sessionError } = await supabase
        .from('video_tracking_sessions')
        .upsert(sessionPayload, { onConflict: 'user_id,video_id,client_session_id' });
      if (sessionError) throw sessionError;
    }

    const engagedTotal = Number(previous?.engaged_seconds || 0) + engagedDelta;
    const contentTotal = Number(previous?.content_seconds || 0) + contentDelta;
    const furthestPosition = Math.max(
      Number(previous?.furthest_position_seconds || 0),
      Number(previous?.last_position_seconds || 0),
      Math.round(currentTime),
    );
    const hasVerifiedCoverage = allRanges.length > 0;
    const previousLegacyCompletion = Number(previous?.completion || 0);
    const compatibilityCompletion = hasVerifiedCoverage
      ? Math.max(previousLegacyCompletion, verifiedCompletion)
      : Math.max(previousLegacyCompletion, positionCompletion);
    const sessionCount = Math.max(1, Number(previous?.sessions || 0) + sessionIncrement);

    const { error: progressError } = await supabase.from('video_progress').upsert({
      user_id: user.id,
      video_id: video.id,
      watched_seconds: Math.max(Number(previous?.watched_seconds || 0), Math.round(engagedTotal)),
      engaged_seconds: Math.round(engagedTotal),
      content_seconds: Math.round(contentTotal),
      completion: Number(compatibilityCompletion.toFixed(2)),
      verified_completion: Number(verifiedCompletion.toFixed(2)),
      coverage_ranges: allRanges,
      last_position_seconds: Math.round(currentTime),
      furthest_position_seconds: furthestPosition,
      sessions: sessionCount,
      confidence: confidenceStars(source),
      tracking_version: 2,
      tracking_source: source,
      last_watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,video_id' });

    if (progressError) throw progressError;

    const continueTitle = 'Continue: ' + video.title;
    const reviewTitle = 'Review: ' + video.title;
    const decisionCompletion = hasVerifiedCoverage ? verifiedCompletion : compatibilityCompletion;
    const isComplete = decisionCompletion >= 90;
    const previousWatchedAt = previous?.last_watched_at ? new Date(previous.last_watched_at).getTime() : Date.now();
    const staleDays = Math.max(0, Math.min(30, Math.floor((Date.now() - previousWatchedAt) / 86400000)));
    const remainingPercent = Math.max(0, 100 - decisionCompletion);
    const activeMinutes = Math.max(0, Math.round(engagedTotal / 60));
    const recommendationPriority = isComplete
      ? Math.min(62, 42 + Math.min(20, staleDays * 3))
      : Math.min(95, Math.round(58 + remainingPercent * 0.28 + Math.min(10, staleDays * 2)));
    let recommendationWarning: string | null = null;

    try {
      await supabase.from('study_recommendations').delete()
        .eq('user_id', user.id)
        .in('title', [continueTitle, reviewTitle]);

      const { error: recommendationError } = await supabase.from('study_recommendations').insert({
        user_id: user.id,
        subject_id: video.subject_id || null,
        chapter_id: video.chapter_id || null,
        topic_id: video.topic_id || null,
        recommendation_type: isComplete ? 'revise' : 'learn',
        title: isComplete ? reviewTitle : continueTitle,
        reason: hasVerifiedCoverage
          ? isComplete
            ? ['Verified unique coverage reached 90%+', staleDays ? staleDays + ' days since the last checkpoint' : 'Freshly completed — review can wait', activeMinutes + ' active minutes recorded']
            : ['Verified lesson coverage is unfinished', Math.round(decisionCompletion) + '% uniquely covered', staleDays ? staleDays + ' days since the last checkpoint' : 'Recently active', activeMinutes + ' active minutes recorded']
          : isComplete
            ? ['Known lesson progress reached 90%+', staleDays ? staleDays + ' days since the last checkpoint' : 'Freshly completed']
            : ['Tracked lesson is unfinished', Math.round(decisionCompletion) + '% known progress', staleDays ? staleDays + ' days since the last checkpoint' : 'Recently active'],
        priority_score: recommendationPriority,
        estimated_minutes: isComplete
          ? 10
          : Math.max(10, Math.min(35, duration > 0 ? Math.round((duration * (1 - decisionCompletion / 100)) / 60) : 20)),
        status: 'active',
        valid_until: new Date(Date.now()+7*86400000).toISOString(),
      });
      if (recommendationError) recommendationWarning = recommendationError.message;
    } catch (error) {
      recommendationWarning = error instanceof Error ? error.message : 'Recommendation update failed';
    }

    return Response.json({
      ok: true,
      video_id: video.id,
      completion: Number(compatibilityCompletion.toFixed(1)),
      verified_completion: Number(verifiedCompletion.toFixed(1)),
      engaged_seconds: Math.round(engagedTotal),
      content_seconds: Math.round(contentTotal),
      furthest_position_seconds: furthestPosition,
      last_position_seconds: Math.round(currentTime),
      coverage_seconds: Math.round(uniqueCoverageSeconds),
      duration_seconds: Math.round(duration),
      sessions: sessionCount,
      session_coverage_seconds: Math.round(sessionCoverageSeconds),
      tracking_source: source,
      tracking_confidence: sourceConfidence(source),
      mapped: {
        subject_id: video.subject_id,
        chapter_id: video.chapter_id,
        topic_id: video.topic_id,
        confidence: mapping.confidence,
      },
      warning: recommendationWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Automatic learning tracking failed';
    return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
