import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenAI } from 'npm:@google/genai@1.42.0';

import { consumeAiQuota, createHttpError, parseAiJsonResponse } from '../_shared/aiCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

const TIPTAP_FORMAT_INSTRUCTIONS = `
Output ONLY a valid JSON object with this exact top-level structure: { "type": "doc", "content": [ ... ] }
No markdown formatting, backticks, or conversational text outside the JSON object.
Use these node types:
  - { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "..." }] }
  - { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "..." }] }
  - { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "..." }] }
  - { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }
  - { "type": "bulletList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] }] }
  - { "type": "orderedList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] }] }
  - { "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] }
  - { "type": "horizontalRule" }
For text marks use: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code)
`;

const GENERATE_PROMPT = `You are a lecture notes assistant for university students. Given the audio recording of a lecture, produce clean, well-structured notes as a Tiptap JSON document.

Structure the output with:
- A heading for each major topic discussed
- Bullet points for key concepts and details
- Bold for critical terms and definitions
- A "Key Concepts" summary section at the end
- A "Potential Exam Questions" section with 3-5 questions

Be concise. Omit filler, repetition, and off-topic tangents. Focus on what a student would need to study from.

${TIPTAP_FORMAT_INSTRUCTIONS}`;

const buildEnhancePrompt = (userNotes: string) => `You are a lecture notes assistant. The student took their own notes during a lecture. You also have the full audio recording.

Expand and improve the student's notes using the lecture audio as context:
- Preserve the student's own phrasing and structure — it reflects their understanding
- Fill in gaps where the student missed important points
- Add missing key terms, definitions, and examples from the lecture
- Improve organization with clear headings and bullet points
- Add a "Key Concepts" summary section at the end
- Add a "Potential Exam Questions" section with 3-5 questions

The student's notes take priority. The audio fills in what they missed.

${TIPTAP_FORMAT_INSTRUCTIONS}

Student's notes:
${userNotes}`;

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { noteId, audioPath, userNotes, title } = body;

    if (!noteId || !audioPath) {
      return jsonResponse(
        { error: 'noteId and audioPath are required' },
        { status: 400 },
        request,
      );
    }

    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();

    // Verify user quota
    const { data: user, error: userError } = await admin
      .from('users')
      .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return jsonResponse({ error: 'User not found' }, { status: 401 }, request);
    }

    await consumeAiQuota({
      user,
      persistUsage: async ({ count, lastReset }: PersistUsagePayload) => {
        const { error: updateError } = await admin
          .from('users')
          .update({
            ai_generations_count: count,
            last_ai_generation_reset: lastReset.toISOString(),
          })
          .eq('id', authUser.id);
        if (updateError) throw updateError;
      },
    });

    // Download audio from Supabase Storage
    const { data: audioData, error: storageError } = await admin.storage
      .from('note-audio')
      .download(audioPath);

    if (storageError || !audioData) {
      throw createHttpError('Failed to retrieve audio file', 500);
    }

    // Convert to array buffer for Gemini upload
    const audioArrayBuffer = await audioData.arrayBuffer();
    const audioUint8 = new Uint8Array(audioArrayBuffer);

    // Determine MIME type from path
    const ext = audioPath.split('.').pop()?.toLowerCase() ?? 'webm';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm',
      ogg: 'audio/ogg',
      mp4: 'audio/mp4',
      mpeg: 'audio/mpeg',
      mp3: 'audio/mpeg',
    };
    const audioMimeType = mimeMap[ext] || 'audio/webm';

    // Upload to Gemini File API
    const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    if (!apiKey) {
      throw createHttpError('AI integration is not configured on the server.', 500);
    }

    const ai = new GoogleGenAI({ apiKey });

    const uploadedFile = await ai.files.upload({
      file: new Blob([audioUint8], { type: audioMimeType }),
      config: {
        mimeType: audioMimeType,
        displayName: `lecture-${noteId}`,
      },
    });

    // Wait for file to be processed
    let file = uploadedFile;
    while (file.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const fetched = await ai.files.get({ name: file.name! });
      file = fetched;
    }

    if (file.state === 'FAILED') {
      throw createHttpError('Audio processing failed. Please try again.', 500);
    }

    // Determine mode and build prompt
    const isEnhanceMode = userNotes && userNotes.trim().length > 0;
    const systemPrompt = isEnhanceMode
      ? buildEnhancePrompt(userNotes)
      : GENERATE_PROMPT;

    // Call Gemini with audio file reference
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: systemPrompt },
        {
          fileData: {
            fileUri: file.uri!,
            mimeType: audioMimeType,
          },
        },
      ],
    });

    const enhancedContent = parseAiJsonResponse(
      response.text,
      'AI generated invalid notes format. Please try again.',
    );

    if (!enhancedContent || typeof enhancedContent !== 'object' || enhancedContent.type !== 'doc') {
      throw createHttpError('AI failed to generate valid enhanced notes.', 500);
    }

    // Update the note with enhanced content
    const { error: updateError } = await admin
      .from('notes')
      .update({
        enhanced_content: enhancedContent,
        audio_url: audioPath,
        source_type: 'audio',
      })
      .eq('id', noteId)
      .eq('user_id', authUser.id);

    if (updateError) throw updateError;

    // Cleanup: delete file from Gemini (fire-and-forget)
    ai.files.delete({ name: file.name! }).catch(() => {});

    return jsonResponse(
      {
        message: 'Notes enhanced successfully',
        enhanced_content: enhancedContent,
        title: title || 'Enhanced Notes',
      },
      { status: 200 },
      request,
    );
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[enhance-notes edge function] error', requestError);

    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const responseBody: Record<string, unknown> = {
      error: typeof requestError.status === 'number'
        ? requestError.message
        : 'An unexpected error occurred during note enhancement.',
    };

    if (typeof requestError.canWatchAd === 'boolean') {
      responseBody.canWatchAd = requestError.canWatchAd;
    }

    return jsonResponse(responseBody, { status }, request);
  }
});
