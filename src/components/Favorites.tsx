import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { Product } from '../types';

interface FavoritesProps {
  items: Product[];
  onToggleFavorite: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onBack: () => void;
}

export default function Favorites({ items, onToggleFavorite, onAddToCart, onBack }: FavoritesProps) {
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center" dir="rtl">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
          <Heart size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">قائمة المفضلة فارغة</h2>
        <p className="text-slate-500 mb-8">لم تقم بإضافة أي منتجات إلى المفضلة بعد.</p>
        <button 
          onClick={onBack}
          className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          العودة للتسوق
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12" dir="rtl">
      <div className="flex items-center gap-4 mb-10">
        <button 
          onClick={onBack}
          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-all"
        >
          <ArrowRight size={24} />
        </button>
        <h1 className="text-3xl font-bold text-slate-900">المفضلة</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {items.map((product) => (
            <motion.div 
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 flex flex-col relative"
            >
              <button 
                onClick={() => onToggleFavorite(product)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-xl text-red-500 shadow-sm transition-all"
              >
                <Heart size={20} fill="currentColor" />
              </button>

              <div className="aspect-square bg-slate-50 overflow-hidden relative">
                {product.image ? (
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <Heart size={64} />
                  </div>
                )}
              </div>

              <div className="p-6 flex flex-col flex-grow text-right">
                <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2">{product.name}</h3>
                <p className="text-blue-600 font-bold mb-4">{(product as any).price} ر.س</p>
                
                <button 
                  onClick={() => onAddToCart(product)}
                  className="mt-auto w-full py-3 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={18} />
                  إضافة للسلة
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
