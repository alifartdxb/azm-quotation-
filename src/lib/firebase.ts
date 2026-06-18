import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, query, orderBy, where, serverTimestamp, runTransaction } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Customer, Product, Quotation, AuditLog, AppSettings } from '../types';

const firebaseConfig = {
  projectId: "gen-lang-client-0576582933",
  appId: "1:122595688318:web:1afeebee0c48e68e31bd2f",
  apiKey: "AIzaSyAlZ8ABshX1qELu8X82ls6UDNhLdMx4qLc",
  authDomain: "gen-lang-client-0576582933.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-53a2eae1-8e85-4d88-a14c-0998c0938810");
export const auth = getAuth(app);

// Logic Helpers
export const logActivity = async (action: string, entityType: AuditLog['entityType'], entityId: string | undefined, details: string) => {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    await addDoc(collection(db, 'audit_logs'), {
      userId: user.uid,
      userEmail: user.email || 'unknown',
      action,
      entityType,
      entityId: entityId || null,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
};

export const getAppSettings = async (): Promise<AppSettings> => {
  const docRef = doc(db, 'settings', 'global');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as AppSettings;
  }
  // Defaults
  const defaults: AppSettings = {
    companyNameEn: "AZM Group",
    companyNameAr: "مجموعة العزائم",
    trn: "100000000000000",
    phone: "+971 50 000 0000",
    address: "Dubai, UAE",
    bankName: "Dubai Islamic Bank",
    accountName: "AZM Group LLC",
    accountNumber: "0000000000000000",
    iban: "AE000000000000000000000",
    defaultTerms: "1. Validity: 10 days\n2. Payment: Advance",
    whatsappTemplate: "Hello, please review quotation {quoteNo}.",
    quotationPrefix: "QTN-2026-",
    quotationNextNumber: 1
  };
  await setDoc(docRef, defaults);
  return defaults;
};

export const generateNextQuotationNumber = async (): Promise<string> => {
  const docRef = doc(db, 'settings', 'global');
  let newQuoteNo = '';
  
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) {
      throw new Error("Settings document does not exist!");
    }
    
    const data = snap.data() as AppSettings;
    const nextNum = data.quotationNextNumber || 1;
    const prefix = data.quotationPrefix || "QTN-";
    
    newQuoteNo = `${prefix}${String(nextNum).padStart(5, '0')}`;
    
    transaction.update(docRef, {
      quotationNextNumber: nextNum + 1
    });
  });
  
  return newQuoteNo;
};

// Data fetching helpers
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
  const products = await getProducts();
  const quotations = await getQuotations();

  return {
    totalQuotes: quotations.length,
    pendingQuotes: quotations.filter(q => q.status === 'Draft' || q.status === 'Pending Approval').length,
    approvedQuotes: quotations.filter(q => q.status === 'Approved' || q.status === 'Converted to Order').length,
    totalProducts: products.length,
    recentQuotes: quotations.slice(0, 5),
  };
};
