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
      if (snapshot.empty) {
        const isSeeded = localStorage.getItem(`seeded_${collectionName}`) === 'true';
        if (seedData && seedData.length > 0 && !isSeeded) {
          console.log(`Initializing collection ${collectionName} with seed data...`);
          try {
            localStorage.setItem(`seeded_${collectionName}`, 'true');
            const batch = writeBatch(db);
            seedData.forEach((item) => {
              const docRef = doc(db, collectionName, item.id);
              batch.set(docRef, item);
            });
            await batch.commit();
            callback(seedData);
            return;
          } catch (err) {
            console.error(`Failed to seed collection ${collectionName}:`, err);
          }
        }
        localStorage.setItem(`seeded_${collectionName}`, 'true');
        callback([]);
        return;
      }

      localStorage.setItem(`seeded_${collectionName}`, 'true');

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
    handleFirestoreError(error, OperationType.UPDATE, path);
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

// Permanently delete document and record deletion in re_deleted_entities
export async function markEntityAsDeleted(collectionName: string, docId: string) {
  const path = `${collectionName}/${docId}`;

  // 1. Delete document from collection
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting doc ${path}:`, error);
  }

  // 2. Save tombstone record in re_deleted_entities collection for historical logging
  try {
    const delRef = doc(db, 're_deleted_entities', docId);
    await setDoc(delRef, {
      id: docId,
      collectionName,
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error recording deletion in re_deleted_entities for ${docId}:`, error);
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

// 8. Save rent adjustment per tenant and month
export async function saveRentAdjustmentDoc(adjustment: any) {
  if (!adjustment || !adjustment.tenantId || !adjustment.forMonthYear) {
    throw new Error("بيانات غير مكتملة: tenantId و forMonthYear مطلوبان لحفظ تعديل الإيجار");
  }

  const rawId = adjustment.id || `adj_${adjustment.tenantId}_${adjustment.forMonthYear}`;
  const cleanDocId = String(rawId).trim().replace(/\s+/g, "_");
  const dataToSave = { 
    ...adjustment, 
    id: cleanDocId,
    updatedAt: adjustment.updatedAt || new Date().toISOString()
  };
  const docRef = doc(db, "re_rent_adjustments", cleanDocId);

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, dataToSave);
    } else {
      await setDoc(docRef, dataToSave);
    }

    // Update local storage cache for instant offline/reload resilience
    try {
      const cached: any[] = JSON.parse(localStorage.getItem('re_rent_adjustments_cache') || '[]');
      const index = cached.findIndex(a => a.id === cleanDocId || (a.tenantId === dataToSave.tenantId && a.forMonthYear === dataToSave.forMonthYear));
      if (index >= 0) {
        cached[index] = dataToSave;
      } else {
        cached.push(dataToSave);
      }
      localStorage.setItem('re_rent_adjustments_cache', JSON.stringify(cached));
    } catch (e) {}

    return dataToSave;
  } catch (error: any) {
    console.error(error?.message || error, error?.stack || "");
    handleFirestoreError(error, OperationType.WRITE, `re_rent_adjustments/${cleanDocId}`);
    throw error;
  }
}

// 9. Atomic Real Estate Backup & Restore Batch Execution
export interface RealEstateBackupPayload {
  appId?: string;
  appName?: string;
  module?: string;
  version?: string;
  createdAt?: string;
  exportedBy?: string;
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
    rentAdjustments?: any[];
    logs?: any[];
  };
}

