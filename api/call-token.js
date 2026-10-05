// api/call-token.js  (Vercel Node serverless function)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Compare usernames ignoring case and spaces (some places store them lowercased / space-stripped).
const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Verifies the Supabase login and returns every username this user could be known by.
// Candidates come ONLY from server-verified data (never from the browser).
async function candidatesFromJwt(jwt) {
  if (!jwt) return { authUser: null, candidates: [] };
  const { data } = await supabase.auth.getUser(jwt);
  const authUser = data && data.user;
  if (!authUser) return { authUser: null, candidates: [] };

  const list = [];
  const add = (v) => {
    if (v && typeof v === 'string' && v.trim()) list.push(v.trim());
  };

  // 1. profiles row keyed by the auth user id
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', authUser.id)
      .maybeSingle();
    add(prof && prof.username);
  } catch (e) {
    console.warn('profiles lookup failed:', e.message);
  }

  // 2. metadata fallbacks (same ones the app uses when no profile row exists)
  const m = authUser.user_metadata || {};
  add(m.username);
  add(m.user_name);
  add(m.preferred_username);
  add(m.full_name);
  add(m.name);

  // 3. email prefix
  if (authUser.email) add(authUser.email.split('@')[0]);

  return { authUser, candidates: list };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const jwt = (req.headers.authorization || '').replace('Bearer ', '');
    if (!jwt) return res.status(401).json({ error: 'No session token sent' });

    const { authUser, candidates } = await candidatesFromJwt(jwt);
    if (!authUser) return res.status(401).json({ error: 'Not signed in' });

    const callId = req.body && req.body.callId;
    if (!callId) return res.status(400).json({ error: 'callId required' });

    // Wait up to ~2s for the callee's "accepted" update to land
    let call = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from('calls')
        .select('id, caller_username, callee_username, room_name, status')
        .eq('id', callId)
        .maybeSingle();
      call = data;
      if (!call || call.status === 'accepted') break;
      if (['ended', 'declined', 'missed', 'cancelled', 'busy'].includes(call.status)) break;
      await sleep(400);
    }

    if (!call) return res.status(403).json({ error: 'Not part of this call' });

    // Which side of the call is this logged-in user?
    const asCaller = candidates.some((c) => norm(c) === norm(call.caller_username));
    const asCallee = candidates.some((c) => norm(c) === norm(call.callee_username));
    if (!asCaller && !asCallee) {
      // Logged server-side only, so you can see what didn't match in Vercel Logs.
      console.error('call-token: no username match', {
        callId,
        candidates,
        caller: call.caller_username,
        callee: call.callee_username,
      });
      return res.status(403).json({ error: 'Not part of this call' });
    }
    const username = asCaller ? call.caller_username : call.callee_username;

    if (call.status !== 'accepted') {
      return res.status(409).json({ error: 'Call is not active', status: call.status });
    }

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: username.toLowerCase(),
      ttl: '1h',
    });
    at.addGrant({
      roomJoin: true,
      room: call.room_name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    return res.status(200).json({
      token: await at.toJwt(),
      url: process.env.LIVEKIT_URL,
    });
  } catch (err) {
    console.error('call-token error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}