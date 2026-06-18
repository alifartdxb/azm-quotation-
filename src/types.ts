export interface Customer {
  id: string;
  name?: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  address: string;
  trn: string;
  createdAt?: string;
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
  productId: string;
  product: Product;
  qty: number;
  unitPrice: number;
  discountAmt: number;
  total: number;
}

export interface Quotation {
  id: string;
  quoteNo: string;
  createdAt: string;
  customerId?: string;
  customer: Customer | null;
  validityDays: number;
  reference?: string;
  subject?: string;
  items: QuoteItem[];
  subTotal: number;
  discountTotal: number;
  vatAmount: number;
  grandTotal: number;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Sent' | 'Expired' | 'Converted to Order' | string;
  salesperson: string;
}

export interface DashboardStats {
  totalQuotes: number;
  pendingQuotes: number;
  totalCustomers: number;
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
}
