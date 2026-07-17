import { initializeApp } from 'firebase/app';
import { getTenantCollection, getTenantDoc } from "./tenant";
import { initializeFirestore, collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, query, orderBy, where, serverTimestamp, runTransaction } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { Customer, Product, Quotation, AuditLog, AppSettings, CrmCustomer, WhatsAppTemplate, WhatsAppCampaign, SalesInvoice } from '../types';
import { cleanFirestoreData } from './utils';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Logic Helpers
export const logActivity = async (action: string, entityType: AuditLog['entityType'], entityId: string | undefined, details: string) => {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    await addDoc(getTenantCollection('audit_logs'), {
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
  const docs = ['company', 'bank', 'templates', 'whatsapp', 'quotation', 'branding', 'invoice'];
  const results = await Promise.allSettled(
    docs.map(name => getDoc(getTenantDoc('settings', name)))
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
  
  const brandingDefaults = {
    showStampInPdf: true,
    showStampInPreview: true,
    showStampOnLastPageOnly: true
  };

  const invoiceDefaults = {
    invoicePrefix: "INV",
    vatPercentage: 5,
    defaultValidity: 30
  };
  
  results.forEach((res, idx) => {
    const name = docs[idx];
    if (res.status === 'fulfilled' && res.value.exists()) {
      const data = res.value.data();
      // Apply defaults if fields are missing
      if (name === 'branding') {
        if (data.showStampInPdf === undefined) data.showStampInPdf = true;
        if (data.showStampInPreview === undefined) data.showStampInPreview = true;
        if (data.showStampOnLastPageOnly === undefined) data.showStampOnLastPageOnly = true;
      }
      Object.assign(merged, data);
    } else {
      if (name === 'company') Object.assign(merged, companyDefaults);
      if (name === 'bank') Object.assign(merged, bankDefaults);
      if (name === 'templates') Object.assign(merged, templateDefaults);
      if (name === 'whatsapp') Object.assign(merged, whatsappDefaults);
      if (name === 'quotation') Object.assign(merged, quotationDefaults);
      if (name === 'branding') Object.assign(merged, brandingDefaults);
      if (name === 'invoice') Object.assign(merged, invoiceDefaults);
    }
  });
  
  return merged as AppSettings;
};

export const saveAppSettingsDoc = async (name: string, data: any): Promise<void> => {
  const docRef = getTenantDoc('settings', name);
  await setDoc(docRef, data, { merge: true });
};

export const generateNextQuotationNumber = async (): Promise<string> => {
  const counterRef = getTenantDoc('counters', 'quotationCounter');
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
      await addDoc(getTenantCollection('audit_logs'), {
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
  const snapshot = await getDocs(getTenantCollection('products'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const getQuotations = async (): Promise<Quotation[]> => {
  const q = query(getTenantCollection('quotations'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
};

export const deleteQuotation = async (id: string): Promise<void> => {
  await deleteDoc(getTenantDoc('quotations', id));
};

export const updateQuotationStatus = async (id: string, status: string): Promise<void> => {
  await updateDoc(getTenantDoc('quotations', id), { status });
};

export const getQuotation = async (id: string): Promise<Quotation | null> => {
  const docRef = getTenantDoc('quotations', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Quotation;
  }
  return null;
};

export const getDashboardStats = async () => {
  const products = await getProducts();
  const quotations = await getQuotations();
  const customers = await getCrmCustomers();

  // Find customers with upcoming follow ups
  const today = new Date().toISOString().split('T')[0];
  const followUpCount = customers.filter(c => c.followUpDate && c.followUpDate >= today).length;

  return {
    totalQuotes: quotations.length,
    pendingQuotes: quotations.filter(q => q.status === 'Draft' || q.status === 'Pending Approval').length,
    approvedQuotes: quotations.filter(q => q.status === 'Approved' || q.status === 'Converted to Order').length,
    totalProducts: products.length,
    recentQuotes: quotations.slice(0, 5),
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.tag === 'Active Customer').length,
    hotLeads: customers.filter(c => c.tag === 'Hot Lead').length,
    followUpRequired: followUpCount,
  };
};

// ==========================================
// CRM CUSTOMER HELPERS
// ==========================================

export const getCrmCustomers = async (): Promise<CrmCustomer[]> => {
  const q = query(getTenantCollection('crm_customers'), orderBy('customerName'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrmCustomer));
};

export const getCrmCustomerQuotationHistory = async (mobile: string): Promise<Quotation[]> => {
  if (!mobile) return [];
  const q = query(getTenantCollection('quotations'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const quotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
  // Filter client-side to handle variations in formatting or just straight matches
  const cleanMobile = mobile.replace(/[^0-9]/g, '');
  return quotes.filter(quote => {
    if (!quote.customer?.mobile) return false;
    const qMobile = quote.customer.mobile.replace(/[^0-9]/g, '');
    return qMobile === cleanMobile || quote.customer.mobile === mobile;
  });
};

export const deleteCrmCustomer = async (id: string): Promise<void> => {
  await deleteDoc(getTenantDoc('crm_customers', id));
};

export const saveCrmCustomer = async (customer: Partial<CrmCustomer>): Promise<string> => {
  const id = customer.id;
  const mobile = customer.mobile ? customer.mobile.trim() : '';
  const email = customer.email ? customer.email.trim().toLowerCase() : '';

  if (!mobile) {
    throw new Error('Mobile number is required for customer record.');
  }

  // Cross-reference for duplicates
  const customersRef = getTenantCollection('crm_customers');
  const snapshot = await getDocs(customersRef);
  const allCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrmCustomer));

  const duplicate = allCustomers.find(c => {
    // skip self
    if (id && c.id === id) return false;
    const cMobileClean = c.mobile.replace(/[^0-9]/g, '');
    const inputMobileClean = mobile.replace(/[^0-9]/g, '');
    const isMobileMatch = cMobileClean === inputMobileClean && cMobileClean.length >= 7;
    const isEmailMatch = email && c.email && c.email.trim().toLowerCase() === email;
    return isMobileMatch || isEmailMatch;
  });

  if (duplicate) {
    throw new Error(`A customer with the same Mobile (${duplicate.mobile}) or Email (${duplicate.email}) already exists: ${duplicate.customerName} of ${duplicate.companyName || 'No Company'}`);
  }

  const cleanData = {
    customerName: customer.customerName || '',
    companyName: customer.companyName || '',
    contactPerson: customer.contactPerson || '',
    mobile: mobile,
    whatsapp: customer.whatsapp || mobile,
    email: email,
    trn: customer.trn || '',
    address: customer.address || '',
    city: customer.city || 'Dubai',
    projectName: customer.projectName || '',
    customerType: customer.customerType || 'Retail',
    tag: customer.tag || 'Hot Lead',
    notes: customer.notes || '',
    createdAt: customer.createdAt || new Date().toISOString(),
    lastQuotationDate: customer.lastQuotationDate || '',
    lastQuotationNo: customer.lastQuotationNo || '',
    followUpDate: customer.followUpDate || '',
    followUpNotes: customer.followUpNotes || '',
    followUpType: customer.followUpType || 'None'
  };

  if (id) {
    await setDoc(getTenantDoc('crm_customers', id), cleanData);
    return id;
  } else {
    const docRef = await addDoc(getTenantCollection('crm_customers'), cleanData);
    return docRef.id;
  }
};

export const syncQuotationCustomerToCrm = async (quotation: Quotation, createdBy?: string): Promise<string | null> => {
  const cust = quotation.customer;
  if (!cust || (!cust.customerName && !cust.companyName)) return null;

  const mobile = cust.mobile ? cust.mobile.trim() : '';
  const email = cust.email ? cust.email.trim().toLowerCase() : '';
  const name = cust.customerName || cust.companyName || '';

  const customersRef = getTenantCollection('crm_customers');
  const snapshot = await getDocs(customersRef);
  const allCustomers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrmCustomer));

  const existing = allCustomers.find(c => {
    const cMobileClean = (c.mobile || '').replace(/[^0-9]/g, '');
    const inputMobileClean = mobile.replace(/[^0-9]/g, '');
    const isMobileMatch = inputMobileClean.length >= 7 && cMobileClean === inputMobileClean;
    const isEmailMatch = email && c.email && c.email.trim().toLowerCase() === email;
    const isNameMatch = name.length > 2 && c.customerName && c.customerName.trim().toLowerCase() === name.trim().toLowerCase();
    
    return isMobileMatch || isEmailMatch || isNameMatch;
  });

  const updatedData: Partial<CrmCustomer> = {
    customerName: name,
    companyName: cust.companyName || name,
    contactPerson: cust.contactPerson || '',
    mobile: mobile,
    email: email,
    trn: cust.trn || '',
    address: cust.address || '',
    projectName: cust.projectName || '',
    lastQuotationDate: quotation.createdAt || new Date().toISOString(),
    lastQuotationNo: quotation.quoteNo || ''
  };

  if (existing) {
    // Merge existing non-empty values
    const merged = {
      ...existing,
      ...updatedData,
      whatsapp: existing.whatsapp || mobile,
      customerType: existing.customerType || 'Retail',
      tag: existing.tag === 'Hot Lead' ? 'Active Customer' : (existing.tag || 'Active Customer')
    };
    await setDoc(getTenantDoc('crm_customers', existing.id as string), merged);
    return existing.id as string;
  } else {
    // Create new
    const newCustomer: CrmCustomer = {
      customerName: name,
      companyName: cust.companyName || name,
      contactPerson: cust.contactPerson || '',
      mobile: mobile,
      whatsapp: mobile,
      email: email,
      trn: cust.trn || '',
      address: cust.address || '',
      city: 'Dubai',
      projectName: cust.projectName || '',
      customerType: 'Retail',
      tag: 'Hot Lead',
      notes: 'Automatically added from Quotation ' + (quotation.quoteNo || ''),
      createdAt: quotation.createdAt || new Date().toISOString(),
      createdBy: createdBy || 'System',
      lastQuotationDate: quotation.createdAt || new Date().toISOString(),
      lastQuotationNo: quotation.quoteNo || ''
    };
    const docRef = await addDoc(getTenantCollection('crm_customers'), newCustomer);
    return docRef.id;
  }
};

// ==========================================
// WHATSAPP TEMPLATE HELPERS
// ==========================================

export const getWhatsAppTemplates = async (): Promise<WhatsAppTemplate[]> => {
  const snapshot = await getDocs(getTenantCollection('whatsapp_templates'));
  let templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhatsAppTemplate));

  // Seed default templates if database is empty
  if (templates.length === 0) {
    const defaultTemplates: WhatsAppTemplate[] = [
      {
        id: 'new-product-launch',
        name: 'New Product Launch',
        type: 'New Product Launch',
        body: 'Dear {{CustomerName}},\n\nGreetings from Al Zahra Al Malakia Building Materials (AZM Group).\n\nWe are excited to announce our new premium collection of luxury Italian sanitaryware and large-format porcelain slabs. Perfect for modern residential projects!\n\nContact us on +971 4 28 444 52 or visit our Warsan-3 showroom to view the full range.\n\nBest Regards,\n{{PreparedBy}}',
        createdAt: new Date().toISOString()
      },
      {
        id: 'promotional-offer',
        name: 'Promotional Offer',
        type: 'Promotional Offer',
        body: 'Dear {{CustomerName}},\n\nExclusive Offer from AZM Group (Al Zahra Al Malakia) for our premium builder/contractor network!\n\nThis month, enjoy special pricing on select porcelain tiles and bathroom fittings from top brands like Grohe, Jaquar, and VitrA.\n\nReply to this message for a personalized quote list.\n\nBest Regards,\n{{PreparedBy}}',
        createdAt: new Date().toISOString()
      },
      {
        id: 'follow-up-reminder',
        name: 'Follow-up Reminder',
        type: 'Follow-up Reminder',
        body: 'Dear {{CustomerName}},\n\nWe trust you are doing well.\n\nThis is Ali from Al Zahra Al Malakia Bldg Mat. Just wanted to follow up on your luxury villa renovation and see if you need further help with materials list or tiles layout planning. Let us know!\n\nBest Regards,\n{{PreparedBy}}',
        createdAt: new Date().toISOString()
      },
      {
        id: 'holiday-greetings',
        name: 'Holiday Greetings',
        type: 'Holiday Greetings',
        body: 'Dear {{CustomerName}},\n\nAl Zahra Al Malakia Building Materials LLC wishes you and your family a blessed, joyful, and peaceful holiday season.\n\nThank you for choosing AZM Group as your trusted partner for premium building materials. We look forward to shaping beautiful spaces together in the coming year!\n\nBest Regards,\n{{PreparedBy}}',
        createdAt: new Date().toISOString()
      },
      {
        id: 'payment-reminder',
        name: 'Payment Reminder',
        type: 'Payment Reminder',
        body: 'Dear {{CustomerName}},\n\nHope this message finds you well.\n\nThis is a friendly reminder regarding the pending balance for your recent order against Quotation #{{LastQuotationNo}}.\n\nKindly proceed with the bank transfer to our Dubai Islamic Bank account at your earliest convenience to facilitate on-time delivery.\n\nBest Regards,\n{{PreparedBy}}',
        createdAt: new Date().toISOString()
      },
      {
        id: 'quotation-follow-up',
        name: 'Quotation Follow-up',
        type: 'Quotation Follow-up',
        body: 'Dear {{CustomerName}},\n\nGreetings from Al Zahra Al Malakia Building Materials Trading LLC (AZM Group).\n\nThank you for your interest in our premium building materials. We are pleased to assist you with quotation #{{LastQuotationNo}}.\n\nIs there anything we can modify or add to the bathroom mixers / tiles specifications for your project? Feel free to contact us.\n\nBest Regards,\n{{PreparedBy}}',
        createdAt: new Date().toISOString()
      }
    ];

    for (const temp of defaultTemplates) {
      await setDoc(getTenantDoc('whatsapp_templates', temp.id), temp);
    }
    templates = defaultTemplates;
  }

  return templates;
};

export const saveWhatsAppTemplate = async (template: WhatsAppTemplate): Promise<void> => {
  await setDoc(getTenantDoc('whatsapp_templates', template.id), template);
};

export const deleteWhatsAppTemplate = async (id: string): Promise<void> => {
  await deleteDoc(getTenantDoc('whatsapp_templates', id));
};

// ==========================================
// WHATSAPP CAMPAIGN HISTORIES
// ==========================================

export const getWhatsAppCampaigns = async (): Promise<WhatsAppCampaign[]> => {
  const q = query(getTenantCollection('whatsapp_campaigns'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhatsAppCampaign));
};

export const saveWhatsAppCampaign = async (campaign: WhatsAppCampaign): Promise<void> => {
  await setDoc(getTenantDoc('whatsapp_campaigns', campaign.id), campaign);
};

// ==========================================
// SALES INVOICE HELPERS
// ==========================================

export const getSalesInvoices = async (): Promise<SalesInvoice[]> => {
  const q = query(getTenantCollection('sales_invoices'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesInvoice));
};

export const getSalesInvoice = async (id: string): Promise<SalesInvoice | null> => {
  const docRef = getTenantDoc('sales_invoices', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as SalesInvoice;
  }
  return null;
};

export const deleteSalesInvoice = async (id: string): Promise<void> => {
  await deleteDoc(getTenantDoc('sales_invoices', id));
};

export const updateSalesInvoiceStatus = async (id: string, status: string): Promise<void> => {
  await updateDoc(getTenantDoc('sales_invoices', id), { status });
};

export const generateNextInvoiceNumber = async (): Promise<string> => {
  const counterRef = getTenantDoc('counters', 'invoiceCounter');
  let newInvoiceNo = '';
  const user = auth.currentUser;
  
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    let currentNumber = 1;
    let prefix = 'INV';
    let year = 2026;
    
    if (!snap.exists()) {
      const initialData = {
        currentNumber: 1,
        prefix: 'INV',
        year: 2026
      };
      transaction.set(counterRef, initialData);
      currentNumber = 1;
      prefix = 'INV';
      year = 2026;
    } else {
      const data = snap.data();
      currentNumber = (data.currentNumber || 0) + 1;
      prefix = data.prefix || 'INV';
      year = data.year || 2026;
      transaction.update(counterRef, {
        currentNumber: currentNumber
      });
    }
    
    newInvoiceNo = `${prefix}-${year}-${String(currentNumber).padStart(6, '0')}`;
  });
  
  if (user && newInvoiceNo) {
    try {
      await addDoc(getTenantCollection('audit_logs'), {
        userId: user.uid,
        userEmail: user.email || 'unknown',
        timestamp: new Date().toISOString(),
        invoiceNumber: newInvoiceNo,
        action: 'Invoice Number Generated',
        entityType: 'System',
        details: `Generated invoice sequence: ${newInvoiceNo}`
      });
    } catch (auditErr) {
      console.error("Failed to write invoice generator audit log:", auditErr);
    }
  }
  
  return newInvoiceNo;
};

export const saveSalesInvoice = async (invoice: Partial<SalesInvoice>): Promise<string> => {
  const id = invoice.id;
  const cleanData = cleanFirestoreData({
    invoiceNo: invoice.invoiceNo,
    quotationNo: invoice.quotationNo || null,
    quotationId: invoice.quotationId || null,
    createdAt: invoice.createdAt || new Date().toISOString(),
    customer: invoice.customer,
    subject: invoice.subject || null,
    items: invoice.items || [],
    subtotal: invoice.subtotal || 0,
    discountPercentage: invoice.discountPercentage || 0,
    discountAmount: invoice.discountAmount || 0,
    netTotal: invoice.netTotal || invoice.subtotal || 0,
    vatAmount: invoice.vatAmount || 0,
    grandTotal: invoice.grandTotal || 0,
    status: invoice.status || 'Draft',
    salesperson: invoice.salesperson || '',
    preparedBy: invoice.preparedBy || '',
    paymentStatus: invoice.paymentStatus || 'Unpaid',
    paymentDate: invoice.paymentDate || null,
    paymentMethod: invoice.paymentMethod || null,
    chequeNo: invoice.chequeNo || null,
    referenceNo: invoice.referenceNo || null,
    outstandingBalance: invoice.outstandingBalance !== undefined ? invoice.outstandingBalance : (invoice.grandTotal || 0),
    paidAmount: invoice.paidAmount || 0,
    remarks: invoice.remarks || null
  });

  if (id) {
    await setDoc(getTenantDoc('sales_invoices', id), cleanData);
    await logActivity('Updated Sales Invoice', 'System', id, `Updated sales invoice ${invoice.invoiceNo}`);
    return id;
  } else {
    const docRef = await addDoc(getTenantCollection('sales_invoices'), cleanData);
    await logActivity('Created Sales Invoice', 'System', docRef.id, `Created sales invoice ${invoice.invoiceNo}`);
    return docRef.id;
  }
};

export const convertQuotationToSalesInvoice = async (quotation: Quotation): Promise<{id: string, existed: boolean}> => {
  // Prevent duplicate conversions if already converted
  const invoices = await getSalesInvoices();
  const alreadyConverted = invoices.find(inv => inv.quotationId === quotation.id);
  if (alreadyConverted) {
    return { id: alreadyConverted.id, existed: true };
  }

  // Generate new invoice number
  const nextInvoiceNo = await generateNextInvoiceNumber();

  const invoiceData: Partial<SalesInvoice> & { convertedFromQuotation?: boolean } = {
    invoiceNo: nextInvoiceNo,
    quotationNo: quotation.quoteNo,
    quotationId: quotation.id,
    createdAt: new Date().toISOString(),
    customer: quotation.customer,
    subject: quotation.subject,
    items: quotation.items,
    subtotal: quotation.subtotal,
    discountPercentage: quotation.discountPercentage,
    discountAmount: quotation.discountAmount,
    netTotal: quotation.netTotal,
    deliveryCharges: quotation.deliveryCharges || 0,
    vatAmount: quotation.vatAmount,
    grandTotal: quotation.grandTotal,
    status: 'Unpaid',
    salesperson: quotation.salesperson,
    preparedBy: quotation.preparedBy,
    paymentStatus: 'Unpaid',
    paidAmount: 0,
    outstandingBalance: quotation.grandTotal,
    convertedFromQuotation: true
  };

  const invoiceId = await saveSalesInvoice(invoiceData);

  // Update Quotation Status to 'Converted to Invoice'
  await updateDoc(getTenantDoc('quotations', quotation.id), {
    status: 'Converted to Invoice',
    invoiceNo: nextInvoiceNo,
    invoiceId: invoiceId
  });

  await logActivity('Converted Quotation to Invoice', 'Quotation', quotation.id, `Converted quotation ${quotation.quoteNo} to invoice ${nextInvoiceNo}`);

  return { id: invoiceId, existed: false };
};


