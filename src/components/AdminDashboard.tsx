import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ListTree, 
  ShoppingCart, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  ChevronRight, 
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  ArrowLeft,
  LogOut,
  Monitor,
  Settings,
  Globe,
  Eye,
  MapPin,
  User,
  Mail,
  Phone,
  ShoppingBag,
  Calendar,
  FileText,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signOut, db } from '../firebase';
import GoogleIntegrationTab from './GoogleIntegrationTab';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

function getProductImageUrl(p: any): string {
  if (!p) return '';
  if (typeof p.image === 'string' && p.image) return p.image;
  if (p.image?.src && typeof p.image.src === 'string') return p.image.src;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const firstImg = p.images[0];
    if (typeof firstImg === 'string') return firstImg;
    if (typeof firstImg === 'object' && firstImg?.src) return firstImg.src;
  }
  return '';
}

function getLineItemAttributes(item: any): Array<{ key: string, value: string }> {
  const attrs: Array<{ key: string, value: string }> = [];
  if (item && Array.isArray(item.meta_data)) {
    item.meta_data.forEach((m: any) => {
      if (m && m.key && m.value) {
        if (!m.key.startsWith('_')) {
          attrs.push({ key: m.key, value: String(m.value) });
        }
      }
    });
  }
  if (item?.selectedAttributes && typeof item.selectedAttributes === 'object') {
    Object.entries(item.selectedAttributes).forEach(([key, value]) => {
      if (value) {
        attrs.push({ key, value: String(value) });
      }
    });
  }
  return attrs;
}

interface Banner {
  id?: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  link?: string;
  order: number;
  active: boolean;
  createdAt?: any;
}

interface Order {
  id: number;
  status: string;
  total: string;
  currency: string;
  date_created: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  line_items: Array<{
    id?: number;
    product_id?: string;
    name: string;
    quantity: number;
    price?: string;
    total: string;
    image?: string;
    meta_data?: Array<{ key: string, value: any }>;
  }>;
  meta_data: Array<{ key: string, value: any }>;
  payment_method?: string;
  payment_method_title?: string;
}

interface PaymentGateway {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  method_title: string;
  method_description: string;
  settings?: any;
}

interface ShippingZone {
  id: number;
  name: string;
  order: number;
}

interface ShippingMethod {
  id: number;
  instance_id: number;
  title: string;
  method_id: string;
  method_title: string;
  enabled: boolean;
  settings?: any;
}

interface Product {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price: string;
  status: string;
  type: 'simple' | 'variable';
  categories: Array<{ id: number, name: string }>;
  images: Array<{ src: string }>;
  description: string;
  short_description: string;
  stock_status: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  catalog_visibility?: string;
}

