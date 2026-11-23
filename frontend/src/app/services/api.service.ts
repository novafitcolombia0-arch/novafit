import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Category, CheckoutRequest, CostRow, Expense, FinanceFilterOptions, FinanceRange, FinanceSummary, InventoryMovement, InventoryProduct,
  MonthlyClose, Order, OrderSummary, Product, Sale, YearlyCloseRow, DiscountCode, Subscriber, WelcomeOffer,
  CampaignDraft, CampaignsInfo, EmailCampaign, CustomersReport, Role, User,
} from '../models/types';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private adminHeaders(): { headers: HttpHeaders } {
    return { headers: this.auth.getHeaders() };
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  getCategory(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/categories/${id}`);
  }

  createCategory(data: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, data, this.adminHeaders());
  }

  updateCategory(id: number, data: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/categories/${id}`, data, this.adminHeaders());
  }

  deleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`, this.adminHeaders());
  }

  getProducts(categoryId?: number, search?: string): Observable<Product[]> {
    let url = `${this.apiUrl}/products?`;
    if (categoryId) url += `categoryId=${categoryId}&`;
    if (search) url += `search=${search}&`;
    return this.http.get<Product[]>(url);
  }

  getAllProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products/all`, this.adminHeaders());
  }

  getProduct(slug: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${slug}`);
  }

  createProduct(data: any): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/products`, data, this.adminHeaders());
  }

  updateProduct(id: number, data: any): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/products/${id}`, data, this.adminHeaders());
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/products/${id}`, this.adminHeaders());
  }

  getSettings(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.apiUrl}/settings`);
  }

  /** Configuración completa (incluye datos internos como la comisión de Wompi); solo panel */
  getAdminSettings(): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.apiUrl}/settings/admin`, this.adminHeaders());
  }

  updateSettings(settings: Record<string, string>): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings`, { settings }, this.adminHeaders());
  }

  // ----- Finanzas -----

  /** Fechas + filtros como query string (?from=…&to=…&channel=…) */
  private rangeQuery(r: Partial<FinanceRange>) {
    const parts: string[] = [];
    if (r.from) parts.push(`from=${r.from}`);
    if (r.to) parts.push(`to=${r.to}`);
    if (r.channel) parts.push(`channel=${r.channel}`);
    if (r.payment) parts.push(`payment=${encodeURIComponent(r.payment)}`);
    if (r.categoryId) parts.push(`categoryId=${r.categoryId}`);
    if (r.productId) parts.push(`productId=${r.productId}`);
    return parts.join('&');
  }

  getFinanceFilters(): Observable<FinanceFilterOptions> {
    return this.http.get<FinanceFilterOptions>(`${this.apiUrl}/finance/filters`, this.adminHeaders());
  }

  getFinanceSummary(r: FinanceRange): Observable<FinanceSummary> {
    return this.http.get<FinanceSummary>(`${this.apiUrl}/finance/summary?${this.rangeQuery(r)}`, this.adminHeaders());
  }

  getMonthlyClose(year: number, filters: Partial<FinanceRange> = {}): Observable<MonthlyClose> {
    return this.http.get<MonthlyClose>(`${this.apiUrl}/finance/monthly?year=${year}&${this.rangeQuery({ ...filters, from: '', to: '' })}`, this.adminHeaders());
  }

  getYearlyClose(filters: Partial<FinanceRange> = {}): Observable<YearlyCloseRow[]> {
    return this.http.get<YearlyCloseRow[]>(`${this.apiUrl}/finance/yearly?${this.rangeQuery({ ...filters, from: '', to: '' })}`, this.adminHeaders());
  }

  getSales(r: FinanceRange): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.apiUrl}/finance/sales?${this.rangeQuery(r)}`, this.adminHeaders());
  }

  createSale(data: any): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/finance/sales`, data, this.adminHeaders());
  }

  voidSale(id: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/finance/sales/${id}/void`, { reason }, this.adminHeaders());
  }

  getExpenses(r: FinanceRange): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.apiUrl}/finance/expenses?${this.rangeQuery(r)}`, this.adminHeaders());
  }

  createExpense(data: Partial<Expense>): Observable<Expense> {
    return this.http.post<Expense>(`${this.apiUrl}/finance/expenses`, data, this.adminHeaders());
  }

  updateExpense(id: number, data: Partial<Expense>): Observable<Expense> {
    return this.http.put<Expense>(`${this.apiUrl}/finance/expenses/${id}`, data, this.adminHeaders());
  }

  deleteExpense(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/finance/expenses/${id}`, this.adminHeaders());
  }

  getCosts(): Observable<CostRow[]> {
    return this.http.get<CostRow[]>(`${this.apiUrl}/finance/costs`, this.adminHeaders());
  }

  updateCost(id: number, data: { price?: number; cost?: number | null }): Observable<any> {
    return this.http.put(`${this.apiUrl}/finance/costs/${id}`, data, this.adminHeaders());
  }

  exportFinance(r: FinanceRange): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/finance/export?${this.rangeQuery(r)}`, { ...this.adminHeaders(), responseType: 'blob' });
  }

  // ----- Inventario -----

  getInventory(): Observable<InventoryProduct[]> {
    return this.http.get<InventoryProduct[]>(`${this.apiUrl}/inventory`, this.adminHeaders());
  }

  adjustInventory(data: { productId: number; color?: string; size: string; type: 'ENTRADA' | 'SALIDA' | 'AJUSTE'; quantity: number; note?: string }): Observable<{ productId: number; color: string; size: string; stock: number }> {
    return this.http.post<{ productId: number; color: string; size: string; stock: number }>(`${this.apiUrl}/inventory/adjust`, data, this.adminHeaders());
  }

  getInventoryMovements(productId?: number, type?: string): Observable<InventoryMovement[]> {
    const params: string[] = [];
    if (productId) params.push(`productId=${productId}`);
    if (type) params.push(`type=${type}`);
    return this.http.get<InventoryMovement[]>(`${this.apiUrl}/inventory/movements${params.length ? '?' + params.join('&') : ''}`, this.adminHeaders());
  }

  // ----- Pedidos y pagos (Wompi) -----

  checkout(data: CheckoutRequest): Observable<{ reference: string; checkoutUrl: string }> {
    return this.http.post<{ reference: string; checkoutUrl: string }>(`${this.apiUrl}/orders/checkout`, data);
  }

  getOrderStatus(reference: string, transactionId?: string): Observable<OrderSummary> {
    const query = transactionId ? `?id=${encodeURIComponent(transactionId)}` : '';
    return this.http.get<OrderSummary>(`${this.apiUrl}/orders/by-reference/${encodeURIComponent(reference)}${query}`);
  }

  simulatePayment(reference: string, status: 'APPROVED' | 'DECLINED', method: string): Observable<{ transactionId: string; status: string }> {
    return this.http.post<{ transactionId: string; status: string }>(`${this.apiUrl}/orders/simulate/${encodeURIComponent(reference)}`, { status, method });
  }

  getOrders(status?: string): Observable<Order[]> {
    const query = status ? `?status=${status}` : '';
    return this.http.get<Order[]>(`${this.apiUrl}/orders${query}`, this.adminHeaders());
  }

  updateOrder(id: number, data: Partial<Pick<Order, 'fulfillmentStatus' | 'trackingNumber' | 'carrier' | 'trackingUrl'>>): Observable<Order & { emailSent?: boolean }> {
    return this.http.patch<Order & { emailSent?: boolean }>(`${this.apiUrl}/orders/${id}`, data, this.adminHeaders());
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string; token: string }> {
    return this.http.put<{ message: string; token: string }>(`${this.apiUrl}/auth/password`, { currentPassword, newPassword }, this.adminHeaders());
  }

  // ----- Descuentos y suscripción -----

  validateDiscount(code: string, email: string, subtotal: number): Observable<{ code: string; percent: number; amount: number }> {
    return this.http.post<{ code: string; percent: number; amount: number }>(`${this.apiUrl}/discounts/validate`, { code, email, subtotal });
  }

  getWelcomeOffer(): Observable<WelcomeOffer> {
    return this.http.get<WelcomeOffer>(`${this.apiUrl}/discounts/welcome-offer`);
  }

  subscribe(email: string, name?: string): Observable<{ subscribed: boolean; code?: string; percent?: number; firstPurchaseOnly?: boolean }> {
    return this.http.post<{ subscribed: boolean; code?: string; percent?: number; firstPurchaseOnly?: boolean }>(`${this.apiUrl}/subscribers`, { email, name });
  }

  getDiscounts(): Observable<DiscountCode[]> {
    return this.http.get<DiscountCode[]>(`${this.apiUrl}/discounts`, this.adminHeaders());
  }

  createDiscount(data: Partial<DiscountCode> & { prefix?: string }): Observable<DiscountCode> {
    return this.http.post<DiscountCode>(`${this.apiUrl}/discounts`, data, this.adminHeaders());
  }

  updateDiscount(id: number, data: Partial<DiscountCode>): Observable<DiscountCode> {
    return this.http.put<DiscountCode>(`${this.apiUrl}/discounts/${id}`, data, this.adminHeaders());
  }

  deleteDiscount(id: number): Observable<{ message: string; deactivated?: boolean }> {
    return this.http.delete<{ message: string; deactivated?: boolean }>(`${this.apiUrl}/discounts/${id}`, this.adminHeaders());
  }

  getSubscribers(): Observable<Subscriber[]> {
    return this.http.get<Subscriber[]>(`${this.apiUrl}/subscribers`, this.adminHeaders());
  }

  // ----- Promociones por correo -----

  getCampaigns(): Observable<CampaignsInfo> {
    return this.http.get<CampaignsInfo>(`${this.apiUrl}/campaigns`, this.adminHeaders());
  }

  sendTestCampaign(data: CampaignDraft & { to?: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/campaigns/test`, data, this.adminHeaders());
  }

  sendCampaign(data: CampaignDraft): Observable<EmailCampaign> {
    return this.http.post<EmailCampaign>(`${this.apiUrl}/campaigns`, data, this.adminHeaders());
  }

  deleteSubscriber(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/subscribers/${id}`, this.adminHeaders());
  }

  // ----- Clientes (recompra) -----

  getCustomers(): Observable<CustomersReport> {
    return this.http.get<CustomersReport>(`${this.apiUrl}/customers`, this.adminHeaders());
  }

  // ----- Usuarios del panel -----

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`, this.adminHeaders());
  }

  createUser(data: { email: string; password: string; role: Role }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, data, this.adminHeaders());
  }

  updateUser(id: number, data: { role?: Role; password?: string }): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, data, this.adminHeaders());
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/users/${id}`, this.adminHeaders());
  }
}
