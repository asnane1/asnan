export interface Product {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  description?: string;
  image?: string;
  price?: string;
  permalink?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
