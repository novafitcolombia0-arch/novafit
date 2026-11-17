import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'catalogo',
    loadComponent: () => import('./pages/catalog/catalog.component').then(m => m.CatalogComponent),
  },
  {
    path: 'producto/:slug',
    loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
  },
  {
    path: 'conocenos',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'garantias-y-cambios',
    loadComponent: () => import('./pages/policies/policies.component').then(m => m.PoliciesComponent),
  },
  {
    path: 'carrito',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
  },
  {
    path: 'pedido/:reference',
    loadComponent: () => import('./pages/order-result/order-result.component').then(m => m.OrderResultComponent),
  },
  {
    path: 'pago-simulado/:reference',
    loadComponent: () => import('./pages/simulated-payment/simulated-payment.component').then(m => m.SimulatedPaymentComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin/login/admin-login.component').then(m => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/admin/dashboard/dashboard.component').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'categorias',
        loadComponent: () => import('./pages/admin/categories/categories.component').then(m => m.AdminCategoriesComponent),
      },
      {
        path: 'productos',
        loadComponent: () => import('./pages/admin/products/products.component').then(m => m.AdminProductsComponent),
      },
      {
        path: 'finanzas',
        loadComponent: () => import('./pages/admin/finance/finance.component').then(m => m.AdminFinanceComponent),
      },
      {
        path: 'inventario',
        loadComponent: () => import('./pages/admin/inventory/inventory.component').then(m => m.AdminInventoryComponent),
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./pages/admin/orders/orders.component').then(m => m.AdminOrdersComponent),
      },
      {
        path: 'descuentos',
        loadComponent: () => import('./pages/admin/discounts/discounts.component').then(m => m.AdminDiscountsComponent),
      },
      {
        path: 'suscriptores',
        loadComponent: () => import('./pages/admin/subscribers/subscribers.component').then(m => m.AdminSubscribersComponent),
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./pages/admin/settings/settings.component').then(m => m.AdminSettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
