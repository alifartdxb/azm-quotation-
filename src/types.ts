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
  customer: Customer;
  validityDays: number;
  subject?: string;
  items: QuoteItem[];
  subtotal: number;
  discountPercentage?: number;
  discountAmount?: number;
  netTotal?: number;
  vatAmount: number;
  grandTotal: number;
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
  headerImage?: string;
  footerImage?: string;
  companyStamp?: string;
  showStampInPdf?: boolean;
  showStampInPreview?: boolean;
  showStampOnLastPageOnly?: boolean;
}
