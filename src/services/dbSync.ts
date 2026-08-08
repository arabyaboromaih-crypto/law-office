import { db } from "./firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
  setDoc,
  getDocFromServer,
  runTransaction
} from "firebase/firestore";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

// Global error handler conforming to requirements
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && (error.message || '').includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Subscribe with onSnapshot
export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  callback: (items: T[]) => void,
  seedData?: T[]
) {
  const colRef = collection(db, collectionName);

  return onSnapshot(
    colRef,
    async (snapshot) => {
      const isAlreadySeeded = localStorage.getItem(`seeded_${collectionName}`) === 'true';

      if (snapshot.empty && seedData && seedData.length > 0 && !isAlreadySeeded) {
        console.log(`Seeding collection ${collectionName} with initial data...`);
        try {
          localStorage.setItem(`seeded_${collectionName}`, 'true');
          const batch = writeBatch(db);
          seedData.forEach((item) => {
            const docRef = doc(db, collectionName, item.id);
            batch.set(docRef, item);
          });
          await batch.commit();
        } catch (err) {
          console.error(`Failed to seed collection ${collectionName}:`, err);
        }
        return;
      }

      if (snapshot.empty && !isAlreadySeeded) {
        localStorage.setItem(`seeded_${collectionName}`, 'true');
      }

      const items: T[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as T);
      });
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

// Firestore CRUD operations:

// 1. Create (Add document)
export async function addFirestoreDoc(collectionName: string, data: any, customId?: string) {
  const path = collectionName;
  try {
    if (customId) {
      const docRef = doc(db, collectionName, customId);
      const dataToSave = { ...data, id: customId };
      await setDoc(docRef, dataToSave, { merge: true });
      return { id: customId, ...dataToSave };
    } else {
      const colRef = collection(db, collectionName);
      const docRef = await addDoc(colRef, data);
      await setDoc(docRef, { ...data, id: docRef.id }, { merge: true });
      return { id: docRef.id, ...data };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// 2. Update document
export async function updateFirestoreDoc(collectionName: string, docId: string, data: any) {
  if (!docId) return;
  const path = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error(`Firestore update error for ${path}:`, error);
  }
}

// 3. Delete document
export async function deleteFirestoreDoc(collectionName: string, docId: string) {
  const path = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 4. Get documents (Get all)
export async function getFirestoreDocs<T>(collectionName: string): Promise<T[]> {
  const path = collectionName;
  try {
    const colRef = collection(db, collectionName);
    const querySnapshot = await getDocs(colRef);
    const items: T[] = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as T);
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

// 5. Process rent collection in a single Firestore Transaction (Requirement #8)
export async function processRentCollectionTransaction(params: {
  duesToProcess: any[];
  receiptsToCreate: Array<{ id: string; data: any }>;
  dueUpdates: Array<{ id: string; data: any }>;
}) {
  const { duesToProcess, receiptsToCreate, dueUpdates } = params;

  try {
    await runTransaction(db, async (transaction) => {
      // Step 1: Read and verify latest due status directly from Firestore
      for (const due of duesToProcess) {
        const dueRef = doc(db, "re_dues", due.id);
        const dueSnap = await transaction.get(dueRef);
        if (dueSnap.exists()) {
          const freshData = dueSnap.data();
          const isCollected =
            freshData.status === "collected" ||
            freshData.collectionStatus === "collected" ||
            freshData.payoutStatus === "paid_out" ||
            freshData.status === "paid_out" ||
            (freshData.collectedAmount || 0) > 0 ||
            !!freshData.receiptNumber ||
            !!freshData.paidDate;

          if (isCollected) {
            throw new Error(`ALREADY_COLLECTED:${freshData.forMonthYear || due.forMonthYear}`);
          }
        }
      }

      // Step 2: Atomic updates for re_dues & creations for re_collections
      for (const updateItem of dueUpdates) {
        const dueRef = doc(db, "re_dues", updateItem.id);
        transaction.set(dueRef, updateItem.data, { merge: true });
      }

      for (const receiptItem of receiptsToCreate) {
        const receiptRef = doc(db, "re_collections", receiptItem.id);
        transaction.set(receiptRef, { id: receiptItem.id, ...receiptItem.data });
      }
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith("ALREADY_COLLECTED:")) {
      const monthStr = error.message.split(":")[1];
      throw new Error(`🚫 تم منع تكرار التحصيل: شهر (${monthStr}) تم تحصيله بالفعل في قاعدة البيانات.`);
    }
    handleFirestoreError(error, OperationType.WRITE, "re_dues/re_collections");
  }
}

// 6. Save commission status using getDoc check, setDoc if not exists, updateDoc if exists
export async function saveCommissionStatusDoc(statusRecord: any) {
  if (!statusRecord || !statusRecord.id) {
    throw new Error("بيانات غير مكتملة: Document ID مطلوب لحفظ حالة العمولة");
  }

  const rawId = String(statusRecord.id).trim();
  if (!rawId) {
    throw new Error("Document ID غير صالح لحفظ حالة العمولة");
  }

  const cleanDocId = rawId.replace(/\s+/g, "_");
  const dataToSave = { ...statusRecord, id: cleanDocId };
  const docRef = doc(db, "re_commission_statuses", cleanDocId);

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, dataToSave);
    } else {
      await setDoc(docRef, dataToSave);
    }
    return dataToSave;
  } catch (error: any) {
    console.error(error?.message || error, error?.stack || "");
    handleFirestoreError(error, OperationType.WRITE, `re_commission_statuses/${cleanDocId}`);
    throw error;
  }
}

// 7. Atomic WriteBatch Revert for Rent Collections (Requirement #1, #2, #3, #4, #5)
export interface RevertBatchItem {
  dueId: string;
  dueDataToSet: any;
  collectionIdsToRevert: string[];
  payoutIdsToRevert: string[];
  commissionStatusIdsToReset: string[];
}

export async function executeRevertRentCollectionBatch(items: RevertBatchItem[]) {
  if (!items || items.length === 0) return;

  try {
    const batch = writeBatch(db);

    for (const item of items) {
      // 1. Restructure & set re_dues doc to uncollected/pending/overdue
      const dueRef = doc(db, "re_dues", item.dueId);
      batch.set(dueRef, item.dueDataToSet, { merge: true });

      // 2. Mark collection receipts as reverted & cancelled
      for (const collId of item.collectionIdsToRevert) {
        if (!collId) continue;
        const collRef = doc(db, "re_collections", collId);
        batch.set(collRef, {
          status: 'reverted',
          isCancelled: true,
          amountPaid: 0,
          notes: 'تم الرجوع عن التحصيل (إلغاء عملية السداد)',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 3. Mark payouts as reverted & cancelled
      for (const payoutId of item.payoutIdsToRevert) {
        if (!payoutId) continue;
        const payoutRef = doc(db, "re_payouts", payoutId);
        batch.set(payoutRef, {
          status: 'reverted',
          isCancelled: true,
          netAmountPaid: 0,
          notes: 'تم إلغاء سداد المالك للرجوع عن تحصيل الإيجار',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 4. Reset commission status
      for (const commId of item.commissionStatusIdsToReset) {
        if (!commId) continue;
        const commRef = doc(db, "re_commission_statuses", commId);
        batch.set(commRef, {
          status: 'uncollected',
          isPaid: false,
          paidAmount: 0,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }

    // Atomically commit batch to Firestore
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "re_dues/re_collections/revert_batch");
  }
}

// 8. Atomic Real Estate Backup & Restore Batch Execution
export interface RealEstateBackupPayload {
  appName?: string;
  module?: string;
  version?: string;
  createdAt?: string;
  filename?: string;
  data: {
    owners?: any[];
    properties?: any[];
    units?: any[];
    tenants?: any[];
    collections?: any[];
    payouts?: any[];
    expenses?: any[];
    advances?: any[];
    dues?: any[];
    commissionStatuses?: any[];
    deletedDues?: any[];
    logs?: any[];
  };
}

export async function restoreRealEstateBackupBatch(backupData: RealEstateBackupPayload['data']) {
  if (!backupData) return;

  const collectionsMap: { [key: string]: any[] } = {
    re_owners: backupData.owners || [],
    re_properties: backupData.properties || [],
    re_units: backupData.units || [],
    re_tenants: backupData.tenants || [],
    re_collections: backupData.collections || [],
    re_payouts: backupData.payouts || [],
    re_expenses: backupData.expenses || [],
    re_advances: backupData.advances || [],
    re_dues: backupData.dues || [],
    re_commission_statuses: backupData.commissionStatuses || [],
    re_deleted_dues: backupData.deletedDues || [],
    re_logs: backupData.logs || []
  };

  const collectionNames = Object.keys(collectionsMap);

  try {
    // Step 1: Collect existing doc IDs and execute deletes first
    const deleteOps: Array<{ colName: string; id: string }> = [];

    for (const colName of collectionNames) {
      const existingDocs = await getFirestoreDocs<{ id: string }>(colName);
      for (const docItem of existingDocs) {
        if (docItem.id) {
          deleteOps.push({ colName, id: docItem.id });
        }
      }
    }

    const BATCH_SIZE = 450;

    // Execute deletes in chunks
    for (let i = 0; i < deleteOps.length; i += BATCH_SIZE) {
      const chunk = deleteOps.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        batch.delete(doc(db, op.colName, op.id));
      }
      await batch.commit();
    }

    // Step 2: Prepare and execute set operations for restored backup data
    const setOps: Array<{ colName: string; id: string; data: any }> = [];
    for (const colName of collectionNames) {
      const items = collectionsMap[colName] || [];
      for (const item of items) {
        if (item && item.id) {
          setOps.push({ colName, id: item.id, data: item });
        }
      }
    }

    // Execute sets in chunks
    for (let i = 0; i < setOps.length; i += BATCH_SIZE) {
      const chunk = setOps.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        batch.set(doc(db, op.colName, op.id), op.data);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "real_estate_backup_restore_batch");
  }
}
