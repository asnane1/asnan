export interface Product {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  description?: string;
  image?: string;
  price?: string;
  regularPrice?: string;
  salePrice?: string;
  onSale?: boolean;
  permalink?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
