import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, CreditCard, MapPin, Phone, User, ShoppingBag, Loader2 } from 'lucide-react';
import { Product } from '../types';

interface CheckoutProps {
  items: { product: Product, quantity: number }[];
  onComplete: (orderData: any) => void;
  onBack: () => void;
}

export default function Checkout({ items, onComplete, onBack }: CheckoutProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const total = items.reduce((acc, item) => {
    const price = parseFloat((item.product as any).price || '0');
    return acc + (price * item.quantity);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setIsSuccess(true);
    onComplete({ ...formData, items, total });
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir="rtl">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-600/20"
        >
          <CheckCircle2 size={48} />
        </motion.div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">تم استلام طلبك بنجاح!</h2>
        <p className="text-slate-500 mb-10 text-lg leading-relaxed">
          شكراً لتسوقك معنا. رقم طلبك هو <span className="font-bold text-blue-600">#WC-{Math.floor(Math.random() * 10000)}</span>. 
          سنتواصل معك قريباً لتأكيد تفاصيل الشحن.
        </p>
        <button 
          onClick={onBack}
          className="px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          العودة للمتجر
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
        <h1 className="text-3xl font-bold text-slate-900">إتمام الطلب</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-right">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User size={20} className="text-blue-600" />
              المعلومات الشخصية
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">الاسم الأول</label>
                <input 
                  type="text" 
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">اسم العائلة</label>
                <input 
                  type="text" 
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">رقم الجوال</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="tel" 
                    required
                    placeholder="05xxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-right">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin size={20} className="text-blue-600" />
              عنوان الشحن
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">المدينة</label>
                <input 
                  type="text" 
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">العنوان بالتفصيل</label>
                <textarea 
                  required
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  placeholder="اسم الحي، الشارع، رقم المبنى..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">ملاحظات إضافية (اختياري)</label>
                <textarea 
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-right">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CreditCard size={20} className="text-blue-600" />
              طريقة الدفع
            </h2>
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-center gap-4">
              <div className="w-6 h-6 rounded-full border-4 border-blue-600 bg-white"></div>
              <div className="flex-grow">
                <p className="font-bold text-slate-900">الدفع عند الاستلام</p>
                <p className="text-xs text-slate-500">ادفع نقداً عند استلام طلبك من مندوب التوصيل</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 sticky top-24 text-right">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <ShoppingBag size={20} className="text-blue-600" />
              ملخص الطلب
            </h2>
            
            <div className="max-h-60 overflow-y-auto mb-6 space-y-4 pr-2">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3 items-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.quantity} × {(item.product as any).price} ر.س</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 mb-8 pt-6 border-t border-slate-100">
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
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري المعالجة...
                </>
              ) : (
                <>
                  تأكيد الطلب
                  <CheckCircle2 size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
