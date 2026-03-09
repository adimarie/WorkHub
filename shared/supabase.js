// Supabase Configuration — Workhub Practice Management
const SUPABASE_URL = 'https://wdecjlrfulsdklqeetqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZWNqbHJmdWxzZGtscWVldHFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODQwMTQsImV4cCI6MjA4ODY2MDAxNH0.mIBgkpU24IgxnzS8kR06FOL6_1Z9NmaEDe9z36CxtHs';

// Initialize Supabase client
const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Storage helpers
const STORAGE = {
    media: {
        bucket: 'media',
        getPublicUrl: (path) => `${SUPABASE_URL}/storage/v1/object/public/media/${path}`,
    },
    documents: {
        bucket: 'documents',
    },
};
