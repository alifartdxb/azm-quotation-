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
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  salesperson: string;
}

export interface DashboardStats {
  totalQuotes: number;
  pendingQuotes: number;
  totalCustomers: number;
  totalProducts: number;
  recentQuotes: Quotation[];
}
