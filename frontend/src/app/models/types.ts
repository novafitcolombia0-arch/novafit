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

export interface AuthResponse {
  token: string;
  user: User;
}
