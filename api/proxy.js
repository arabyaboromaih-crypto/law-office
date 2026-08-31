import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Configure Cloudflare R2 Connection
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "60aba243d1a2c882097750dd21e08cec";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "9d845cb3a6d0b7152722b11b48a6bc3ce9fed59b1c5a74b124bc79b5bacbd420";
const R2_ENDPOINT = process.env.R2_ENDPOINT || "https://b4a4577efe20571572e0ffd097128138.r2.cloudflarestorage.com";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "law-office-files";

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const fileUrl = req.query.url;
  if (!fileUrl) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const decodedUrl = decodeURIComponent(fileUrl);
    
    // Case A: Firebase Storage URL (Stream directly)
    if (decodedUrl.startsWith("https://firebasestorage.googleapis.com")) {
      console.log(`[Proxy Serverless]: Fetching and streaming Firebase Storage URL: ${decodedUrl}`);
      const response = await fetch(decodedUrl);
      if (!response.ok) {
        return res.status(response.status).send("Failed to fetch file from Storage");
      }

      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      res.setHeader("Content-Disposition", "inline");

      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } 
    
    // Case B: Cloudflare R2 URL (Fetch from R2 via S3 SDK GetObjectCommand and stream)
    if (decodedUrl.includes("cloudflarestorage.com")) {
      console.log(`[Proxy Serverless]: Fetching and streaming Cloudflare R2 URL: ${decodedUrl}`);
      try {
        const urlObj = new URL(decodedUrl);
        const key = decodeURIComponent(urlObj.pathname.substring(1));

        const command = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        });

        const r2Response = await r2Client.send(command);
        
        if (r2Response.ContentType) {
          res.setHeader("Content-Type", r2Response.ContentType);
        }
        if (r2Response.ContentLength) {
          res.setHeader("Content-Length", r2Response.ContentLength);
        }
        res.setHeader("Content-Disposition", "inline");

        const stream = r2Response.Body;
        if (stream) {
          if (typeof stream.pipe === "function") {
            return stream.pipe(res);
          } else if (typeof stream.transformToByteArray === "function") {
            const bytes = await stream.transformToByteArray();
            return res.send(Buffer.from(bytes));
          }
        }
        return res.status(404).send("File body is empty or unavailable");
      } catch (r2Err) {
        console.error("[Proxy Serverless R2 Error]:", r2Err);
        return res.status(500).send(`Failed to stream from R2: ${r2Err.message}`);
      }
    }

    // Case C: Legacy Vercel Blob URL fallback
    if (decodedUrl.includes("vercel-storage.com")) {
      console.log(`[Proxy Serverless]: Fetching and streaming legacy Vercel Blob URL: ${decodedUrl}`);
      const response = await fetch(decodedUrl);
      if (!response.ok) {
        return res.status(response.status).send("Failed to fetch file from legacy storage");
      }

      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      res.setHeader("Content-Disposition", "inline");

      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    return res.status(400).send("Invalid URL domain");
  } catch (error) {
    console.error('[Proxy Serverless Error]:', error);
    return res.status(500).send(`Proxy internal error: ${error.message}`);
  }
}
