import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const filename = req.query.filename;
    const contentType = req.query.contentType;

    if (!filename) {
      return res.status(400).json({ error: 'Missing filename parameter' });
    }

    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileKey = `uploads/${Date.now()}_${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    const downloadURL = getR2FileUrl(fileKey);

    console.log(`[R2 Presign Success]: Generated URL for key ${fileKey}`);

    return res.status(200).json({ uploadUrl, downloadURL });
  } catch (error) {
    console.error('[R2 Presign Error]:', error);
    return res.status(500).json({ error: error.message || 'Presign URL generation failed' });
  }
}
