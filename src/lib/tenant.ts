import { collection, doc, DocumentData, CollectionReference, DocumentReference, Firestore } from 'firebase/firestore';
import { db } from './firebase';

let currentCompanyId: string | null = null;

export const setTenantCompanyId = (companyId: string | null | undefined) => {
  currentCompanyId = companyId || null;
};

export const getTenantCompanyId = () => {
  return currentCompanyId;
};

export const getTenantCollection = (collectionName: string): CollectionReference<DocumentData> => {
  if (!currentCompanyId || currentCompanyId === 'default' || currentCompanyId === 'company_001') {
    return collection(db, collectionName);
  }
  return collection(db, 'companies', currentCompanyId, collectionName);
};

export const getTenantDoc = (collectionName: string, docId: string): DocumentReference<DocumentData> => {
  if (!currentCompanyId || currentCompanyId === 'default' || currentCompanyId === 'company_001') {
    return doc(db, collectionName, docId);
  }
  return doc(db, 'companies', currentCompanyId, collectionName, docId);
};