interface Category {
  id: number;
  name: string;
  parent: number;
  description: string;
  image?: { src: string };
}

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'categories' | 'banners' | 'settings' | 'google'>('orders');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [shippingMethods, setShippingMethods] = useState<Record<number, ShippingMethod[]>>({});

  const [editingItem, setEditingItem] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (activeTab === 'banners') {
      const q = query(collection(db, 'banners'), orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const bannerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
        setBanners(bannerList);
      });
      return () => unsubscribe();
    } else if (activeTab === 'settings') {
      fetchSettings();
    } else {
      fetchData();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [pgRes, szRes] = await Promise.all([
        fetch('/api/payment-gateways'),
        fetch('/api/shipping-zones')
      ]);
      let pgData = await pgRes.json();
      const szData = await szRes.json();

      if (Array.isArray(pgData)) {
        // Enforce presence of COD if not returned by WooCommerce for some exceptional reason, so it can always be managed
        const hasCod = pgData.some((m: any) => m.id === 'cod');
        if (!hasCod) {
          pgData.push({
            id: 'cod',
            title: 'الدفع عند الاستلام (COD)',
            description: 'الدفع نقداً أو ببطاقة الصرف عند استلام طلبك من مندوب الشحن.',
            enabled: false
          });
        }

        pgData = pgData.map((m: any) => {
          if (m.id === 'bacs') {
            return {
              ...m,
              title: m.title && m.title.includes('التحويل') ? m.title : 'التحويل البنكي المباشر (البنك)',
              description: m.description && m.description.includes('تحويل') ? m.description : 'الدفع من خلال تحويل المبلغ لحسابنا البنكي ورفع إيصال التحويل.'
            };
          }
          if (m.id === 'cod') {
            return {
              ...m,
              title: m.title && m.title.includes('الاستلام') ? m.title : 'الدفع عند الاستلام (COD)',
              description: m.description && m.description.includes('الاستلام') ? m.description : 'الدفع نقداً أو ببطاقة الصرف عند استلام طلبك من مندوب الشحن.'
            };
          }
          return m;
        });
      }

      setPaymentGateways(pgData);
      setShippingZones(szData);

      // Fetch methods for each zone
      for (const zone of szData) {
        const smRes = await fetch(`/api/shipping-zones/${zone.id}/methods`);
        const smData = await smRes.json();
        setShippingMethods(prev => ({ ...prev, [zone.id]: smData }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'product' | 'category', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'فشل تحميل الصورة');

      if (type === 'banner') {
        setEditingItem({ ...editingItem, imageUrl: data.url });
      } else if (type === 'product' && index !== undefined) {
        const newImages = [...editingItem.images];
        newImages[index] = { src: data.url };
        setEditingItem({ ...editingItem, images: newImages });
      } else if (type === 'category') {
        setEditingItem({ ...editingItem, image: { src: data.url } });
      }
      setSuccess('تم تحميل الصورة بنجاح');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${activeTab}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `فشل جلب البيانات من ${activeTab}`);
      }
      if (activeTab === 'orders') {
        if (Array.isArray(data)) {
          setOrders(data);
          // Fetch products as well so we can resolve any missing/unpopulated product details for existing orders
          try {
            const prodRes = await fetch('/api/products');
            if (prodRes.ok) {
              const prodData = await prodRes.json();
              if (Array.isArray(prodData)) {
                setProducts(prodData);
              }
            }
          } catch (e) {
            console.error('Error fetching products inside orders tab:', e);
          }
        } else {
          setOrders([]);
          throw new Error(data.message || data.details || 'فشل جلب الطلبات، البيانات المستلمة ليست مصفوفة');
        }
      }
      else if (activeTab === 'products') {
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          setProducts([]);
          throw new Error(data.message || data.details || 'البيانات المستلمة للمنتجات ليست مصفوفة');
        }
      }
      else if (activeTab === 'categories') {
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          setCategories([]);
          throw new Error(data.message || data.details || 'البيانات المستلمة للتصنيفات ليست مصفوفة');
        }
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editingItem.type === 'bacs_settings') {
        const res = await fetch(`/api/payment-gateways/${editingItem.gatewayId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: {
              account_details: editingItem.accounts
            }
          })
        });
        if (!res.ok) throw new Error('Failed to save bank details');
        fetchSettings();
      } else if (activeTab === 'banners') {
        if (editingItem.id) {
          const bannerRef = doc(db, 'banners', editingItem.id);
          const { id, ...data } = editingItem;
          await updateDoc(bannerRef, data);
        } else {
          await addDoc(collection(db, 'banners'), {
            ...editingItem,
            createdAt: serverTimestamp()
          });
        }
      } else {
        const method = editingItem.id ? 'PUT' : 'POST';
        const url = editingItem.id ? `/api/${activeTab}/${editingItem.id}` : `/api/${activeTab}`;
        
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingItem)
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'فشل حفظ العنصر');
        }
      }
      
      setSuccess('تم الحفظ بنجاح');
      setIsModalOpen(false);
      setEditingItem(null);
      if (activeTab !== 'banners') fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;
    setLoading(true);
    try {
      if (activeTab === 'banners') {
        await deleteDoc(doc(db, 'banners', id));
      } else {
        const res = await fetch(`/api/${activeTab}/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'فشل حذف العنصر');
        }
        fetchData();
      }
      setSuccess('تم الحذف بنجاح');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل تحديث الحالة');
      }
      setSuccess('تم تحديث الحالة');
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-right" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <LayoutDashboard size={24} />
            </div>
            <span className="font-bold text-slate-900">لوحة التحكم</span>
          </div>
        </div>

        <nav className="flex-grow p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'orders' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <ShoppingCart size={20} />
            <span>الطلبات</span>
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'products' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Package size={20} />
            <span>المنتجات</span>
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'categories' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <ListTree size={20} />
            <span>التصنيفات</span>
          </button>
          <button 
            onClick={() => setActiveTab('banners')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'banners' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Monitor size={20} />
            <span>البنرات</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'settings' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Settings size={20} />
            <span>الإعدادات</span>
          </button>
          <button 
            onClick={() => setActiveTab('google')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'google' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Globe size={20} />
            <span>تكامل جوجل (SEO)</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          {auth.currentUser && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-2">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200">
                <img src={auth.currentUser.photoURL || undefined} alt={auth.currentUser.displayName || ''} className="w-full h-full object-cover" />
              </div>
              <div className="flex-grow overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{auth.currentUser.displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{auth.currentUser.email}</p>
              </div>
            </div>
          )}
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
          <button 
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all text-sm font-medium"
          >
            <ArrowLeft size={18} />
            <span>العودة للمتجر</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab === 'orders' ? 'إدارة الطلبات' : 
               activeTab === 'products' ? 'إدارة المنتجات' : 
               activeTab === 'categories' ? 'إدارة التصنيفات' : 
               activeTab === 'banners' ? 'إدارة البنرات' : 
               activeTab === 'settings' ? 'الإعدادات العامة' : 'تكامل محركات البحث (Google SEO)'}
            </h1>
            <p className="text-slate-500">مرحباً بك في لوحة تحكم مسبار الاسنان</p>
          </div>

          {activeTab !== 'orders' && activeTab !== 'settings' && activeTab !== 'google' && (
            <button 
              onClick={() => {
                if (activeTab === 'products') {
                  setEditingItem({ 
                    name: '', 
                    type: 'simple',
                    regular_price: '', 
                    description: '', 
                    images: [{ src: '' }], 
                    categories: [],
                    status: 'publish',
                    catalog_visibility: 'visible'
                  });
                } else if (activeTab === 'categories') {
                  setEditingItem({ 
                    name: '', 
                    parent: 0,
                    description: '',
                    image: { src: '' }
                  });
                } else if (activeTab === 'banners') {
                  setEditingItem({
                    imageUrl: '',
                    title: '',
                    subtitle: '',
                    link: '',
                    order: banners.length + 1,
                    active: true
                  });
                }
                setIsModalOpen(true);
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
            >
              <Plus size={20} />
              <span>إضافة {activeTab === 'products' ? 'منتج' : activeTab === 'categories' ? 'تصنيف' : 'بنر'} جديد</span>
            </button>
          )}
        </header>

        {/* Notifications */}
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-green-50 border border-green-100 text-green-600 rounded-xl flex items-center gap-3"
            >
              <CheckCircle2 size={20} />
              <span>{success}</span>
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3"
            >
              <AlertCircle size={20} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {loading && !isModalOpen ? (
            <div className="p-20 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-500">جاري جلب البيانات...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {activeTab === 'orders' && (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-700">رقم الطلب</th>
                      <th className="px-6 py-4 font-bold text-slate-700">العميل</th>
                      <th className="px-6 py-4 font-bold text-slate-700">المنتجات المطلوبة</th>
                      <th className="px-6 py-4 font-bold text-slate-700">التاريخ</th>
                      <th className="px-6 py-4 font-bold text-slate-700">الإجمالي</th>
                      <th className="px-6 py-4 font-bold text-slate-700">طريقة الدفع</th>
                      <th className="px-6 py-4 font-bold text-slate-700">إثبات الدفع</th>
                      <th className="px-6 py-4 font-bold text-slate-700">الحالة</th>
                      <th className="px-6 py-4 font-bold text-slate-700">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {orders && orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-blue-600">
                          <button 
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 focus:outline-none"
                          >
                            <span>#{order.id}</span>
                            <Eye size={14} className="opacity-60" />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{order.billing?.first_name || ''} {order.billing?.last_name || ''}</div>
                          <div className="text-xs text-slate-500">{order.billing?.phone || ''}</div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                            {order.line_items?.map((item, idx) => {
                              const matchedProduct = products.find(p => String(p.id) === String(item.product_id || item.id));
                              const name = item.name || matchedProduct?.name || 'منتج غير معروف';
                              const imageUrl = item.image || getProductImageUrl(matchedProduct) || '';
                              const itemAttrs = getLineItemAttributes(item);
                              return (
                                <div key={idx} className="flex gap-2 items-center text-right leading-relaxed border-b border-dashed border-slate-100 last:border-0 pb-1.5 last:pb-0">
                                  {/* Small preview crop */}
                                  <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                    {imageUrl ? (
                                      <img 
                                        src={imageUrl} 
                                        alt={name} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <Package className="text-slate-300" size={14} />
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-800 font-semibold flex items-center gap-1">
                                      <span>{name}</span>
                                      <span className="text-[#00b5ad] font-bold">({item.quantity || 1}x)</span>
                                    </div>
                                    {/* Mini attributes list */}
                                    {itemAttrs && itemAttrs.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {itemAttrs.map((attr, mIdx) => (
                                          <span key={mIdx} className="text-[10px] text-teal-600 bg-teal-50 px-1 py-0.2 rounded font-sans leading-none">
                                            {attr.key}: {attr.value}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {order.date_created ? new Date(order.date_created).toLocaleDateString('ar-SA') : ''}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{order.total || 0} {order.currency || 'SAR'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
                            {order.payment_method_title || order.payment_method || 'غير محدد'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {order.meta_data?.find(m => m.key === '_bank_transfer_proof')?.value ? (
                            <a 
                              href={order.meta_data.find(m => m.key === '_bank_transfer_proof')?.value} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden block border border-slate-200 hover:border-blue-500 transition-all"
                            >
                              <img 
                                src={order.meta_data.find(m => m.key === '_bank_transfer_proof')?.value} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">لا يوجد</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            order.status === 'completed' ? 'bg-green-50 text-green-600' :
                            order.status === 'processing' ? 'bg-blue-50 text-blue-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {order.status === 'completed' ? 'مكتمل' : 
                             order.status === 'processing' ? 'قيد التنفيذ' : 
                             order.status === 'pending' ? 'قيد الانتظار' : (order.status || 'معلق')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select 
                              onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                              value={order.status || 'pending'}
                              className="text-xs border-slate-200 rounded-lg focus:ring-blue-500 py-1"
                            >
                              <option value="pending">قيد الانتظار</option>
                              <option value="processing">قيد التنفيذ</option>
                              <option value="completed">مكتمل</option>
                              <option value="cancelled">ملغي</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center"
                              title="عرض التفاصيل الكاملة والعنوان"
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'products' && (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">المنتج</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">النوع</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">التصنيف</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">السعر</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">المخزون</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الحالة</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الظهور للعملاء</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {products.map(product => (
                      <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                              {product.images?.[0]?.src ? (
                                <img src={product.images[0].src} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : <ImageIcon className="w-full h-full p-2 text-slate-300" />}
                            </div>
                            <div className="font-bold text-slate-900 text-sm">{product.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {product.type === 'variable' ? 'متعدد الخيارات' : 'منتج بسيط'}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {product.categories.map(c => c.name).join(', ')}
                        </td>
                        <td className="px-6 py-4 font-bold text-blue-600 text-sm">{product.price} ر.س</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            product.stock_status === 'instock' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {product.stock_status === 'instock' ? 'متوفر' : 'نفذ'}
                            {product.manage_stock && ` (${product.stock_quantity})`}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            product.status === 'publish' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {product.status === 'publish' ? 'منشور' : product.status === 'draft' ? 'مسودة' : 'خاص'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={async () => {
                              const newVisibility = product.catalog_visibility === 'hidden' ? 'visible' : 'hidden';
                              try {
                                const res = await fetch(`/api/products/${product.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ catalog_visibility: newVisibility })
                                });
                                if (!res.ok) throw new Error('فشل تحديث حالة الظهور للعملاء');
                                setProducts(prev => prev.map(p => p.id === product.id ? { ...p, catalog_visibility: newVisibility } : p));
                              } catch (err: any) {
                                setError(`حدث خطأ أثناء التحديث: ${err.message}`);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              product.catalog_visibility === 'hidden' 
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            }`}
                            title="اضغط للتبديل بين إخفاء وإظهار المنتج للعملاء"
                          >
                            <span className={`w-2 h-2 rounded-full ${product.catalog_visibility === 'hidden' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {product.catalog_visibility === 'hidden' ? 'مخفي' : 'مرئي للجميع'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => { setEditingItem(product); setIsModalOpen(true); }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(product.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'categories' && (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">التصنيف</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">التصنيف الأب</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الوصف</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {categories.map(cat => (
                      <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                              {cat.image?.src ? (
                                <img src={cat.image.src} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : <ImageIcon className="w-full h-full p-2 text-slate-300" />}
                            </div>
                            <div className="font-bold text-slate-900 text-sm">{cat.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {cat.parent === 0 ? 'رئيسي' : categories.find(c => c.id === cat.parent)?.name || cat.parent}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate">
                          {cat.description || 'لا يوجد وصف'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => { setEditingItem(cat); setIsModalOpen(true); }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(cat.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'banners' && (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">البنر</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">العنوان</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الترتيب</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الحالة</th>
                      <th className="px-6 py-4 font-bold text-slate-700 text-sm">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {banners.map(banner => (
                      <tr key={banner.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="w-20 h-10 rounded-lg bg-slate-100 overflow-hidden">
                            <img src={banner.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">{banner.title || 'بدون عنوان'}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{banner.subtitle}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{banner.order}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            banner.active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {banner.active ? 'نشط' : 'متوقف'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => { setEditingItem(banner); setIsModalOpen(true); }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(banner.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === 'settings' && (
                <div className="p-8 space-y-12">
                  {/* Payment Gateways */}
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <ShoppingCart size={20} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">طرق الدفع</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {paymentGateways.map(gateway => (
                        <div key={gateway.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-900 mb-1">{gateway.title}</div>
                              <div className="text-xs text-slate-500">{gateway.description}</div>
                            </div>
                            <button 
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  await fetch(`/api/payment-gateways/${gateway.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ enabled: !gateway.enabled })
                                  });
                                  fetchSettings();
                                  setSuccess('تم تحديث طريقة الدفع');
                                  setTimeout(() => setSuccess(null), 3000);
                                } catch (err: any) {
                                  setError(err.message);
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className={`w-12 h-6 rounded-full transition-all relative ${gateway.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${gateway.enabled ? 'left-1' : 'left-7'}`}></div>
                            </button>
                          </div>
                          
                          {gateway.id === 'bacs' && (
                            <div className="pt-4 border-t border-slate-200">
                              <button 
                                onClick={() => {
                                  setEditingItem({
                                    type: 'bacs_settings',
                                    gatewayId: gateway.id,
                                    accounts: gateway.settings?.account_details?.value || []
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                              >
                                <Edit size={14} />
                                تعديل بيانات الحسابات البنكية
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Shipping Methods */}
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <Package size={20} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">تكاليف الشحن</h3>
                    </div>
                    <div className="space-y-8">
                      {shippingZones.map(zone => (
                        <div key={zone.id} className="space-y-4">
                          <div className="font-bold text-slate-700 border-b border-slate-100 pb-2">{zone.name}</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {shippingMethods[zone.id]?.map(method => (
                              <div key={method.instance_id} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="font-bold text-slate-900">{method.title}</div>
                                  <button 
                                    onClick={async () => {
                                      setLoading(true);
                                      try {
                                        await fetch(`/api/shipping-zones/${zone.id}/methods/${method.instance_id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ enabled: !method.enabled })
                                        });
                                        fetchSettings();
                                        setSuccess('تم تحديث طريقة الشحن');
                                        setTimeout(() => setSuccess(null), 3000);
                                      } catch (err: any) {
                                        setError(err.message);
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    className={`w-12 h-6 rounded-full transition-all relative ${method.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                                  >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${method.enabled ? 'left-1' : 'left-7'}`}></div>
                                  </button>
                                </div>
                                {(method.method_id === 'flat_rate' || method.method_id === 'free_shipping') && (
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500">
                                      {method.method_id === 'flat_rate' ? 'تكلفة الشحن' : 'الحد الأدنى للطلب'}
                                    </label>
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" 
                                        defaultValue={method.settings?.cost?.value || method.settings?.min_amount?.value || '0'}
                                        onBlur={async (e) => {
                                          const val = e.target.value;
                                          setLoading(true);
                                          try {
                                            const settings: any = {};
                                            if (method.method_id === 'flat_rate') settings.cost = val;
                                            else settings.min_amount = val;

                                            await fetch(`/api/shipping-zones/${zone.id}/methods/${method.instance_id}`, {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ settings })
                                            });
                                            fetchSettings();
                                            setSuccess('تم تحديث التكلفة');
                                            setTimeout(() => setSuccess(null), 3000);
                                          } catch (err: any) {
                                            setError(err.message);
                                          } finally {
                                            setLoading(false);
                                          }
                                        }}
                                        className="flex-grow px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="flex items-center text-xs text-slate-400">ر.س</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
              {activeTab === 'google' && (
                <GoogleIntegrationTab products={products} />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Edit/Add Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingItem?.id ? 'تعديل' : 'إضافة'} {
                    activeTab === 'products' ? 'منتج' : 
                    activeTab === 'categories' ? 'تصنيف' : 'بنر'
                  }
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {editingItem?.type === 'bacs_settings' ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">الحسابات البنكية</h3>
                      <button 
                        type="button"
                        onClick={() => {
                          const newAccounts = [...(editingItem.accounts || []), {
                            account_name: '',
                            account_number: '',
                            bank_name: '',
                            sort_code: '',
                            iban: '',
                            bic: ''
                          }];
                          setEditingItem({ ...editingItem, accounts: newAccounts });
                        }}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      {editingItem.accounts?.map((account: any, idx: number) => (
                        <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative space-y-4">
                          <button 
                            type="button"
                            onClick={() => {
                              const newAccounts = editingItem.accounts.filter((_: any, i: number) => i !== idx);
                              setEditingItem({ ...editingItem, accounts: newAccounts });
                            }}
                            className="absolute top-4 left-4 text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">اسم الحساب</label>
                              <input 
                                type="text"
                                value={account.account_name}
                                onChange={(e) => {
                                  const newAccounts = [...editingItem.accounts];
                                  newAccounts[idx].account_name = e.target.value;
                                  setEditingItem({ ...editingItem, accounts: newAccounts });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">اسم البنك</label>
                              <input 
                                type="text"
                                value={account.bank_name}
                                onChange={(e) => {
                                  const newAccounts = [...editingItem.accounts];
                                  newAccounts[idx].bank_name = e.target.value;
                                  setEditingItem({ ...editingItem, accounts: newAccounts });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">رقم الحساب</label>
                              <input 
                                type="text"
                                value={account.account_number}
                                onChange={(e) => {
                                  const newAccounts = [...editingItem.accounts];
                                  newAccounts[idx].account_number = e.target.value;
                                  setEditingItem({ ...editingItem, accounts: newAccounts });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">IBAN</label>
                              <input 
                                type="text"
                                value={account.iban}
                                onChange={(e) => {
                                  const newAccounts = [...editingItem.accounts];
                                  newAccounts[idx].iban = e.target.value;
                                  setEditingItem({ ...editingItem, accounts: newAccounts });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {(!editingItem.accounts || editingItem.accounts.length === 0) && (
                        <div className="text-center py-10 text-slate-400 text-sm">
                          لا توجد حسابات بنكية مضافة
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {activeTab !== 'banners' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الاسم</label>
                    <input 
                      type="text" 
                      required
                      value={editingItem?.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                )}

                {activeTab === 'banners' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">صورة البنر</label>
                      <div className="flex gap-4 items-start">
                        <div className="flex-grow space-y-2">
                          <input 
                            type="url" 
                            required
                            value={editingItem?.imageUrl || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="رابط الصورة (URL)"
                          />
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2">
                              <Plus size={14} />
                              {uploading ? 'جاري التحميل...' : 'رفع صورة من الجهاز'}
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'banner')}
                                disabled={uploading}
                              />
                            </label>
                          </div>
                        </div>
                        {editingItem?.imageUrl && (
                          <div className="w-32 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={editingItem.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">العنوان الرئيسي</label>
                        <input 
                          type="text" 
                          value={editingItem?.title || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">العنوان الفرعي</label>
                        <input 
                          type="text" 
                          value={editingItem?.subtitle || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, subtitle: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2 col-span-2">
                        <label className="text-sm font-bold text-slate-700">رابط التوجيه (اختياري)</label>
                        <input 
                          type="url" 
                          value={editingItem?.link || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">الترتيب</label>
                        <input 
                          type="number" 
                          required
                          value={editingItem?.order || 0}
                          onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        id="banner_active"
                        checked={editingItem?.active || false}
                        onChange={(e) => setEditingItem({ ...editingItem, active: e.target.checked })}
                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="banner_active" className="text-sm font-bold text-slate-700 cursor-pointer">تفعيل البنر</label>
                    </div>
                  </>
                )}

                {activeTab === 'products' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">نوع المنتج</label>
                        <select 
                          value={editingItem?.type || 'simple'}
                          onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="simple">منتج بسيط (Simple)</option>
                          <option value="variable">منتج متعدد الخيارات (Variable)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">الحالة</label>
                        <select 
                          value={editingItem?.status || 'publish'}
                          onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="publish">منشور</option>
                          <option value="draft">مسودة</option>
                          <option value="private">خاص</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">ظهور المنتج</label>
                        <select 
                          value={editingItem?.catalog_visibility || 'visible'}
                          onChange={(e) => setEditingItem({ ...editingItem, catalog_visibility: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="visible">مرئي للجميع (Visible)</option>
                          <option value="hidden">مخفي عن العملاء (Hidden)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">السعر الافتراضي</label>
                        <input 
                          type="text" 
                          required
                          value={editingItem?.regular_price || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, regular_price: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">سعر التخفيض</label>
                        <input 
                          type="text" 
                          value={editingItem?.sale_price || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, sale_price: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">حالة المخزون</label>
                        <select 
                          value={editingItem?.stock_status || 'instock'}
                          onChange={(e) => setEditingItem({ ...editingItem, stock_status: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                          <option value="instock">متوفر (In stock)</option>
                          <option value="outofstock">نفذ من المخزون (Out of stock)</option>
                          <option value="onbackorder">طلب مسبق (On backorder)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">إدارة المخزون</label>
                        <div className="flex items-center gap-2 h-full">
                          <input 
                            type="checkbox"
                            id="manage_stock"
                            checked={editingItem?.manage_stock || false}
                            onChange={(e) => setEditingItem({ ...editingItem, manage_stock: e.target.checked })}
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="manage_stock" className="text-sm text-slate-600 cursor-pointer">تفعيل إدارة المخزون</label>
                        </div>
                      </div>
                    </div>

                    {editingItem?.manage_stock && (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">كمية المخزون</label>
                        <input 
                          type="number" 
                          value={editingItem?.stock_quantity || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, stock_quantity: parseInt(e.target.value) || 0 })}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">التصنيفات</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-slate-50 rounded-xl max-h-40 overflow-y-auto">
                        {categories.map(cat => (
                          <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
                            <input 
                              type="checkbox"
                              checked={editingItem?.categories?.some((c: any) => c.id === cat.id)}
                              onChange={(e) => {
                                const currentCats = editingItem?.categories || [];
                                if (e.target.checked) {
                                  setEditingItem({ ...editingItem, categories: [...currentCats, { id: cat.id }] });
                                } else {
                                  setEditingItem({ ...editingItem, categories: currentCats.filter((c: any) => c.id !== cat.id) });
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            {cat.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700">صور المنتج</label>
                        <button 
                          type="button"
                          onClick={() => setEditingItem({ ...editingItem, images: [...(editingItem.images || []), { src: '' }] })}
                          className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"
                        >
                          <Plus size={14} /> إضافة صورة
                        </button>
                      </div>
                      <div className="space-y-4">
                        {editingItem?.images?.map((img: any, index: number) => (
                          <div key={index} className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex gap-2">
                              <input 
                                type="url" 
                                placeholder="رابط الصورة (URL)"
                                value={img.src}
                                onChange={(e) => {
                                  const newImages = [...editingItem.images];
                                  newImages[index] = { src: e.target.value };
                                  setEditingItem({ ...editingItem, images: newImages });
                                }}
                                className="flex-grow px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                              {editingItem.images.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newImages = editingItem.images.filter((_: any, i: number) => i !== index);
                                    setEditingItem({ ...editingItem, images: newImages });
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1">
                                <Plus size={12} />
                                {uploading ? 'جاري التحميل...' : 'رفع صورة'}
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(e, 'product', index)}
                                  disabled={uploading}
                                />
                              </label>
                              {img.src && (
                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200">
                                  <img src={img.src} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'categories' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">التصنيف الأب</label>
                      <select 
                        value={editingItem?.parent || 0}
                        onChange={(e) => setEditingItem({ ...editingItem, parent: parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value={0}>بدون (تصنيف رئيسي)</option>
                        {categories.filter(c => c.id !== editingItem?.id).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">صورة التصنيف</label>
                      <div className="flex gap-4 items-start">
                        <div className="flex-grow space-y-2">
                          <input 
                            type="url" 
                            value={editingItem?.image?.src || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, image: { src: e.target.value } })}
                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="رابط الصورة (URL)"
                          />
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2">
                              <Plus size={14} />
                              {uploading ? 'جاري التحميل...' : 'رفع صورة من الجهاز'}
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'category')}
                                disabled={uploading}
                              />
                            </label>
                          </div>
                        </div>
                        {editingItem?.image?.src && (
                          <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={editingItem.image.src} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">الوصف</label>
                  <textarea 
                    rows={4}
                    value={editingItem?.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </>
            )}

            <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-grow py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    حفظ التغييرات
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 md:p-8 my-8 relative text-right"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingBag className="text-[#00b5ad]" />
                    <span>تفاصيل الطلب <span className="text-[#00b5ad]">#{selectedOrder.id}</span></span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 justify-end">
                    <span>{selectedOrder.date_created ? new Date(selectedOrder.date_created).toLocaleString('ar-SA') : ''}</span>
                    <Calendar size={13} className="opacity-70" />
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Grid Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* Right Column: Customer Info & Delivery Address */}
                <div className="space-y-6">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 text-right">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200/60 pb-2 text-base">
                      <User size={18} className="text-[#00b5ad]" />
                      <span>بيانات العميل</span>
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">الاسم الكامل:</span>
                        <span className="font-semibold text-slate-900">{selectedOrder.billing?.first_name || ''} {selectedOrder.billing?.last_name || ''}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">رقم الجوال:</span>
                        <span className="font-semibold text-slate-900 flex items-center gap-1" dir="ltr">
                          <span>{selectedOrder.billing?.phone || ''}</span>
                          <Phone size={13} className="text-slate-400" />
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">البريد الإلكتروني:</span>
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <span>{selectedOrder.billing?.email || ''}</span>
                          <Mail size={13} className="text-slate-400" />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 text-right">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200/60 pb-2 text-base">
                      <MapPin size={18} className="text-[#00b5ad]" />
                      <span>عنوان التوصيل والشحن</span>
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-start">
                        <span className="text-slate-500 min-w-[70px]">المدينة:</span>
                        <span className="font-semibold text-slate-900">{selectedOrder.billing?.city || 'غير محدد'}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-slate-500 min-w-[70px]">العنوان بالتفصيل:</span>
                        <span className="font-medium text-slate-800 text-right bg-white p-2 rounded-lg border border-slate-250 flex-grow mr-4">
                          {selectedOrder.billing?.address_1 || 'لا يوجد عنوان مسجل'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Note */}
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-2 text-right">
                    <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <FileText size={14} />
                      <span>ملاحظات العميل على الطلب:</span>
                    </h4>
                    <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-100 italic">
                      {selectedOrder.customer_note || 'لا توجد ملاحظات خاصة من العميل.'}
                    </p>
                  </div>
                </div>

                {/* Left Column: Products purchased, Shipping costs, payments */}
                <div className="space-y-6">
                  {/* Items list */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 text-right">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200/60 pb-2 text-base">
                      <Package size={18} className="text-[#00b5ad]" />
                      <span>المنتجات المطلوبة</span>
                    </h3>
                    
                    <div className="divide-y divide-slate-200/60 max-h-[350px] overflow-y-auto pr-1">
                      {selectedOrder.line_items?.map((item, idx) => {
                        const matchedProduct = products.find(p => String(p.id) === String(item.product_id || item.id));
                        const name = item.name || matchedProduct?.name || 'منتج غير معروف';
                        const price = item.price || matchedProduct?.price || '0';
                        const totalLine = item.total || (parseFloat(price) * (item.quantity || 1)).toString();
                        const imageUrl = item.image || getProductImageUrl(matchedProduct) || '';
                        const itemAttrs = getLineItemAttributes(item);
                        return (
                          <div key={idx} className="py-3 flex justify-between items-center gap-4">
                            <div className="flex gap-3 items-center text-right font-sans">
                              {/* Product Thumbnail */}
                              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200/60 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {imageUrl ? (
                                  <img 
                                    src={imageUrl} 
                                    alt={name} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Package className="text-slate-300" size={24} />
                                )}
                              </div>
                              
                              <div>
                                <p className="font-semibold text-slate-900 text-sm leading-relaxed">{name}</p>
                                
                                {/* Selected Product Attributes */}
                                {itemAttrs && itemAttrs.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {itemAttrs.map((attr, mIdx) => (
                                      <span key={mIdx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[11px] font-medium border border-teal-100/50 font-sans">
                                        <span className="opacity-85">{attr.key}:</span>
                                        <strong>{attr.value}</strong>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  (item.product_id || item.id) && (
                                    <p className="text-xs text-slate-400 mt-1">معرّف المنتج: #{item.product_id || item.id}</p>
                                  )
                                )}
                              </div>
                            </div>
                            
                            <div className="text-left font-bold text-slate-800 text-sm shrink-0 font-mono">
                              <span>{totalLine} SAR</span>
                              <span className="text-xs text-slate-500 font-normal mr-2 block text-right font-sans">الكمية: {item.quantity || 1}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Financial details summary */}
                    <div className="border-t border-slate-200 pt-3 mt-2 space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">طريقة الدفع:</span>
                        <span className="font-bold text-slate-800 px-2 py-0.5 bg-slate-200/60 text-slate-800 rounded text-xs">
                          {selectedOrder.payment_method_title || selectedOrder.payment_method || 'غير محدد'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-base pt-2 border-t border-dashed border-slate-200">
                        <span className="font-bold text-slate-800">المجموع الإجمالي:</span>
                        <span className="font-black text-[#00b5ad] text-lg">{selectedOrder.total || 0} {selectedOrder.currency || 'SAR'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment attachment (if bank transfer) */}
                  {selectedOrder.meta_data?.find(m => m.key === '_bank_transfer_proof')?.value && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3 text-right">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <FileText size={16} className="text-[#00b5ad]" />
                        <span>إيصال تحويل الحوالة البنكية مسبق الدفع</span>
                      </h3>
                      <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-white max-h-[220px]">
                        <img 
                          src={selectedOrder.meta_data.find(m => m.key === '_bank_transfer_proof')?.value} 
                          alt="إثبات الدفع" 
                          className="w-full h-auto object-contain max-h-[180px] scale-100 group-hover:scale-105 transition-all cursor-zoom-in"
                          onClick={() => {
                            const val = selectedOrder.meta_data?.find(m => m.key === '_bank_transfer_proof')?.value;
                            if (val) window.open(val, '_blank');
                          }}
                          referrerPolicy="no-referrer"
                        />
                        <div className="p-2 text-center border-t border-slate-100 bg-slate-50 text-xs font-semibold text-blue-600">
                          <a 
                            href={selectedOrder.meta_data.find(m => m.key === '_bank_transfer_proof')?.value} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center justify-center gap-1"
                          >
                            <span>فتح الإيصال في نافذة جديدة</span>
                            <Eye size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Row Inside Modal */}
                  <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-right">
                    <span className="font-semibold text-slate-700">تحديث حالة هذا الطلب:</span>
                    <select 
                      onChange={(e) => {
                        handleStatusUpdate(selectedOrder.id, e.target.value);
                        setSelectedOrder(prev => prev ? { ...prev, status: e.target.value } : null);
                      }}
                      value={selectedOrder.status || 'pending'}
                      className="text-xs border-slate-300 rounded-lg focus:ring-blue-500 py-1.5 px-3 bg-white w-full sm:w-auto font-medium text-right"
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="processing">قيد التنفيذ</option>
                      <option value="completed">مكتمل</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="flex justify-end pt-5 mt-6 border-t border-slate-200">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
