// useContentFeedback.js
import { supabase } from './supabaseClient';

export async function setFeedback(userId, type, id, feedback) {
  return supabase.from('content_feedback').upsert(
    { user_id: userId, content_type: type, content_id: id, feedback },
    { onConflict: 'user_id,content_type,content_id' }
  );
}

export async function clearFeedback(userId, type, id) {
  return supabase.from('content_feedback').delete()
    .match({ user_id: userId, content_type: type, content_id: id });
}