// api/multipart-upload.js  (Vercel serverless function)
//
// Resumable video uploads to Cloudflare R2 via the S3 multipart API.
// The browser uploads each 10 MiB part DIRECTLY to R2 using a presigned URL,
// so nothing large goes through this function. This function only:
//   create     -> start a multipart upload, returns { key, uploadId }
//   sign-part  -> presigned PUT url for one part
//   list-parts -> which parts R2 already has (used to resume)
//   head       -> does the finished object exist? (resume after a lost "complete" response)
//   complete   -> stitch the parts into the final object
//
// Required env vars (Vercel -> Project -> Settings -> Environment Variables):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_PUBLIC_URL      public base URL of the bucket, e.g. https://cdn.zixplon.in
//                      (use the SAME base your existing uploads return)
//   SUPABASE_URL, SUPABASE_ANON_KEY   used to verify the caller is logged in
//
// Install:  npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

const crypto = require("crypto");
const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { createClient } = require("@supabase/supabase-js");

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const supabaseAuth =
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    : null;

const KEY_RE = /^videos\/[A-Za-z0-9._-]+$/;
const publicUrl = (key) => `${PUBLIC_BASE}/${key}`;

async function requireUser(req) {
  if (!supabaseAuth) return { ok: false, status: 500, error: "Auth is not configured on the server." };
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, error: "Please log in to upload." };
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: "Please log in to upload." };
  return { ok: true };
}

const isNoSuchUpload = (err) =>
  err?.name === "NoSuchUpload" || err?.Code === "NoSuchUpload" || err?.$metadata?.httpStatusCode === 404;

async function headObject(key) {
  try {
    const out = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { exists: true, size: out.ContentLength };
  } catch (err) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return { exists: false };
    throw err;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action, key, uploadId, partNumber, parts, contentType, fileName } = body;

    // ── create ──────────────────────────────────────────────────────────
    if (action === "create") {
      if (!String(contentType || "").startsWith("video/")) {
        return res.status(400).json({ error: "Only video files can be uploaded here." });
      }
      const ext =
        String(fileName || "")
          .split(".")
          .pop()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 5) || "mp4";
      const newKey = `videos/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const out = await s3.send(
        new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: newKey, ContentType: contentType })
      );
      return res.json({ key: newKey, uploadId: out.UploadId });
    }

    // Every other action needs a valid key.
    if (!KEY_RE.test(String(key || ""))) {
      return res.status(400).json({ error: "Invalid key." });
    }

    // ── sign-part ───────────────────────────────────────────────────────
    if (action === "sign-part") {
      const n = Number(partNumber);
      if (!uploadId || !Number.isInteger(n) || n < 1 || n > 10000) {
        return res.status(400).json({ error: "Invalid part." });
      }
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumber: n }),
        { expiresIn: 3600 }
      );
      return res.json({ url });
    }

    // ── list-parts ──────────────────────────────────────────────────────
    if (action === "list-parts") {
      if (!uploadId) return res.status(400).json({ error: "Missing uploadId." });
      try {
        const listed = [];
        let marker;
        for (;;) {
          const out = await s3.send(
            new ListPartsCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumberMarker: marker })
          );
          (out.Parts || []).forEach((p) =>
            listed.push({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size })
          );
          if (!out.IsTruncated) break;
          marker = out.NextPartNumberMarker;
        }
        return res.json({ parts: listed });
      } catch (err) {
        if (isNoSuchUpload(err)) return res.json({ expired: true });
        throw err;
      }
    }

    // ── head ────────────────────────────────────────────────────────────
    if (action === "head") {
      const info = await headObject(key);
      return res.json({ ...info, url: info.exists ? publicUrl(key) : null });
    }

    // ── complete ────────────────────────────────────────────────────────
    if (action === "complete") {
      if (!uploadId || !Array.isArray(parts) || parts.length === 0) {
        return res.status(400).json({ error: "Missing parts." });
      }
      try {
        await s3.send(
          new CompleteMultipartUploadCommand({
            Bucket: BUCKET,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: parts
                .map((p) => ({ PartNumber: Number(p.PartNumber), ETag: p.ETag }))
                .sort((a, b) => a.PartNumber - b.PartNumber),
            },
          })
        );
      } catch (err) {
        // The first "complete" may have succeeded but its response was lost
        // (connection dropped). Then the upload no longer exists, but the
        // final object does — treat that as success.
        if (isNoSuchUpload(err)) {
          const info = await headObject(key);
          if (info.exists) return res.json({ key, url: publicUrl(key) });
        }
        throw err;
      }
      return res.json({ key, url: publicUrl(key) });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("multipart-upload error:", err);
    return res.status(500).json({ error: err.message || "Upload server error." });
  }
};