// email-service.js — Workhub email helper
// Calls the send-email Supabase edge function.
//
// Usage:
//   await sendEmail({ to: 'client@example.com', subject: 'Your appointment', html: '<p>...</p>' })
//   await sendEmail({ to: 'client@example.com', ...emailTemplates.appointmentConfirmation(appt) })

const EMAIL_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-email`;

/**
 * Send a transactional email via Resend.
 * @param {{ to: string|string[], subject: string, html: string, text?: string, replyTo?: string, cc?: string|string[] }} opts
 */
async function sendEmail(opts) {
    const session = await window.adminSupabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('[email-service] Not authenticated');

    const res = await fetch(EMAIL_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(opts),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send email');
    return data;
}

// =============================================
// EMAIL TEMPLATES
// =============================================

const emailTemplates = {
    /**
     * Appointment confirmation
     * @param {{ clientName: string, serviceName: string, scheduledAt: string, location?: string }} appt
     */
    appointmentConfirmation(appt) {
        const date = new Date(appt.scheduledAt).toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
        });
        return {
            subject: `Your appointment is confirmed — ${appt.serviceName}`,
            html: `
                <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2C2C2C;">
                    <h2 style="color:#5A0F1E;">Your appointment is confirmed 🌿</h2>
                    <p>Hi ${appt.clientName},</p>
                    <p>Your <strong>${appt.serviceName}</strong> session has been confirmed for:</p>
                    <p style="font-size:1.1em;padding:16px;background:#F5F0E8;border-radius:8px;font-weight:600;">${date}</p>
                    ${appt.location ? `<p><strong>Location:</strong> ${appt.location}</p>` : ''}
                    <p>If you have any questions, simply reply to this email.</p>
                    <p style="margin-top:32px;color:#8A7668;font-size:14px;">With care,<br>Body Work & Botanicals</p>
                </div>
            `,
        };
    },

    /**
     * Intake form invitation
     * @param {{ clientName: string, formUrl: string }} opts
     */
    intakeFormInvitation(opts) {
        return {
            subject: 'Please complete your intake form',
            html: `
                <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2C2C2C;">
                    <h2 style="color:#5A0F1E;">Welcome, ${opts.clientName} 🌱</h2>
                    <p>Before our session, please take a few minutes to complete your intake form:</p>
                    <p style="text-align:center;margin:24px 0;">
                        <a href="${opts.formUrl}" style="display:inline-block;padding:14px 28px;background:#5A0F1E;color:#fff;text-decoration:none;border-radius:100px;font-weight:600;">Complete Intake Form</a>
                    </p>
                    <p style="color:#8A7668;font-size:13px;">This link is for you only. Please don't share it.</p>
                    <p style="margin-top:32px;color:#8A7668;font-size:14px;">With care,<br>Body Work & Botanicals</p>
                </div>
            `,
        };
    },

    /**
     * Generic notification
     * @param {{ clientName: string, message: string }} opts
     */
    notification(opts) {
        return {
            subject: 'A message from Body Work & Botanicals',
            html: `
                <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2C2C2C;">
                    <p>Hi ${opts.clientName},</p>
                    <div style="padding:16px;background:#F5F0E8;border-radius:8px;">${opts.message}</div>
                    <p style="margin-top:32px;color:#8A7668;font-size:14px;">With care,<br>Body Work & Botanicals</p>
                </div>
            `,
        };
    },
};
