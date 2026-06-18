import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Customer, Product, Quotation } from '../types';

const firebaseConfig = {
  projectId: "gen-lang-client-0576582933",
  appId: "1:122595688318:web:1afeebee0c48e68e31bd2f",
  apiKey: "AIzaSyAlZ8ABshX1qELu8X82ls6UDNhLdMx4qLc",
  authDomain: "gen-lang-client-0576582933.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-53a2eae1-8e85-4d88-a14c-0998c0938810");
export const auth = getAuth(app);

// Data fetching helpers
export const getCustomers = async (): Promise<Customer[]> => {
  const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
};

export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(collection(db, 'products'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const getQuotations = async (): Promise<Quotation[]> => {
  const q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
};

export const getQuotation = async (id: string): Promise<Quotation | null> => {
  const docRef = doc(db, 'quotations', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Quotation;
  }
  return null;
};

export const getDashboardStats = async () => {
  const customers = await getCustomers();
  const products = await getProducts();
  const quotations = await getQuotations();

  return {
    totalQuotes: quotations.length,
    pendingQuotes: quotations.filter(q => q.status === 'Pending').length,
    totalCustomers: customers.length,
    totalProducts: products.length,
    recentQuotes: quotations.slice(0, 5),
  };
};
