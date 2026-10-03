import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const same = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// usernameFromJwt stays exactly as you have it

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const jwt = (req.headers.authorization || '').replace('Bearer ', '');
    const username = await usernameFromJwt(jwt);
    if (!username) return res.status(401).json({ error: 'Not signed in' });

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
      if (['ended', 'declined', 'missed', 'cancelled'].includes(call.status)) break;
      await sleep(400);
    }

    if (!call || (!same(call.caller_username, username) && !same(call.callee_username, username))) {
      return res.status(403).json({ error: 'Not part of this call' });
    }
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

    return res.status(200).json({ token: await at.toJwt() });
  } catch (err) {
    console.error('call-token error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}