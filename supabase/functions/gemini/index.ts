// gemini — Workhub AI edge function
// Calls Google Gemini for practice-aware AI features.
//
// POST /functions/v1/gemini
// Headers: Authorization: Bearer <supabase-anon-key>
// Body: { prompt, systemPrompt?, model?, temperature?, maxTokens? }
//
// Requires secret: GEMINI_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const DEFAULT_MODEL = 'gemini-2.0-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// System context for the practice
const PRACTICE_CONTEXT = `You are a compassionate AI assistant for a solo somatic and ceremonial practitioner.
The practice offers somatic bodywork, ceremonial containers, and mentorship.
You help with: drafting client communications, summarizing session notes, suggesting intake questions,
writing service descriptions, and supporting the practitioner's workflow.
Always write in a warm, grounded, professional tone. Avoid clinical or overly formal language.
Never provide medical advice. Keep responses concise unless asked for detail.`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      prompt,
      systemPrompt,
      model = DEFAULT_MODEL,
      temperature = 0.7,
      maxTokens = 1024,
    } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemInstruction = systemPrompt ?? PRACTICE_CONTEXT;

    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error('[gemini] API error:', data);
      return new Response(
        JSON.stringify({ error: data.error?.message ?? 'Gemini request failed' }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const usage = data.usageMetadata ?? {};

    return new Response(
      JSON.stringify({ text, usage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[gemini] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
