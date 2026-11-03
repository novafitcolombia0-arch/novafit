import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category, Product } from '../models/types';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = 'http://localhost:3001/api';

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

  updateSettings(settings: Record<string, string>): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings`, { settings }, this.adminHeaders());
  }
}
