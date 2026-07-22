import { db } from "./firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  setDoc,
  getDocFromServer
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
    if (error instanceof Error && error.message.includes("the client is offline")) {
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
      if (snapshot.empty && seedData && seedData.length > 0) {
        console.log(`Seeding collection ${collectionName} with initial data...`);
        try {
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
      await setDoc(docRef, dataToSave);
      return { id: customId, ...dataToSave };
    } else {
      const colRef = collection(db, collectionName);
      const docRef = await addDoc(colRef, data);
      await updateDoc(docRef, { id: docRef.id });
      return { id: docRef.id, ...data };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// 2. Update document
export async function updateFirestoreDoc(collectionName: string, docId: string, data: any) {
  const path = `${collectionName}/${docId}`;
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, data);
  } catch (error) {
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
