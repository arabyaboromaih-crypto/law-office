/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UploadTask {
  id: string;
  file: File;
  compressedFile?: File;
  progress: number;
  status: 'waiting' | 'compressing' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  downloadURL?: string;
  abort?: () => void;
  retry?: () => void;
}

/**
 * Saves a file (Blob or File) into a permanent IndexedDB database.
 */
export function saveFileToIndexedDB(fileId: string, fileBlob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const dbRequest = indexedDB.open('PdfViewerDBV2', 1);
      dbRequest.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pdfBlobs')) {
          db.createObjectStore('pdfBlobs');
        }
      };
      dbRequest.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const tx = db.transaction('pdfBlobs', 'readwrite');
          const store = tx.objectStore('pdfBlobs');
          const storeRequest = store.put(fileBlob, fileId);
          storeRequest.onsuccess = () => {
            resolve();
          };
          storeRequest.onerror = (err) => {
            console.error('IndexedDB store put error:', err);
            reject(err);
          };
        } catch (err) {
          console.error('Failed to write transaction to IndexedDB:', err);
          reject(err);
        }
      };
      dbRequest.onerror = (err) => {
        console.error('IndexedDB connection error:', err);
        reject(err);
      };
    } catch (err) {
      console.error('IndexedDB wrapper error:', err);
      reject(err);
    }
  });
}

/**
 * Retrieves a permanently stored file (Blob) from IndexedDB by its unique ID.
 */
export function getFileFromIndexedDB(fileId: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const dbRequest = indexedDB.open('PdfViewerDBV2', 1);
      dbRequest.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pdfBlobs')) {
          db.createObjectStore('pdfBlobs');
        }
      };
      dbRequest.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const tx = db.transaction('pdfBlobs', 'readonly');
          const store = tx.objectStore('pdfBlobs');
          const getRequest = store.get(fileId);
          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };
          getRequest.onerror = () => {
            resolve(null);
          };
        } catch (err) {
          console.error('Failed to read transaction from IndexedDB:', err);
          resolve(null);
        }
      };
      dbRequest.onerror = () => {
        resolve(null);
      };
    } catch (err) {
      console.error('IndexedDB open error:', err);
      resolve(null);
    }
  });
}

/**
 * Compresses an image client-side before uploading, maintaining high quality but reducing size.
 */
