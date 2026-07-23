export interface Customer {
  customerName: string;
  companyName: string;
  contactPerson?: string;
  mobile: string;
  email: string;
  trn: string;
  projectName?: string;
  siteLocation?: string;
  address: string;
  reference: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  unit: string;
  category: string;
  image?: string;
}

export interface QuoteItem {
  id: string;
  productId?: string;
  product: Product;
  qty: number;
  unitPrice: number;
  discountAmt?: number;
  total: number;
}

export interface Quotation {
  id: string;
  quoteNo: string;
  createdAt: string;
  customerId?: string;
  customer: Customer;
  validityDays: number;
  subject?: string;
  items: QuoteItem[];
  subtotal: number;
  discountPercentage?: number;
  discountAmount?: number;
  netTotal?: number;
  deliveryCharges?: number;
  vatAmount: number;
  grandTotal: number;
  termsAndConditions?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Sent' | 'Expired' | 'Converted to Order' | string;
  salesperson: string;
  preparedBy?: string;
}

export interface DashboardStats {
  totalQuotes: number;
  pendingQuotes: number;
  approvedQuotes: number;
  totalProducts: number;
  recentQuotes: Quotation[];
  totalCustomers?: number;
  activeCustomers?: number;
  hotLeads?: number;
  followUpRequired?: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: 'Product' | 'Customer' | 'Quotation' | 'Settings' | 'System';
  entityId?: string;
  details: string;
  timestamp: string;
}

export interface AppSettings {
  id?: string;
  companyNameEn: string;
  companyNameAr: string;
  trn: string;
  phone: string;
  address: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  defaultTerms: string;
  whatsappTemplate: string;
  quotationPrefix: string;
  quotationNextNumber: number;
  invoicePrefix?: string;
  vatPercentage?: number;
  defaultValidity?: number;
  headerImage?: string;
  footerImage?: string;
  companyStamp?: string;
  showStampInPdf?: boolean;
  showStampInPreview?: boolean;
  showStampOnLastPageOnly?: boolean;
}

export interface CrmCustomer {
  id?: string;
  createdBy?: string;
  customerName: string;
  companyName: string;
  contactPerson?: string;
  mobile: string;
  whatsapp?: string;
  email: string;
  trn: string;
  address: string;
  city?: string;
  projectName?: string;
  customerType: 'Retail' | 'Contractor' | 'Builder' | 'Interior Designer' | 'Architect' | 'Project Customer' | 'Dealer' | 'VIP' | string;
  tag: 'Hot Lead' | 'Active Customer' | 'Inactive Customer' | 'Follow Up Required' | string;
  notes?: string;
  createdAt: string;
  lastQuotationDate?: string;
  lastQuotationNo?: string;
  followUpDate?: string;
  followUpNotes?: string;
  followUpType?: 'Call' | 'WhatsApp' | 'None' | string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  type: 'New Product Launch' | 'Promotional Offer' | 'Follow-up Reminder' | 'Holiday Greetings' | 'Payment Reminder' | 'Quotation Follow-up' | string;
  body: string;
  createdAt: string;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  senderId?: string;
  sentCount: number;
  failedCount: number;
  recipients: {
    customerId: string;
    customerName: string;
    mobile: string;
    status: 'Sent' | 'Failed' | string;
    sentAt: string;
    error?: string;
  }[];
  createdAt: string;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  quotationNo?: string;
  quotationId?: string;
  createdAt: string;
  customer: Customer;
  subject?: string;
  items: QuoteItem[];
  subtotal: number;
  discountPercentage?: number;
  discountAmount?: number;
  netTotal?: number;
  deliveryCharges?: number;
  vatAmount: number;
  grandTotal: number;
  termsAndConditions?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Converted to Invoice' | 'Invoice Sent' | 'Partially Paid' | 'Paid' | 'Cancelled' | string;
  salesperson: string;
  preparedBy?: string;
  
  // Payment Tracking fields
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid';
  paymentDate?: string;
  paymentMethod?: string;
  chequeNo?: string;
  referenceNo?: string;
  outstandingBalance: number;
  paidAmount: number;
  remarks?: string;
  convertedFromQuotation?: boolean;
}

export interface InvoiceDashboardStats {
  totalInvoicesCount: number;
  pendingPaymentCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  outstandingAmount: number;
  monthlyRevenue: Record<string, number>;
}