// Fetch all real estate records directly from live primary Firestore database
export async function fetchRealEstateLiveSnapshot(): Promise<RealEstateBackupPayload['data']> {
  const [
    reOwners,
    reProperties,
    reUnits,
    reTenants,
    reCollections,
    rePayouts,
    reExpenses,
    reAdvances,
    reDues,
    reCommStatuses,
    reDeletedDues,
    reRentAdjustments,
    reLogs
  ] = await Promise.all([
    getFirestoreDocs<any>('re_owners').catch(() => []),
    getFirestoreDocs<any>('re_properties').catch(() => []),
    getFirestoreDocs<any>('re_units').catch(() => []),
    getFirestoreDocs<any>('re_tenants').catch(() => []),
    getFirestoreDocs<any>('re_collections').catch(() => []),
    getFirestoreDocs<any>('re_payouts').catch(() => []),
    getFirestoreDocs<any>('re_expenses').catch(() => []),
    getFirestoreDocs<any>('re_advances').catch(() => []),
    getFirestoreDocs<any>('re_dues').catch(() => []),
    getFirestoreDocs<any>('re_commission_statuses').catch(() => []),
    getFirestoreDocs<any>('re_deleted_dues').catch(() => []),
    getFirestoreDocs<any>('re_rent_adjustments').catch(() => []),
    getFirestoreDocs<any>('re_logs').catch(() => [])
  ]);

  return {
    owners: reOwners || [],
    properties: reProperties || [],
    units: reUnits || [],
    tenants: reTenants || [],
    collections: reCollections || [],
    payouts: rePayouts || [],
    expenses: reExpenses || [],
    advances: reAdvances || [],
    dues: reDues || [],
    commissionStatuses: reCommStatuses || [],
    deletedDues: reDeletedDues || [],
    rentAdjustments: reRentAdjustments || [],
    logs: reLogs || []
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
    re_rent_adjustments: backupData.rentAdjustments || [],
    re_logs: backupData.logs || []
  };

  const collectionNames = Object.keys(collectionsMap);

  try {
    // Step 1: Collect existing doc IDs and execute deletes first
    const deleteOps: Array<{ colName: string; id: string }> = [];

    for (const colName of collectionNames) {
      const existingDocs = await getFirestoreDocs<{ id: string }>(colName).catch(() => []);
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

    // Step 3: Remove tombstones from re_deleted_entities for restored items
    try {
      const restoredIds = new Set<string>();
      Object.values(collectionsMap).forEach(arr => {
        arr.forEach((item: any) => {
          if (item?.id) restoredIds.add(item.id);
        });
      });
      for (const id of restoredIds) {
        await deleteDoc(doc(db, 're_deleted_entities', id)).catch(() => {});
      }
    } catch (e) {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "real_estate_backup_restore_batch");
  }
}

// 9. Complete Judicial Portal & System-wide Backup & Restore
export interface FullSystemBackupPayload {
  appId: string;
  appName?: string;
  version: string;
  exportDate: string;
  exportedBy: string;
  data: {
    users?: any[];
    clients?: any[];
    companies?: any[];
    cases?: any[];
    sessions?: any[];
    auditLogs?: any[];
    tasks?: any[];
    opponents?: any[];
    notifications?: any[];
    office_settings?: any;
    settings?: Record<string, any>;
    // Optional full Real Estate dataset included inside system backup
    realEstate?: RealEstateBackupPayload['data'];
  };
}

// Fetch all collections directly from central Firestore and localStorage settings for a complete snapshot
export async function createFullSystemBackupSnapshot(currentUserFullName: string): Promise<FullSystemBackupPayload> {
  const [
    users,
    clients,
    companies,
    cases,
    sessions,
    auditLogs,
    tasks,
    opponents,
    notifications,
    settingsDocs,
    officeSettingsDocs,
    // Real estate docs
    reOwners,
    reProperties,
    reUnits,
    reTenants,
    reCollections,
    rePayouts,
    reExpenses,
    reAdvances,
    reDues,
    reCommStatuses,
    reDeletedDues,
    reLogs
  ] = await Promise.all([
    getFirestoreDocs<any>('users').catch(() => []),
    getFirestoreDocs<any>('clients').catch(() => []),
    getFirestoreDocs<any>('companies').catch(() => []),
    getFirestoreDocs<any>('cases').catch(() => []),
    getFirestoreDocs<any>('sessions').catch(() => []),
    getFirestoreDocs<any>('auditLogs').catch(() => []),
    getFirestoreDocs<any>('tasks').catch(() => []),
    getFirestoreDocs<any>('opponents').catch(() => []),
    getFirestoreDocs<any>('notifications').catch(() => []),
    getFirestoreDocs<any>('settings').catch(() => []),
    getFirestoreDocs<any>('office_settings').catch(() => []),
    getFirestoreDocs<any>('re_owners').catch(() => []),
    getFirestoreDocs<any>('re_properties').catch(() => []),
    getFirestoreDocs<any>('re_units').catch(() => []),
    getFirestoreDocs<any>('re_tenants').catch(() => []),
    getFirestoreDocs<any>('re_collections').catch(() => []),
    getFirestoreDocs<any>('re_payouts').catch(() => []),
    getFirestoreDocs<any>('re_expenses').catch(() => []),
    getFirestoreDocs<any>('re_advances').catch(() => []),
    getFirestoreDocs<any>('re_dues').catch(() => []),
    getFirestoreDocs<any>('re_commission_statuses').catch(() => []),
    getFirestoreDocs<any>('re_deleted_dues').catch(() => []),
    getFirestoreDocs<any>('re_logs').catch(() => [])
  ]);

  // Capture local settings keys
  const settingsKeys = [
    'romeih_office_name',
    'romeih_office_subtitle',
    'romeih_office_address',
    'romeih_office_whatsapp',
    'romeih_office_email',
    'romeih_numbering_system',
    'romeih_tpl_session',
    'romeih_tpl_task',
    'romeih_general_director_assigned',
    'romeih_settings_unlocked'
  ];

  const localSettings: Record<string, any> = {};
  settingsKeys.forEach(k => {
    const val = localStorage.getItem(k);
    if (val !== null) {
      localSettings[k] = val;
    }
  });

  return {
    appId: 'romeih_judicial_portal',
    appName: 'مؤسسة رميح للمحاماة والاستشارات القانونية',
    version: '2.0',
    exportDate: new Date().toISOString(),
    exportedBy: currentUserFullName || 'المدير العام',
    data: {
      users,
      clients,
      companies,
      cases,
      sessions,
      auditLogs,
      tasks,
      opponents,
      notifications,
      office_settings: officeSettingsDocs?.[0] || null,
      settings: localSettings,
      realEstate: {
        owners: reOwners,
        properties: reProperties,
        units: reUnits,
        tenants: reTenants,
        collections: reCollections,
        payouts: rePayouts,
        expenses: reExpenses,
        advances: reAdvances,
        dues: reDues,
        commissionStatuses: reCommStatuses,
        deletedDues: reDeletedDues,
        logs: reLogs
      }
    }
  };
}

// Restore full system backup directly to central Firestore & local storage
export async function restoreFullSystemBackup(backupData: FullSystemBackupPayload['data']) {
  if (!backupData) {
    throw new Error('بيانات النسخة الاحتياطية فارغة أو غير صالحة.');
  }

  const collectionsMap: { [key: string]: any[] } = {
    users: backupData.users || [],
    clients: backupData.clients || [],
    companies: backupData.companies || [],
    cases: backupData.cases || [],
    sessions: backupData.sessions || [],
    auditLogs: backupData.auditLogs || [],
    tasks: backupData.tasks || [],
    opponents: backupData.opponents || [],
    notifications: backupData.notifications || []
  };

  if (backupData.office_settings) {
    const settingsDoc = {
      ...backupData.office_settings,
      id: backupData.office_settings.id || 'office_settings'
    };
    collectionsMap.settings = [settingsDoc];
    collectionsMap.office_settings = [settingsDoc];
  }

  const collectionNames = Object.keys(collectionsMap);
  const BATCH_SIZE = 450;

  // 1. Clear existing collections in Firestore
  const deleteOps: Array<{ colName: string; id: string }> = [];
  for (const colName of collectionNames) {
    const existing = await getFirestoreDocs<{ id: string }>(colName).catch(() => []);
    for (const docItem of existing) {
      if (docItem.id) {
        deleteOps.push({ colName, id: docItem.id });
      }
    }
  }

  for (let i = 0; i < deleteOps.length; i += BATCH_SIZE) {
    const chunk = deleteOps.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      batch.delete(doc(db, op.colName, op.id));
    }
    await batch.commit();
  }

  // 2. Set restored data in Firestore
  const setOps: Array<{ colName: string; id: string; data: any }> = [];
  for (const colName of collectionNames) {
    const items = collectionsMap[colName] || [];
    for (const item of items) {
      if (item && item.id) {
        setOps.push({ colName, id: item.id, data: item });
      }
    }
  }

  for (let i = 0; i < setOps.length; i += BATCH_SIZE) {
    const chunk = setOps.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      batch.set(doc(db, op.colName, op.id), op.data);
    }
    await batch.commit();
  }

  // 3. If real estate dataset is included in this backup, restore it as well
  if (backupData.realEstate) {
    await restoreRealEstateBackupBatch(backupData.realEstate);
  }

  // 4. Restore localStorage settings & templates
  if (backupData.settings) {
    Object.entries(backupData.settings).forEach(([k, v]) => {
      if (typeof v === 'string') {
        localStorage.setItem(k, v);
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
    });
  }
}

