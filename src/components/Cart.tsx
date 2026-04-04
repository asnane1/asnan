import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShoppingCart } from 'lucide-react';
import { Product } from '../types';

interface CartProps {
  items: { product: Product, quantity: number }[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
  onBack: () => void;
}

export default function Cart({ items, onUpdateQuantity, onRemove, onCheckout, onBack }: CartProps) {
  const total = items.reduce((acc, item) => {
    const price = parseFloat((item.product as any).price || '0');
    return acc + (price * item.quantity);
  }, 0);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center" dir="rtl">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
          <ShoppingCart size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">سلة المشتريات فارغة</h2>
        <p className="text-slate-500 mb-8">لم تقم بإضافة أي منتجات إلى السلة بعد.</p>
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
        <h1 className="text-3xl font-bold text-slate-900">سلة المشتريات</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div 
                key={item.product.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-4 sm:gap-6 items-center"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0">
                  {item.product.image ? (
                    <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ShoppingBag size={32} />
                    </div>
                  )}
                </div>

                <div className="flex-grow text-right">
                  <h3 className="font-bold text-slate-900 text-lg mb-1">{item.product.name}</h3>
                  <p className="text-blue-600 font-bold mb-3">{(item.product as any).price} ر.س</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-slate-100 rounded-xl p-1">
                      <button 
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-600"
                      >
                        <Plus size={16} />
                      </button>
                      <span className="px-4 font-bold text-slate-900">{item.quantity}</span>
                      <button 
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-600"
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={16} />
                      </button>
                    </div>

                    <button 
                      onClick={() => onRemove(item.product.id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 sticky top-24 text-right">
            <h2 className="text-xl font-bold text-slate-900 mb-6">ملخص الطلب</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي</span>
                <span>{total.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>الشحن</span>
                <span className="text-green-600 font-bold">مجاني</span>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-between text-xl font-bold text-slate-900">
                <span>الإجمالي</span>
                <span className="text-blue-600">{total.toFixed(2)} ر.س</span>
              </div>
            </div>

            <button 
              onClick={onCheckout}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              إتمام الطلب
              <ArrowRight size={20} className="rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
