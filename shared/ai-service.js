// ai-service.js — Workhub AI helper
// Calls the gemini Supabase edge function for practice-aware AI features.
//
// Usage:
//   const { text } = await ai('Draft a confirmation message for Rosa's somatic session tomorrow at 2pm')
//   const { text } = await ai(prompt, { systemPrompt: '...', temperature: 0.9 })

const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/gemini`;

/**
 * Call Gemini AI with optional config overrides.
 * @param {string} prompt
 * @param {{ systemPrompt?: string, temperature?: number, maxTokens?: number, model?: string }} [opts]
 * @returns {Promise<{ text: string, usage: object }>}
 */
async function ai(prompt, opts = {}) {
    const session = await window.adminSupabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('[ai-service] Not authenticated');

    const res = await fetch(AI_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, ...opts }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    return data;
}

// =============================================
// PRACTICE-SPECIFIC AI HELPERS
// =============================================

const aiHelpers = {
    /**
     * Draft a client message (email body or SMS) for a given context.
     * @param {{ clientName: string, context: string, tone?: string }} opts
     */
    async draftMessage({ clientName, context, tone = 'warm and grounded' }) {
        return ai(
            `Draft a short, ${tone} message to my client ${clientName}. Context: ${context}\n\nWrite only the message body, no subject line.`
        );
    },

    /**
     * Summarize session notes into a clean record.
     * @param {{ clientName: string, notes: string }} opts
     */
    async summarizeNotes({ clientName, notes }) {
        return ai(
            `Summarize these session notes for ${clientName} into a clear, concise record (3-5 bullet points). Focus on what was worked on, what emerged, and any follow-up.\n\nNotes:\n${notes}`
        );
    },

    /**
     * Generate intake form questions for a service type.
     * @param {{ serviceType: string, existingQuestions?: string[] }} opts
     */
    async suggestIntakeQuestions({ serviceType, existingQuestions = [] }) {
        const existing = existingQuestions.length
            ? `\n\nExisting questions (don't repeat):\n${existingQuestions.join('\n')}`
            : '';
        return ai(
            `Suggest 5 thoughtful intake form questions for a ${serviceType} session. Questions should help the practitioner understand the client's needs, boundaries, and intentions.${existing}`
        );
    },

    /**
     * Write or refine a service description.
     * @param {{ serviceName: string, details: string }} opts
     */
    async writeServiceDescription({ serviceName, details }) {
        return ai(
            `Write a beautiful, inviting description (2-3 sentences) for this offering: "${serviceName}". Details: ${details}. Write for a potential client who is curious but unfamiliar with somatic or ceremonial work.`
        );
    },
};
