export interface Product {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  description?: string;
  shortDescription?: string;
  image?: string;
  images?: string[];
  price?: string;
  regularPrice?: string;
  salePrice?: string;
  onSale?: boolean;
  permalink?: string;
  attributes?: {
    name: string;
    options: string[];
  }[];
  type?: 'simple' | 'variable' | 'grouped' | 'external';
  variations?: Variation[];
  catalogVisibility?: string;
  status?: string;
}

export interface Variation {
  id: number;
  price?: string;
  regularPrice?: string;
  salePrice?: string;
  onSale?: boolean;
  image?: string;
  attributes: {
    name: string;
    option: string;
  }[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
