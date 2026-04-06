import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, CreditCard, MapPin, Phone, User, ShoppingBag, Loader2, Upload, ImageIcon, Package } from 'lucide-react';
import { Product } from '../types';

interface CheckoutProps {
  items: { product: Product, quantity: number }[];
  onComplete: (orderData: any) => void;
  onBack: () => void;
}

interface PaymentGateway {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  settings?: any;
}

interface ShippingMethod {
  id: number;
  instance_id: number;
  title: string;
  method_id: string;
  settings?: any;
  enabled: boolean;
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentGateway[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingMethod | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchMethods();
  }, []);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const [pgRes, szRes] = await Promise.all([
        fetch('/api/payment-gateways'),
        fetch('/api/shipping-zones')
      ]);
      const pgData = await pgRes.json();
      const szData = await szRes.json();

      setPaymentMethods(pgData.filter((m: any) => m.enabled));
      if (pgData.length > 0) setSelectedPayment(pgData.find((m: any) => m.enabled)?.id || '');

      // For simplicity, we fetch methods from the first zone (usually 'Everywhere' or 'Saudi Arabia')
      if (szData.length > 0) {
        const smRes = await fetch(`/api/shipping-zones/${szData[0].id}/methods`);
        const smData = await smRes.json();
        const enabledMethods = smData.filter((m: any) => m.enabled);
        setShippingMethods(enabledMethods);
        if (enabledMethods.length > 0) setSelectedShipping(enabledMethods[0]);
      }
    } catch (err) {
      console.error("Error fetching methods:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setProofUrl(data.url);
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const subtotal = items.reduce((acc, item) => {
    const price = parseFloat((item.product as any).price || '0');
    return acc + (price * item.quantity);
  }, 0);

  const shippingCost = selectedShipping?.method_id === 'flat_rate' 
    ? parseFloat(selectedShipping.settings?.cost?.value || '0') 
    : 0;

  const total = subtotal + shippingCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPayment === 'bacs' && !proofUrl) {
      alert('يرجى رفع صورة التحويل البنكي للمتابعة');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const orderBody = {
        payment_method: selectedPayment,
        payment_method_title: paymentMethods.find(m => m.id === selectedPayment)?.title,
        set_paid: false,
        billing: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          address_1: formData.address,
          city: formData.city,
          email: formData.email,
          phone: formData.phone
        },
        shipping: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          address_1: formData.address,
          city: formData.city
        },
        line_items: items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        })),
        shipping_lines: selectedShipping ? [
          {
            method_id: selectedShipping.method_id,
            method_title: selectedShipping.title,
            total: shippingCost.toString()
          }
        ] : [],
        customer_note: formData.notes,
        meta_data: proofUrl ? [
          {
            key: '_bank_transfer_proof',
            value: proofUrl
          }
        ] : []
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody)
      });

      const data = await res.json();
      if (res.ok) {
        setOrderId(data.id);
        setIsSuccess(true);
        onComplete(data);
      } else {
        alert('فشل إرسال الطلب: ' + (data.message || 'خطأ غير معروف'));
      }
    } catch (err) {
      console.error("Order submission error:", err);
      alert('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
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
          شكراً لتسوقك معنا. رقم طلبك هو <span className="font-bold text-blue-600">#{orderId}</span>. 
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">جاري تجهيز صفحة الدفع...</p>
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
              <Package size={20} className="text-blue-600" />
              طريقة الشحن
            </h2>
            <div className="grid gap-4">
              {shippingMethods.map((method) => (
                <button
                  key={method.instance_id}
                  type="button"
                  onClick={() => setSelectedShipping(method)}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                    selectedShipping?.instance_id === method.instance_id 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-slate-100 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-4 bg-white ${
                      selectedShipping?.instance_id === method.instance_id ? 'border-blue-600' : 'border-slate-200'
                    }`}></div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{method.title}</p>
                    </div>
                  </div>
                  <div className="font-bold text-blue-600">
                    {method.method_id === 'flat_rate' ? `${method.settings?.cost?.value} ر.س` : 'مجاني'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-right">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CreditCard size={20} className="text-blue-600" />
              طريقة الدفع
            </h2>
            <div className="grid gap-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment(method.id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                      selectedPayment === method.id 
                      ? 'border-blue-600 bg-blue-50' 
                      : 'border-slate-100 hover:border-blue-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-4 bg-white ${
                      selectedPayment === method.id ? 'border-blue-600' : 'border-slate-200'
                    }`}></div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{method.title}</p>
                      <p className="text-xs text-slate-500">{method.description}</p>
                    </div>
                  </button>

                  {selectedPayment === 'bacs' && method.id === 'bacs' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4"
                    >
                      <div className="p-4 bg-blue-100/50 text-blue-700 rounded-xl text-sm font-medium">
                        يرجى تحويل المبلغ إلى أحد الحسابات البنكية التالية ورفع صورة التحويل (إيصال الدفع) للمتابعة.
                      </div>
                      
                      {method.settings?.account_details?.value && method.settings.account_details.value.length > 0 && (
                        <div className="space-y-3">
                          {method.settings.account_details.value.map((acc: any, i: number) => (
                            <div key={i} className="p-4 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-500">اسم البنك:</span>
                                <span className="font-bold text-slate-900">{acc.bank_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">اسم الحساب:</span>
                                <span className="font-bold text-slate-900">{acc.account_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">رقم الحساب:</span>
                                <span className="font-bold text-slate-900 font-mono">{acc.account_number}</span>
                              </div>
                              {acc.iban && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">IBAN:</span>
                                  <span className="font-bold text-slate-900 font-mono">{acc.iban}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">رفع إثبات الدفع</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-grow cursor-pointer group">
                            <div className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${
                              proofUrl ? 'border-green-500 bg-green-50' : 'border-slate-300 group-hover:border-blue-400 bg-white'
                            }`}>
                              {uploading ? (
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                              ) : proofUrl ? (
                                <>
                                  <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                                  <span className="text-xs text-green-600 font-bold">تم الرفع بنجاح</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-8 h-8 text-slate-400 mb-2 group-hover:text-blue-500" />
                                  <span className="text-xs text-slate-500 font-medium">اضغط لرفع صورة التحويل</span>
                                </>
                              )}
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handleFileUpload}
                              disabled={uploading}
                            />
                          </label>
                          {proofUrl && (
                            <div className="w-32 h-32 rounded-2xl overflow-hidden border border-slate-200">
                              <img src={proofUrl} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
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
                <span>{subtotal.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>الشحن</span>
                <span className={shippingCost === 0 ? "text-green-600 font-bold" : ""}>
                  {shippingCost === 0 ? 'مجاني' : `${shippingCost.toFixed(2)} ر.س`}
                </span>
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