export function compressImage(file: File, maxW = 2048, maxH = 2048, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type.includes('svg')) {
      // Non-images or SVGs are not compressed
      return resolve(file);
    }
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate dimensions within limits while maintaining aspect ratio
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // fallback to original
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            return resolve(file);
          }
          const compressedFile = new File([blob], file.name, {
            type: file.type || 'image/jpeg',
            lastModified: Date.now()
          });
          // Only return compressed if it's actually smaller!
          if (compressedFile.size < file.size) {
            console.log(`[Image Compressor]: Compressed "${file.name}" from ${(file.size/1024/1024).toFixed(2)}MB to ${(compressedFile.size/1024/1024).toFixed(2)}MB`);
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, file.type || 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Validates a file's size (max 50MB) and format.
 */
export function validateFile(file: File, allowedTypes: string[] = []): { valid: boolean; error?: string } {
  const maxSizeBytes = 50 * 1024 * 1024; // 50MB limit
  if (file.size > maxSizeBytes) {
    return { valid: false, error: 'الملف كبير جداً. الحد الأقصى لحجم الملف هو 50 ميجابايت.' };
  }
  
  if (allowedTypes.length > 0) {
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    const fileMime = file.type?.toLowerCase();
    
    const isAllowed = allowedTypes.some(type => {
      const cleanType = type.toLowerCase();
      if (cleanType.startsWith('.')) {
        return fileExt === cleanType;
      }
      if (cleanType.endsWith('/*')) {
        const prefix = cleanType.slice(0, -2);
        return fileMime?.startsWith(prefix);
      }
      return fileMime === cleanType;
    });
    
    if (!isAllowed) {
      return { valid: false, error: `صيغة الملف غير مدعومة. الصيغ المسموح بها: ${allowedTypes.join(', ')}` };
    }
  }
  
  return { valid: true };
}

/**
 * Uploads a file to Cloudflare R2 storage by fetching a presigned URL from our backend
 * and uploading the file directly from the browser. Supports upload progress.
 */
export function uploadToR2WithProgress(
  file: File,
  onProgress: (progress: number) => void,
  onStatusChange: (status: UploadTask['status'], error?: string) => void
): { promise: Promise<string>; abort: () => void } {
  let xhr: XMLHttpRequest | null = null;
  let aborted = false;

  const abort = () => {
    aborted = true;
    if (xhr) {
      xhr.abort();
    }
    onStatusChange('cancelled');
  };

  const promise = new Promise<string>(async (resolve, reject) => {
    try {
      // Step 1: Compress if image
      onStatusChange('compressing');
      let fileToUpload = file;
      if (file.type.startsWith('image/') && !file.type.includes('svg')) {
        try {
          fileToUpload = await compressImage(file);
        } catch (err) {
          console.warn('[Compressor Warning]: Compression failed, uploading original', err);
        }
      }

      if (aborted) {
        reject(new Error('cancelled'));
        return;
      }

      onStatusChange('uploading');
      
      const contentType = fileToUpload.type || "application/octet-stream";
      console.log(`[XHR R2 Upload]: Fetching presigned URL for "${fileToUpload.name}"...`);
      const presignResponse = await fetch(`/api/presign?filename=${encodeURIComponent(fileToUpload.name)}&contentType=${encodeURIComponent(contentType)}`);

      if (!presignResponse.ok) {
        const errorText = await presignResponse.text();
        throw new Error(errorText || "فشل الحصول على رابط الرفع الموقع.");
      }

      if (aborted) {
        reject(new Error('cancelled'));
        return;
      }

      const { uploadUrl, downloadURL } = await presignResponse.json();

      if (!uploadUrl || !downloadURL) {
        throw new Error("لم يتم استلام روابط الرفع والتحميل من السيرفر.");
      }

      // Step 2: Perform upload via XMLHttpRequest to track progress
      xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr && xhr.status >= 200 && xhr.status < 300) {
          console.log(`[XHR R2 Upload Success]: ${downloadURL}`);
          onStatusChange('completed');
          resolve(downloadURL);
        } else {
          const errMsg = xhr ? `XHR failed with status ${xhr.status}` : 'Upload failed';
          onStatusChange('failed', errMsg);
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        onStatusChange('failed', 'خطأ في الاتصال بالسيرفر أثناء الرفع');
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        onStatusChange('cancelled');
        reject(new Error('cancelled'));
      };

      xhr.send(fileToUpload);
    } catch (error: any) {
      if (aborted) {
        reject(new Error('cancelled'));
      } else {
        onStatusChange('failed', error.message || String(error));
        reject(error);
      }
    }
  });

  return { promise, abort };
}

/**
 * Uploads a file to Cloudflare R2 storage (legacy helper).
 */
export async function uploadToR2(file: File): Promise<string> {
  console.log(`[R2 Upload Helper]: Requesting presigned URL for "${file.name}"...`);
  
  const contentType = file.type || "application/octet-stream";
  const presignResponse = await fetch(`/api/presign?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(contentType)}`);

  if (!presignResponse.ok) {
    const errorText = await presignResponse.text();
    let errorParsed;
    try {
      errorParsed = JSON.parse(errorText);
    } catch (e) {}
    throw new Error(errorParsed?.error || errorText || "فشل الحصول على رابط الرفع الموقع.");
  }

  const { uploadUrl, downloadURL } = await presignResponse.json();

  if (!uploadUrl || !downloadURL) {
    throw new Error("لم يتم استلام روابط الرفع والتحميل من السيرفر.");
  }

  console.log(`[R2 Upload Helper]: Uploading file directly to Cloudflare R2...`);

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`فشل رفع الملف إلى التخزين السحابي R2: ${errorText || uploadResponse.statusText}`);
  }

  console.log(`[R2 Upload Helper Success]: ${downloadURL}`);
  return downloadURL;
}

// Export uploadToVercelBlob as an alias for full backward compatibility
export const uploadToVercelBlob = uploadToR2;

/**
 * Returns a proxied URL for files that are hosted on Firebase Storage, Vercel Blob, or Cloudflare R2
 * to ensure they are accessible without ISP blocks or private access errors.
 */
export function getProxiedUrl(fileUrl: string | undefined): string {
  if (!fileUrl || fileUrl === '#') return '#';
  if (fileUrl.startsWith('http')) {
    if (
      fileUrl.startsWith('https://firebasestorage.googleapis.com') || 
      fileUrl.includes('vercel-storage.com') ||
      fileUrl.includes('cloudflarestorage.com')
    ) {
      return `/api/proxy?url=${encodeURIComponent(fileUrl)}`;
    }
  }
  return fileUrl;
}



