// Calendar service — calls sync-calendar edge function
// Requires: shared/supabase.js + shared/auth.js loaded first

const calendarService = {
  async _call(action, appointmentId) {
    const session = await window.adminSupabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/sync-calendar`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, appointmentId }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Calendar sync failed');
    return data;
  },

  /** Create or update a Google Calendar event for an appointment */
  async sync(appointmentId) {
    return this._call('upsert', appointmentId);
  },

  /** Remove a Google Calendar event */
  async remove(appointmentId) {
    return this._call('delete', appointmentId);
  },
};
