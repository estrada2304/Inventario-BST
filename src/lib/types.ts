export interface InventoryMovement {
  id: string;
  productId: string;
  productName?: string;
  serialNumber?: string;
  type: 'entry' | 'exit' | 'adjustment';
  quantity: number;
  previousStock?: number;
  newStock?: number;
  date: string;
  notes?: string;
  userName?: string;
  userEmail?: string;
  createdBy?: string;
  createdAt?: any;
}

export interface ProductComponent {
  productId: string;
  name: string;
  quantity: number;
  unit?: string;
}

export interface Product {
  id: string;
  name: string;
  serialNumber?: string;
  description?: string;
  quantity?: number;
  stock?: number;
  price?: number;
  unit?: string;
  unitValue?: string;
  warehouse?: string;
  image?: string;
  datasheets?: ImportDocument[];
  profitMargin?: number;
  sales?: number;
  exw?: number;
  fob?: number;
  cif?: number;
  retailPrice?: number;
  vesPrice?: number;
  bcvPrice?: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  isComposite?: boolean;
  components?: ProductComponent[];
  createdByName?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
  createdTime?: string;
}

export interface RecentSale {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAvatar: string;
  amount: number;
}

export interface SalesData {
  name: string;
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  taxId?: string;
  email: string;
  phone: string;
  country: string;
  address?: string;
  clientType?: string;
  status?: 'Activo' | 'Inactivo' | string;
  notes?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type Client = Customer;

export interface OrderItem {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 'Completado' | 'Pendiente' | 'Procesando' | 'Cancelado' | 'Completed' | 'Pending' | 'Processing' | 'Cancelled';

export interface Order {
  id: string;
  orderNumber?: string;
  quoteId?: string;
  quoteNumber?: string;
  customer: Customer;
  items: OrderItem[];
  amount: number;
  totalUSD?: number;
  totalVES?: number;
  currency: string;
  status: OrderStatus;
  date: string;
  notes?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface QuoteItem {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
}

export type QuoteStatus = 'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Cancelled';

export interface Quote {
  id: string;
  quoteNumber: string;
  orderId?: string;
  customer: Customer;
  items: QuoteItem[];
  amount: number;
  subtotal?: number;
  ivaAmount?: number;
  igtfAmount?: number;
  validUntil?: string;
  currency: 'USD' | 'VES' | string;
  status: QuoteStatus;
  date: string;
  notes?: string;
  internalNotes?: string;
  termsAndConditions?: string;
  paymentMethods?: string;
  applyIgtf?: boolean;
  createdByName?: string;
  createdByEmail?: string;
  userId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Supplier {
  id: string;
  name: string;
  seller?: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  taxId?: string;
  email: string;
  phone: string;
  country: string;
  notes?: string;
  createdByName?: string;
  createdByEmail?: string;
  status: 'Activo' | 'Inactivo';
  createdAt?: any;
  updatedAt?: any;
}

export interface ImportCost {
  fob: number;
  freight: number;
  insurance: number;
  tariffs: number;
  vat: number;
  customsExpenses: number;
  total: number;
}

export interface ImportDocument {
  id: string;
  name: string;
  url: string;
}

export interface Import {
  id: string;
  supplier: Supplier;
  title: string;
  description: string;
  origin: string;
  destination: string;
  destinationPort?: string;
  departureDate: string;
  arrivalDate: string;
  incoterm: string;
  status: 'En Tránsito' | 'En Aduana' | 'Completado' | 'Pendiente' | 'Entregado' | 'Nacionalizado' | 'En Origen' | 'Cancelado';
  costs: ImportCost;
  totalCostUSD?: number;
  notes?: string;
  documents: ImportDocument[];
  trackingNumber?: string;
  originCountry?: string;
  fobCost?: number;
  shippingCost?: number;
  estimatedArrival?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  photoURL?: string;
  role: 'Admin' | 'Sales' | 'Viewer';
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}
