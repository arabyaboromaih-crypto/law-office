import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

const getR2FileUrl = (key) => {
  const urlObj = new URL(R2_ENDPOINT);
  return `https://${R2_BUCKET_NAME}.${urlObj.hostname}/${key}`;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const filename = req.query.filename || 'uploaded_file.pdf';

    const streamToBuffer = (stream) => {
      const chunks = [];
      return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", (err) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });
    };

    console.log(`[R2 Upload]: Reading stream for "${filename}"...`);
    const fileBuffer = await streamToBuffer(req);

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileKey = `uploads/${Date.now()}_${sanitizedFilename}`;

    console.log(`[R2 Upload]: Uploading to R2 bucket "${R2_BUCKET_NAME}" key "${fileKey}"...`);
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: req.headers["content-type"] || "application/octet-stream",
    }));

    const downloadURL = getR2FileUrl(fileKey);
    console.log(`[R2 Upload Success]: ${downloadURL}`);

    return res.status(200).json({ downloadURL, url: downloadURL });
  } catch (error) {
    console.error('[R2 Upload Error]:', error);
    return res.status(500).json({ error: error.message || 'Cloudflare R2 upload failed' });
  }
}
