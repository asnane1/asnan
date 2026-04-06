import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  LayoutGrid, 
  List, 
  ArrowUpDown,
  ShoppingCart,
  Heart,
  Plus,
  Loader2
} from 'lucide-react';
import { Product } from '../types';

interface WCCategory {
  id: number;
  name: string;
  parent: number;
  slug: string;
  image?: { src: string };
}

interface ShopProps {
  products: Product[];
  categories: WCCategory[];
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleFavorite: (product: Product) => void;
  favorites: Product[];
  loading: boolean;
}

type SortOption = 'newest' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc';

const PRODUCTS_PER_PAGE = 12;

export default function Shop({ 
  products, 
  categories, 
  onProductClick, 
  onAddToCart, 
  onToggleFavorite, 
  favorites,
  loading 
}: ShopProps) {
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE);
  const observerTarget = useRef<HTMLDivElement>(null);

  const parentCategories = useMemo(() => {
    return categories.filter(cat => cat.parent === 0);
  }, [categories]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           product.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedChildId 
        ? product.category === selectedChildId.toString()
        : selectedParentId 
          ? product.category === selectedParentId.toString() || 
            categories.find(c => c.id.toString() === product.category)?.parent === selectedParentId
          : true;

      return matchesSearch && matchesCategory;
    });

    // Sorting
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => parseFloat(a.price || '0') - parseFloat(b.price || '0'));
        break;
      case 'price-high':
        result.sort((a, b) => parseFloat(b.price || '0') - parseFloat(a.price || '0'));
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
      default:
        result.sort((a, b) => parseInt(b.id) - parseInt(a.id));
        break;
    }

    return result;
  }, [products, searchQuery, selectedParentId, selectedChildId, sortBy, categories]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [searchQuery, selectedParentId, selectedChildId, sortBy]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredProducts.length) {
          setVisibleCount((prev) => prev + PRODUCTS_PER_PAGE);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, filteredProducts.length]);

  const displayedProducts = filteredProducts.slice(0, visibleCount);

  const handleParentToggle = (id: number) => {
    if (selectedParentId === id) {
      setSelectedParentId(null);
      setSelectedChildId(null);
    } else {
      setSelectedParentId(id);
      setSelectedChildId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar - Categories */}
        <aside className={`w-full md:w-64 flex-shrink-0 ${isFilterOpen ? 'block' : 'hidden md:block'}`}>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 sticky top-24">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Filter size={20} className="text-[#00b5ad]" />
              التصنيفات
            </h3>
            
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setSelectedParentId(null);
                  setSelectedChildId(null);
                }}
                className={`w-full text-right px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedParentId === null ? 'bg-[#00b5ad] text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                الكل
              </button>
              
              {parentCategories.map(parent => {
                const children = categories.filter(c => c.parent === parent.id);
                const isOpen = selectedParentId === parent.id;
                
                return (
                  <div key={parent.id} className="space-y-1">
                    <button 
                      onClick={() => handleParentToggle(parent.id)}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        isOpen ? 'bg-[#00b5ad]/10 text-[#00b5ad]' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{parent.name}</span>
                      {children.length > 0 && (
                        <ChevronDown 
                          size={16} 
                          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} 
                        />
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {isOpen && children.length > 0 && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pr-4 space-y-1"
                        >
                          {children.map(child => (
                            <button 
                              key={child.id}
                              onClick={() => setSelectedChildId(child.id)}
                              className={`w-full text-right px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                                selectedChildId === child.id ? 'text-[#00b5ad] font-bold' : 'text-slate-500 hover:text-[#00b5ad]'
                              }`}
                            >
                              {child.name}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-grow">
          {/* Top Bar - Search & Sort */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="بحث عن منتج..." 
                className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2 text-sm text-slate-500 whitespace-nowrap">
                <ArrowUpDown size={16} />
                ترتيب حسب:
              </div>
              <select 
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00b5ad] w-full sm:w-auto"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="newest">الأحدث</option>
                <option value="price-low">السعر: من الأقل للأعلى</option>
                <option value="price-high">السعر: من الأعلى للأقل</option>
                <option value="name-asc">الاسم: أ-ي</option>
                <option value="name-desc">الاسم: ي-أ</option>
              </select>
              
              <button 
                className="md:hidden p-2 bg-slate-50 rounded-xl text-slate-600"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <Filter size={20} />
              </button>
            </div>
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#00b5ad]/20 border-t-[#00b5ad] rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-medium">جاري تحميل المنتجات...</p>
            </div>
          ) : displayedProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedProducts.map(product => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-100 hover:border-[#00b5ad] transition-all group shadow-sm hover:shadow-md flex flex-col"
                    onClick={() => onProductClick(product)}
                  >
                    <div className="relative aspect-square bg-slate-50 p-4">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                          <ShoppingCart size={64} />
                        </div>
                      )}
                      
                      {product.onSale && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                          خصم
                        </div>
                      )}

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(product);
                        }}
                        className={`absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
                          favorites.some(p => p.id === product.id) 
                            ? 'bg-red-500 text-white' 
                            : 'bg-white text-slate-400 hover:text-red-500'
                        }`}
                      >
                        <Heart size={16} fill={favorites.some(p => p.id === product.id) ? "currentColor" : "none"} />
                      </button>
                    </div>

                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="text-sm font-bold text-slate-900 mb-2 line-clamp-2 min-h-[40px]">
                        {product.name}
                      </h3>
                      
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex flex-col">
                          {product.onSale ? (
                            <>
                              <span className="text-[#00b5ad] font-bold text-base">{product.salePrice} ر.س</span>
                              <span className="text-slate-400 line-through text-[10px]">{product.regularPrice} ر.س</span>
                            </>
                          ) : (
                            <span className="text-[#00b5ad] font-bold text-base">
                              {product.price ? `${product.price} ر.س` : 'اتصل للسعر'}
                            </span>
                          )}
                        </div>
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product);
                          }}
                          className="w-10 h-10 bg-[#00b5ad] text-white rounded-xl flex items-center justify-center hover:bg-[#008d87] transition-all shadow-lg shadow-[#00b5ad]/20"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Infinite Scroll Trigger */}
              <div 
                ref={observerTarget} 
                className="w-full py-10 flex justify-center items-center"
              >
                {visibleCount < filteredProducts.length && (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-[#00b5ad]" size={32} />
                    <p className="text-sm text-slate-500">جاري تحميل المزيد...</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">لا توجد نتائج</h3>
              <p className="text-slate-500">لم نجد أي منتجات تطابق بحثك أو التصنيف المختار.</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedParentId(null);
                  setSelectedChildId(null);
                }}
                className="mt-6 text-[#00b5ad] font-bold hover:underline"
              >
                إعادة ضبط البحث
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
