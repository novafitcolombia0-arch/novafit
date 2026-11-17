export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  isActive: boolean;
}

export interface ProductImage {
  id?: number;
  imageData: string;
  mimeType: string;
  isMain: boolean;
}

export interface ProductSize {
  id?: number;
  size: string;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  cost?: number | null;
  isActive: boolean;
  category: Category;
  categoryId: number;
  images: ProductImage[];
  sizes: ProductSize[];
}

export interface User {
  id: number;
  email: string;
  role: string;
}

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  size: string;
  quantity: number;
  maxQuantity: number;
}

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'EXPIRED';
export type FulfillmentStatus = 'POR_DESPACHAR' | 'DESPACHADO' | 'ENTREGADO' | 'CANCELADO';

export interface OrderItem {
  id?: number;
  productId?: number;
  productName: string;
  size: string;
  unitPrice: number;
  quantity: number;
}

/** Vista pública del pedido (página de resultado del pago) */
export interface OrderSummary {
  reference: string;
  status: PaymentStatus;
  customerName: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod?: string;
  createdAt: string;
  items: OrderItem[];
}

/** Pedido completo (panel de administración) */
export interface Order extends OrderSummary {
  id: number;
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber?: string;
  email: string;
  phone: string;
  documentId?: string;
  department: string;
  city: string;
  address: string;
  notes?: string;
  wompiTransactionId?: string;
  paidAt?: string;
}

export interface CheckoutRequest {
  items: { productId: number; size: string; quantity: number }[];
  customer: {
    name: string;
    email: string;
    phone: string;
    documentId: string;
    department: string;
    city: string;
    address: string;
    notes: string;
  };
}

export interface InventorySize {
  size: string;
  stock: number;
  reserved: number;
  sold30d: number;
}

export interface InventoryProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  isActive: boolean;
  category: string;
  image: string | null;
  sizes: InventorySize[];
}

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'VENTA_WEB' | 'LIBERACION' | 'CREACION' | 'ELIMINACION' | 'VENTA_MANUAL' | 'ANULACION';

export interface InventoryMovement {
  id: number;
  productId: number;
  productName: string;
  size: string;
  type: MovementType;
  quantity: number;
  stockAfter: number | null;
  reference?: string;
  note?: string;
  createdAt: string;
}

// ----- Finanzas -----

export interface FinanceRange {
  from: string;
  to: string;
  channel?: 'WEB' | 'MANUAL' | '';
  payment?: string;
  categoryId?: number | null;
  productId?: number | null;
}

export interface FinanceFilterOptions {
  categories: { id: number; name: string }[];
  products: { id: number; name: string; categoryId: number }[];
  payments: string[];
}

export interface Kpis {
  revenue: number;
  shipping: number;
  grossSales: number;
  cogs: number;
  grossProfit: number;
  paymentFees: number;
  expenses: number;
  netProfit: number;
  margin: number;
  grossMargin: number;
  orders: number;
  units: number;
  avgTicket: number;
  unitsWithoutCost: number;
}

export interface GroupRow {
  name: string;
  productId?: number;
  units: number;
  revenue: number;
  profit: number;
  missingCost: boolean;
  orders?: number;
}

export interface FinanceSummary {
  range: FinanceRange;
  previousRange: FinanceRange;
  kpis: Kpis;
  previous: Kpis;
  series: { groupBy: 'day' | 'month'; points: { period: string; revenue: number; netProfit: number; orders: number; units: number }[] };
  topProducts: GroupRow[];
  mostProfitable: GroupRow[];
  bySize: GroupRow[];
  byCategory: GroupRow[];
  byChannel: GroupRow[];
  byPayment: GroupRow[];
  byDepartment: GroupRow[];
  expensesByCategory: { name: string; total: number }[];
  slowMovers: { id: number; name: string; price: number; cost: number | null; stock: number }[];
}

export interface MonthlyClose { year: number; months: (Kpis & { month: number })[]; total: Kpis; }
export type YearlyCloseRow = Kpis & { year: number };

export interface Sale extends Order {
  channel: 'WEB' | 'MANUAL';
  items: (OrderItem & { unitCost: number | null; profit: number | null })[];
  cogs: number;
  grossProfit: number;
  missingCost: boolean;
}

export interface Expense { id: number; date: string; category: string; description: string; amount: number; }

export interface CostRow {
  id: number;
  name: string;
  category: string;
  isActive: boolean;
  price: number;
  cost: number | null;
  stock: number;
  sizes: { size: string; stock: number }[];
}

export interface AuthResponse {
  token: string;
  user: User;
}
