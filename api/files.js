import upload from '../server/upload.js';
import uploadUrl from '../server/uploadUrl.js';

// Needed by upload.js (it reads the raw multipart stream itself)
export const config = {
  api: { bodyParser: false },
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  const action = req.query.action;

  if (action === 'upload') {
    return upload(req, res);
  }

  if (action === 'upload-url') {
    try {
      req.body = await readJsonBody(req);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    return uploadUrl(req, res);
  }

  return res.status(404).json({ error: 'Unknown action' });
}