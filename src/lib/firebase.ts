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
  const docs = ['company', 'bank', 'templates', 'whatsapp', 'quotation'];
  const results = await Promise.allSettled(
    docs.map(name => getDoc(doc(db, 'settings', name)))
  );
  
  const merged: Partial<AppSettings> = {};
  
  const companyDefaults = {
    companyNameEn: "Al Zahra Al Malakia Building Materials Trading L.L.C",
    companyNameAr: "الزهــرة المـلـكـيـة لتـــجــارة مــواد الـبــنــاء ذ.م.م",
    trn: "1002 5994 2900 003",
    phone: "+971 4 28 444 52",
    address: "Shop No. 12, Building Materials Mall, Dubai, U.A.E"
  };
  
  const bankDefaults = {
    bankName: "National Bank Of Ras Al Khaimah",
    accountName: "Al Zahra Al Malakia Building Materials Trading L.L.C.",
    accountNumber: "83621 5391 5902",
    iban: "AE39 0400 0083 6215 3915 902"
  };
  
  const templateDefaults = {
    defaultTerms: "The above prices are in Dirhams (AED) quoted based on the quantities requested.\nPayment Terms 100% advance against order confirmation.\nDelivery time to be confirmed upon order confirmation.\nLocal delivery charges are not included within this quotation.\nCustomized items eg. counter tops/vanity cannot be cancelled or exchange after order confirmation."
  };
  
  const whatsappDefaults = {
    whatsappTemplate: "Dear {{customer_name}},\n\nPlease find attached our quotation {{quotation_no}}.\n\nThank you.\nBest Regards,\nAZM Group"
  };
  
  const quotationDefaults = {
    quotationPrefix: "QTN",
    quotationNextNumber: 735
  };
  
  results.forEach((res, idx) => {
    const name = docs[idx];
    if (res.status === 'fulfilled' && res.value.exists()) {
      Object.assign(merged, res.value.data());
    } else {
      if (name === 'company') Object.assign(merged, companyDefaults);
      if (name === 'bank') Object.assign(merged, bankDefaults);
      if (name === 'templates') Object.assign(merged, templateDefaults);
      if (name === 'whatsapp') Object.assign(merged, whatsappDefaults);
      if (name === 'quotation') Object.assign(merged, quotationDefaults);
    }
  });
  
  return merged as AppSettings;
};

export const saveAppSettingsDoc = async (name: string, data: any): Promise<void> => {
  const docRef = doc(db, 'settings', name);
  await setDoc(docRef, data, { merge: true });
};

export const generateNextQuotationNumber = async (): Promise<string> => {
  const counterRef = doc(db, 'counters', 'quotationCounter');
  let newQuoteNo = '';
  const user = auth.currentUser;
  
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    let currentNumber = 1;
    let prefix = 'QTN';
    let year = 2026;
    
    if (!snap.exists()) {
      const initialData = {
        currentNumber: 1,
        prefix: 'QTN',
        year: 2026
      };
      transaction.set(counterRef, initialData);
      currentNumber = 1;
      prefix = 'QTN';
      year = 2026;
    } else {
      const data = snap.data();
      currentNumber = (data.currentNumber || 0) + 1;
      prefix = data.prefix || 'QTN';
      year = data.year || 2026;
      transaction.update(counterRef, {
        currentNumber: currentNumber
      });
    }
    
    newQuoteNo = `${prefix}-${year}-${String(currentNumber).padStart(6, '0')}`;
  });
  
  if (user && newQuoteNo) {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        userId: user.uid,
        userEmail: user.email || 'unknown',
        timestamp: new Date().toISOString(),
        quotationNumber: newQuoteNo,
        action: 'Quotation Number Generated',
        entityType: 'System',
        details: `Generated quotation sequence: ${newQuoteNo}`
      });
    } catch (auditErr) {
      console.error("Failed to write generator audit log:", auditErr);
    }
  }
  
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
