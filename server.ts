import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GoogleGenAI } from "@google/genai";

// Read Firebase config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);
const storageInstance = getStorage(firebaseApp);

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

const getR2FileUrl = (key: string) => {
  const urlObj = new URL(R2_ENDPOINT);
  return `https://${R2_BUCKET_NAME}.${urlObj.hostname}/${key}`;
};

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

let aiClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON request bodies
  app.use(express.json());

  // Smart Case File Gemini Assistant Endpoint
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { action, caseData, query } = req.body;
      if (!caseData) {
        return res.status(400).json({ error: "بيانات القضية مطلوبة" });
      }

      let ai;
      try {
        ai = getGenAI();
      } catch (e: any) {
        return res.status(500).json({ 
          error: "⚠️ لم يتم تكوين مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) في خادم التطبيق السحابي. يرجى إضافته من لوحة التحكم في الإعدادات أولاً." 
        });
      }

      let prompt = "";
      if (action === "summarize") {
        prompt = `أنت محامٍ ومستشار قانوني مصري خبير بجميع أنواع التقاضي والدعاوى. 
يرجى قراءة وتحليل بيانات القضية التالية الممثلة بتنسيق JSON:
${JSON.stringify(caseData, null, 2)}

المطلوب: تقديم "ملخص قانوني تنفيذي وشامل" للقضية باللغة العربية بأسلوب قانوني بليغ ومحترف. 
يجب أن يشمل الملخص:
1. الموقف الحالي للقضية وأطرافها (الموكل والخصوم والصفات).
2. المحكمة المختصة والدائرة وسجل الجلسات (قرارات الجلسات السابقة ومواعيد الجلسات القادمة).
3. تحليل سريع للشق المالي (الأتعاب، المدفوع، المتبقي).
4. نصيحة عملية للمحامي عما يجب القيام به في الجلسة القادمة أو الخطوة الإجرائية اللاحقة.
رتب إجابتك باستخدام عناوين ونقاط واضحة ومنسقة بـ Markdown بشكل جذاب.`;
      } else if (action === "strategy") {
        prompt = `أنت مستشار قانوني ومخطط استراتيجي بارع للمحاكم المصرية.
اقرأ بيانات القضية التالية بعناية:
${JSON.stringify(caseData, null, 2)}

المطلوب: بناء "خطة دفاع واستراتيجية قانونية ذكية" لهذه القضية باللغة العربية.
يجب أن تشمل:
1. نقاط القوة القانونية والمستندات الداعمة لموقف الموكل.
2. الثغرات أو نقاط الضعف المتوقعة أو دفوع الخصم وكيفية الرد عليها وتفاديها.
3. الدفوع القانونية والمواد الدستورية أو القانونية المقترح التمسك بها (مثلاً: دفوع شكلية أو موضوعية تليق بنوع القضية ومرحلتها).
4. قائمة بالمستندات الإضافية المطلوب استخراجها أو إعدادها لتدعيم الملف القضائي.
نسّق الإجابة بـ Markdown بشكل احترافي ومنظم جداً ومريح للعين.`;
      } else if (action === "chat") {
        prompt = `أنت المساعد القانوني الذكي لمؤسسة رميح للمحاماة، مدمج داخل "ملف القضية الذكي" لمساعدة المحامين في القضية.
إليك بيانات القضية الحالية للرجوع إليها:
${JSON.stringify(caseData, null, 2)}

المحامي يوجه إليك السؤال أو الطلب التالي:
"${query}"

المطلوب: الإجابة على استفسار المحامي بكل دقة ومهنية قانونية بالاعتماد التام على تفاصيل القضية والقواعد القانونية المصرية المتبعة. إذا كان السؤال عن مستندات أو مبالغ أو جلسات، استخرج الإجابة بدقة من بيانات القضية. رتب الإجابة ونسقها بـ Markdown.`;
      } else {
        return res.status(400).json({ error: "الإجراء المطلوب غير مدعوم" });
      }

      let responseText = "";
      let apiSuccess = false;

      // Try a sequence of models to bypass specific model quotas
      const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
      
      for (const modelName of modelsToTry) {
        try {
          console.log(`[Gemini API]: Attempting to generate content using model: ${modelName}`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt
          });
          if (response && response.text) {
            responseText = response.text;
            apiSuccess = true;
            console.log(`[Gemini API]: Generation successful using model: ${modelName}`);
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[Gemini API Warning]: Model ${modelName} failed or quota exceeded:`, modelErr.message || modelErr);
        }
      }

      if (!apiSuccess) {
        console.log("[Gemini API Fallback]: All Gemini models failed or quota exceeded. Activating local smart legal parser...");
        responseText = generateLocalLegalFallback(action, caseData, query);
      }

      return res.json({ response: responseText });
    } catch (err: any) {
      console.error("[Gemini API Error]:", err);
      return res.status(500).json({ error: err.message || "حدث خطأ أثناء معالجة الطلب بالذكاء الاصطناعي" });
    }
  });

  // Endpoint to generate presigned upload URLs for Cloudflare R2
  app.get("/api/presign", async (req, res) => {
    try {
      const filename = req.query.filename as string;
      const contentType = req.query.contentType as string;

      if (!filename) {
        return res.status(400).json({ error: "Missing filename parameter" });
      }

      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileKey = `uploads/${Date.now()}_${sanitizedFilename}`;

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: fileKey,
        ContentType: contentType || "application/octet-stream",
      });

      // Generate a signed URL for uploading (valid for 1 hour)
      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
      const downloadURL = getR2FileUrl(fileKey);

      console.log(`[Express R2 Presign Success]: Generated URL for key ${fileKey}`);
      return res.json({ uploadUrl, downloadURL });
    } catch (err: any) {
      console.error("[Server Presign Error]:", err);
      return res.status(500).json({ error: err.message || "Failed to generate presigned URL" });
    }
  });

  // 1. Upload proxy endpoint (Uploads from server to Cloudflare R2)
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      const filename = req.query.filename as string;

      const streamToBuffer = (stream: any): Promise<Buffer> => {
        const chunks: any[] = [];
        return new Promise((resolve, reject) => {
          stream.on("data", (chunk: any) => chunks.push(chunk));
          stream.on("error", (err: any) => reject(err));
          stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
      };

      // Case A: Raw body upload (direct fetch with file in body)
      if (filename) {
        console.log(`[Express R2 Upload]: Reading raw stream for "${filename}"...`);
        const fileBuffer = await streamToBuffer(req);
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const fileKey = `uploads/${Date.now()}_${sanitizedFilename}`;

        console.log(`[Express R2 Upload]: Uploading raw buffer to bucket "${R2_BUCKET_NAME}" with key "${fileKey}"...`);
        await r2Client.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: fileKey,
          Body: fileBuffer,
          ContentType: req.headers["content-type"] || "application/octet-stream",
        }));

        const downloadURL = getR2FileUrl(fileKey);
        console.log(`[Express R2 Upload Success]: ${downloadURL}`);
        return res.json({ downloadURL, url: downloadURL });
      }

      // Case B: Multer file upload (form-data)
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileKey = `uploads/${Date.now()}_${sanitizedFilename}`;

      console.log(`[Express R2 Upload]: Uploading multipart file "${file.originalname}" to bucket "${R2_BUCKET_NAME}" with key "${fileKey}"...`);
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      }));

      const downloadURL = getR2FileUrl(fileKey);
      console.log(`[Express R2 Upload Success]: ${downloadURL}`);
      return res.json({ downloadURL, url: downloadURL });
    } catch (err: any) {
      console.error("[Server Upload Error]:", err);
      res.status(500).json({ error: err.message || "Failed to upload to Cloudflare R2" });
    }
  });

  // 2. Download/View proxy endpoint (Bypasses local ISP blocks and handles secure Cloudflare R2/Firebase storage)
  app.get("/api/proxy", async (req, res) => {
    const fileUrl = req.query.url as string;
    if (!fileUrl) {
      return res.status(400).send("Missing url parameter");
    }

    try {
      const decodedUrl = decodeURIComponent(fileUrl);
      
      // Case A: Firebase Storage URL (Stream directly)
      if (decodedUrl.startsWith("https://firebasestorage.googleapis.com")) {
        console.log(`[Server Proxy]: Fetching and streaming Firebase Storage URL: ${decodedUrl}`);
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
        console.log(`[Server Proxy]: Fetching and streaming Cloudflare R2 URL: ${decodedUrl}`);
        try {
          const urlObj = new URL(decodedUrl);
          // Key is the pathname without leading slash
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

          const stream = r2Response.Body as any;
          if (stream) {
            if (typeof stream.pipe === "function") {
              return stream.pipe(res);
            } else if (typeof stream.transformToByteArray === "function") {
              const bytes = await stream.transformToByteArray();
              return res.send(Buffer.from(bytes));
            }
          }
          return res.status(404).send("File body is empty or unavailable");
        } catch (r2Err: any) {
          console.error("[Server Proxy R2 Error]:", r2Err);
          return res.status(500).send(`Failed to stream from R2: ${r2Err.message}`);
        }
      }

      // Case C: Legacy Vercel Blob URL fallback (Stream directly using standard fetch)
      if (decodedUrl.includes("vercel-storage.com")) {
        console.log(`[Server Proxy]: Fetching and streaming legacy Vercel Blob URL: ${decodedUrl}`);
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
    } catch (err: any) {
      console.error("[Server Proxy Error]:", err);
      res.status(500).send(err.message || "Proxy failed");
    }
  });

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite development middleware vs. static build folder serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

function generateLocalLegalFallback(action: string, caseData: any, query: string = ""): string {
  const clientName = caseData.clientName || "غير محدد";
  const opponentName = caseData.opponent?.name || "غير محدد";
  const opponentLawyer = caseData.opponent?.lawyer || "غير محدد";
  const court = caseData.court || "غير محدد";
  const circuit = caseData.circuit || "غير محدد";
  const degree = caseData.degree || "أول درجة";
  const type = caseData.type || "غير محدد";
  const subject = caseData.subject || "غير محدد";
  const nextHearingDate = caseData.nextHearingDate || "لم يحدد بعد";
  const nextHearingTime = caseData.nextHearingTime || "";
  const totalFees = caseData.totalFees || 0;
  const paidFees = caseData.paidFees || 0;
  const remainingFees = caseData.remainingFees || 0;
  const officeFileNo = caseData.officeFileNo || "غير مسجل";

  if (action === "summarize") {
    let typeSpecificAdvice = "";
    if (type.includes("جنائي") || type.includes("جنح")) {
      typeSpecificAdvice = `*   **الشق الجنائي والنيابة العامة:** الدعوى تتبع القضاء الجنائي/الجنح. يتعين مراجعة المحاضر الرسمية، واستخراج شهادات من واقع الجدول بقرار النيابة إن وجد، والتحضير لتقديم مذكرات الدفاع الشفوية والمكتوبة وتفنيد أقوال الشهود أو محاضر الضبط والتحري.`;
    } else if (type.includes("مدني") || type.includes("تجاري") || type.includes("إيجارات")) {
      typeSpecificAdvice = `*   **الشق المدني والتعاقدي:** يتعين مراجعة العقود والالتزامات المتبادلة بين الأطراف، وتجهيز حوافظ مستندات مرتبة لإثبات الإخلال أو الوفاء بالالتزامات، والتحضير للمطالبة بالتعويضات أو الإحالة للخبراء عند اللزوم.`;
    } else if (type.includes("أحوال")) {
      typeSpecificAdvice = `*   **مسائل الأسرة والأحوال شخصية:** مراجعة إعلانات الخصم، وتجهيز وثائق الحالة المدنية والشهود لإثبات الدفوع الشرعية والقانونية، وضمان مراجعة قرارات مكتب التسوية والنيابة المختصة بحسب الأحوال.`;
    } else {
      typeSpecificAdvice = `*   **الإجراءات الموضوعية:** التأكد من إعداد مذكرات الدفاع بدقة وتنسيق حوافظ المستندات وإرفاقها بملف الدعوى وتجهيز إيصالات الإعلان بالطلبات العارضة أو الإدخال القانوني لضمان سلامة الشكل والموضوع.`;
    }

    return `### 📋 ملخص قانوني تنفيذي للملف القضائي
> **💡 تنبيه الخبير الاحتياطي:** تم تفعيل محرك التحليل الذاتي الذكي للمكتب لضمان استمرارية العمل لعدم توفر اتصال بالشبكة السحابية للذكاء الاصطناعي حالياً.

#### 1️⃣ التوصيف القانوني وأطراف النزاع
*   **اسم الموكل (الصفة الحالية):** ${clientName}
*   **اسم الخصم (صفة الخصم):** ${opponentName}
*   **محامي الخصم:** ${opponentLawyer}
*   **نوع وموضوع الدعوى:** ${type} - ${subject}
*   **درجة التقاضي الحالية:** ${degree} (رقم الملف بالمكتب: ${officeFileNo})

#### 2️⃣ الهيئة القضائية وجدول الجلسات
*   **المحكمة المختصة:** ${court}
*   **الدائرة القضائية:** دائرة ${circuit}
*   **الجلسة القادمة:** ${nextHearingDate} ${nextHearingTime ? `الساعة ${nextHearingTime}` : ""}
*   **الوضع الإجرائي الحالي:** ${caseData.status || "قيد التداول"}

#### 3️⃣ الموقف المالي للملف
*   **إجمالي الأتعاب المتفق عليها:** ${totalFees.toLocaleString()} ج.م
*   **المبلغ المسدد حالياً:** ${paidFees.toLocaleString()} ج.م
*   **المتبقي المستحق:** ${remainingFees.toLocaleString()} ج.م (${remainingFees === 0 ? "ملف مسدد بالكامل" : "يستوجب تحصيل المتبقي"})

---

#### 4️⃣ التوصيات الإجرائية والنصائح العملية للجلسة القادمة
${typeSpecificAdvice}
*   **متابعة الجلسات:** يوصى السكرتير الإداري أو المحامي المتابع بتجهيز أصل توكيل الموكل، ومتابعة القرار الصادر في الجلسة السابقة لضمان تنفيذه قبل حلول تاريخ الجلسة القادمة (${nextHearingDate}).
*   **المستندات الحالية:** يحتوي الملف على عدد (${caseData.files?.length || 0}) من المستندات والملفات المرفوعة. يرجى التأكد من طباعة وتجهيز النسخ الورقية لتقديمها في حافظة رسمية للهيئة الموقرة.`;
  }

  if (action === "strategy") {
    let strategyAdvice = "";
    if (degree === "نقض") {
      strategyAdvice = `*   **الطعن أمام محكمة النقض العليا:**
    1. التركيز التام على "العيوب القانونية" في حكم محكمة الاستئناف (الخطأ في تطبيق القانون، البطلان الجوهري، القصور في التسبيب).
    2. محكمة النقض محكمة قانون وليست محكمة موضوع، لذا يمنع إثارة دفوع موضوعية جديدة لم تُعرض على محكمة الاستئناف.
    3. إيداع مذكرة أسباب الطعن في الميعاد القانوني موقعة من محامٍ مقبول أمام محكمة النقض.`;
    } else if (degree === "استئناف") {
      strategyAdvice = `*   **خطة مرحلة الاستئناف:**
    1. نقد أسباب حكم أول درجة وتفنيدها نقطة تلو الأخرى بالدليل القانوني والواقعي.
    2. التمسك بطلب إحالة الدعوى للتحقيق أو الخبراء لتدارك ما فات حكم أول درجة من قصور أو فساد في الاستدلال.
    3. تقديم مستندات جديدة حاسمة لتغيير وجه الحق في الدعوى مسموح بها قانوناً في هذه المرحلة لطلب إلغاء الحكم المستأنف والطلبات مجدداً.`;
    } else {
      strategyAdvice = `*   **خطة مرحلة أول درجة (التأسيس):**
    1. **الدفوع الشكلية أولاً:** إثارة الدفوع المتعلقة بالنظام العام (مثال: عدم الاختصاص الولائي أو القيمي، بطلان الإعلان) قبل الدخول في الموضوع.
    2. **تثبيت الموقف الموضوعي:** تقديم حوافظ المستندات والمستندات الكتابية الرسمية التي تثبت مبررات الطلبات بشكل قاطع.
    3. **طلب الإحالة للتحقيق أو ندب خبير:** إذا تطلبت القضية فحصاً فنيّاً أو هندسياً أو مالياً لإثبات الحق، للتمهيد لصدور حكم تمهيدي يصب في صالح الموكل.`;
    }

    return `### 🎯 الاستراتيجية القانونية وخطة الدفاع للملف القضائي
> **💡 تنبيه الخبير الاحتياطي:** تم تفعيل محرك الاستراتيجية الذاتي للمكتب لضمان استمرارية العمل لعدم توفر اتصال بالشبكة السحابية للذكاء الاصطناعي حالياً.

#### 1️⃣ أهداف استراتيجية الدفاع لموقف الموكل [${clientName}]
*   **الهدف الرئيسي:** تأمين مصالح الموكل ضد ادعاءات الخصم [${opponentName}] وتحقيق مكاسب قانونية بناءً على موضوع الدعوى: *${subject}*.
*   **نقاط القوة الداعمة في الملف:**
    *   اكتمال بيانات ومستندات القضية المودعة في الأرشيف الإلكتروني للمكتب (يحتوي الملف على ${caseData.files?.length || 0} مستندات).
    *   وضوح موضوع النزاع وتثبيت المحكمة المختصة: **${court}** ودائرة انعقادها: **دائرة ${circuit}**.

#### 2️⃣ الدفوع وخطة العمل القانونية طبقاً لدرجة التقاضي (${degree})
${strategyAdvice}

---

#### 3️⃣ قائمة الإجراءات والمستندات المطلوبة فوراً
*   **استخراج شهادات رسمية:** مراجعة المحاضر الإدارية المرتبطة بالخصومة إن وجدت.
*   **إعلان الخصوم:** التأكد من تمام الإعلانات القانونية وصحة تدوين الصفات والعناوين لتلافي بطلان الإجراءات.
*   **إعداد مذكرة الدفاع المكتوبة:** ينصح بإرفاق مسودة مذكرة الدفاع بملف القضية ومراجعتها مع المحامي المسؤول قبل الجلسة بـ 48 ساعة على الأقل.`;
  }

  // action === "chat"
  const qClean = query.toLowerCase();
  let chatResponse = "";

  if (qClean.includes("مال") || qClean.includes("فلوس") || qClean.includes("سداد") || qClean.includes("أتعاب") || qClean.includes("حساب")) {
    chatResponse = `**الموقف المالي الدقيق للملف القضائي:**
*   **إجمالي الأتعاب المتفق عليها:** ${totalFees.toLocaleString()} ج.م
*   **المسدد منها حتى الآن:** ${paidFees.toLocaleString()} ج.م
*   **المتبقي في ذمة الموكل:** ${remainingFees.toLocaleString()} ج.م
${remainingFees > 0 ? `*⚠️ يوصى السكرتير بالتواصل مع الموكل لتنسيق جدولة أو دفع المبلغ المتبقي المستحق وهو **${remainingFees.toLocaleString()} ج.م**.` : "*✅ الموقف المالي مستقر تماماً والملف مسدد بالكامل.*"}`;
  } else if (qClean.includes("جلس") || qClean.includes("تاريخ") || qClean.includes("موعد") || qClean.includes("وقت")) {
    chatResponse = `**جدول ومواعيد جلسات القضية:**
*   **تاريخ الجلسة القادمة المقررة:** ${nextHearingDate}
*   **وقت الانعقاد المقدر:** ${nextHearingTime ? `الساعة ${nextHearingTime}` : "صباحاً أثناء انعقاد الرول الكلي للدائرة"}
*   **المحكمة المختصة:** ${court}
*   **رقم الدائرة القضائية:** دائرة ${circuit}
*   **الحالة الحالية المقيدة بالدعوى:** ${caseData.status || "قيد المتابعة والتداول"}`;
  } else if (qClean.includes("محكم") || qClean.includes("دائر") || qClean.includes("قاض") || qClean.includes("مكان")) {
    chatResponse = `**تفاصيل الهيئة القضائية ومقرها:**
*   **درجة التقاضي والجهة:** ${degree} - ${court}
*   **رقم الدائرة الحالية:** دائرة ${circuit}
*   **موضوع ومجال التخصص:** قضية ${type} في موضوع: ${subject}
*   **مقر الانعقاد التفصيلي:** ${caseData.venueFirstInstance || caseData.venueSecondInstance || "مقر المحكمة الرئيسي"}`;
  } else if (qClean.includes("ملف") || qClean.includes("مستند") || qClean.includes("ورق") || qClean.includes("ملفات")) {
    chatResponse = `**ملخص المستندات المودعة بالأرشيف للملف الحالي:**
*   **إجمالي الملفات المرفوعة:** ${caseData.files?.length || 0} ملف(ات) إلكتروني.
${caseData.files && caseData.files.length > 0 ? caseData.files.map((f: any, idx: number) => `  ${idx + 1}. **${f.name}** (${f.category || "عام"}) - تاريخ الرفع: ${f.uploadDate || "غير متوفر"}`).join("\n") : "*⚠️ لا توجد ملفات مرفوعة إلكترونياً على هذا الملف حتى الآن. يمكنك استخدام مدير الرفع المتعدد لإرفاق المستندات والعقود لتوثيق القضية.*"}`;
  } else {
    chatResponse = `مرحباً بك زميلي المستشار. كوني المساعد القانوني الاحتياطي لمؤسسة رميح للمحاماة، يسعدني الإجابة على استفسارك بخصوص القضية الحالية لـ **الموكل: ${clientName}** ضد **الخصم: ${opponentName}** في موضوع: *${subject}*.

إليك موجز تفاصيل القضية للإجابة على سؤالك:
*   **المحكمة والدائرة:** ${court} - دائرة ${circuit}
*   **تاريخ الجلسة القادمة:** ${nextHearingDate} (${caseData.status || "قيد التداول"})
*   **الموقف المالي:** إجمالي الأتعاب ${totalFees.toLocaleString()} ج.م، المسدد ${paidFees.toLocaleString()} ج.م، المتبقي ${remainingFees.toLocaleString()} ج.م.

إذا كنت ترغب في استعلام محدد عن التواريخ، الرسوم، الخصوم أو المستندات، يرجى كتابة سؤالك بوضوح وسأقوم بفرز وتحليل بيانات القضية الدقيقة فوراً ومساعدتك بالدفاع الاستراتيجي!`;
  }

  return `### 💬 المساعد القانوني الذكي (الوضع الاحتياطي الفوري)
> **💡 تنبيه الخبير الاحتياطي:** تم تفعيل محرك الردود التلقائي للمكتب لضمان استمرارية الرد الفوري لعدم توفر اتصال بالشبكة السحابية للذكاء الاصطناعي حالياً.

${chatResponse}`;
}
