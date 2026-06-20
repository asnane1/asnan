import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Package, 
  Calendar, 
  CreditCard, 
  ChevronDown, 
  ChevronUp, 
  ArrowLeft, 
  Lock, 
  LogIn, 
  UserPlus, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Truck,
  FileText
} from 'lucide-react';
import { auth, db, googleProvider, signInWithPopup } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';

interface Product {
  id: number;
  name: string;
  price: string;
  image?: string;
  images?: string[];
  attributes?: any[];
}

interface Order {
  id: number;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  payment_method_title?: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
  };
  line_items: Array<{
    product_id: number;
    name: string;
    price: string;
    quantity: number;
    total: string;
    image?: string;
    meta_data?: Array<{ key: string, value: any }>;
  }>;
  customer_note?: string;
  shipping_lines?: Array<{
    method_title: string;
    total: string;
  }>;
}

interface MyAccountProps {
  onBack: () => void;
  user: any;
  onLoginSuccess: () => void;
}

export default function MyAccount({ onBack, user, onLoginSuccess }: MyAccountProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
  const [loginMode, setLoginMode] = useState<'login' | 'register' | 'track'>('login');
  
  // Login / Register fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Track fields (unauthenticated tracking)
  const [trackEmail, setTrackEmail] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackedOrders, setTrackedOrders] = useState<Order[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [searchedTrack, setSearchedTrack] = useState(false);

  // Authenticated Profile State
  const [profileData, setProfileData] = useState({
    displayName: '',
    phone: '',
    address: '',
    city: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Orders State (Authenticated)
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  // Normalization Helpers
  const normalizeEmail = (val: string) => val.trim().toLowerCase();
  const normalizePhone = (val: string) => val.replace(/[\s\-\+\(\)]/g, '');

  // Fetch logged-in user profile details from Firestore
  useEffect(() => {
    if (user) {
      setProfileLoading(true);
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfileData({
              displayName: data.displayName || user.displayName || '',
              phone: data.phone || '',
              address: data.address || '',
              city: data.city || ''
            });
          } else {
            setProfileData({
              displayName: user.displayName || '',
              phone: '',
              address: '',
              city: ''
            });
          }
        })
        .catch((err) => console.error("Error reading profile:", err))
        .finally(() => setProfileLoading(false));

      // Load orders for authenticated email
      fetchAuthenticatedOrders(user.email);
    }
  }, [user]);

  const fetchAuthenticatedOrders = async (userEmail: string) => {
    if (!userEmail) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(normalizeEmail(userEmail))}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileLoading(true);
    setProfileMessage(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: profileData.displayName,
        phone: profileData.phone,
        address: profileData.address,
        city: profileData.city,
        role: user.email === 'noorsori@gmail.com' ? 'admin' : 'customer'
      }, { merge: true });

      await updateProfile(auth.currentUser!, {
        displayName: profileData.displayName
      });

      setProfileMessage('تم حفظ بيانات الملف الشخصي بنجاح!');
      setTimeout(() => setProfileMessage(null), 4000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setProfileMessage('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة لاحقاً');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (loginMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        // Auto-save registration document in users
        const userRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: displayName,
          role: userCredential.user.email === 'noorsori@gmail.com' ? 'admin' : 'customer',
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error("Auth Error:", err);
      let message = 'حدث خطأ ما، يرجى المحاولة مرة أخرى';
      if (err.code === 'auth/email-already-in-use') message = 'البريد الإلكتروني مستخدم بالفعل';
      if (err.code === 'auth/invalid-email') message = 'البريد الإلكتروني غير صالح';
      if (err.code === 'auth/weak-password') message = 'كلمة المرور ضعيفة جداً';
      if (err.code === 'auth/operation-not-allowed') {
        message = 'تنبيه لمدير الموقع: طريقة تسجيل الدخول عبر (البريد وكلمة المرور) غير مفعلة في لوحة تحكم Firebase الحالية. لحل هذا الخطأ وتفعيلها: يرجى الذهاب إلى Firebase Console > Authentication > Build > Sign-in method وثم تفعيل خيار (Email/Password). في الوقت الحالي، يمكنك استخدام زر "تسجيل الدخول السريع بـ Google" بالأسفل حيث أنه يعمل بشكل كامل وفوري!';
      }
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      }
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onLoginSuccess();
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setAuthError('فشل تسجيل الدخول باستخدام Google، يرجى المحاولة لاحقاً.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTrackOnlySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackLoading(true);
    setTrackError(null);
    setSearchedTrack(false);

    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(normalizeEmail(trackEmail))}`);
      if (res.ok) {
        const data: Order[] = await res.json();
        const inputPhoneNorm = normalizePhone(trackPhone);
        
        // Filter orders by phone match to make track secure
        const matched = data.filter(order => {
          const orderPhoneNorm = normalizePhone(order.billing?.phone || '');
          return orderPhoneNorm.includes(inputPhoneNorm) || inputPhoneNorm.includes(orderPhoneNorm);
        });

        setTrackedOrders(matched);
        setSearchedTrack(true);
        if (matched.length === 0) {
          setTrackError('لم نعثر على أي طلبات مطابقة لهذا البريد والهاتف.');
        }
      } else {
        setTrackError('فشل جلب الطلبات، يرجى التحقق من المدخلات.');
      }
    } catch (err) {
      console.error(err);
      setTrackError('حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً.');
    } finally {
      setTrackLoading(false);
    }
  };

  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId);
  };

  const getStatusLabelAndColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: 'في انتظار المراجعة', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'processing':
        return { text: 'قيد التجهيز', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'completed':
        return { text: 'مكتمل بنجاح', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'cancelled':
        return { text: 'ملغي', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { text: status || 'جاري المعالجة', bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-right" dir="rtl">
      {/* Header Back button */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-[#00b5ad] transition-colors font-semibold"
        >
          <ArrowLeft size={20} className="scale-x-[-1]" />
          العودة للتسوق
        </button>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <UserIcon className="text-[#00b5ad]" size={26} />
          {user ? 'حسابي والطلبات' : 'تتبع حالة طلبك وحسابك'}
        </h1>
      </div>

      {!user ? (
        /* Guest / Authentication Forms */
        <div className="grid md:grid-cols-12 gap-8 items-start">
          
          {/* Welcome and Instructions side */}
          <div className="md:col-span-5 bg-gradient-to-br from-teal-500/10 to-teal-100/10 rounded-3xl p-6 border border-teal-500/20 text-slate-700 leading-relaxed font-sans">
            <h3 className="text-lg font-bold text-slate-900 mb-3">حساب تلقائي لجميع المشترين</h3>
            <p className="text-sm mb-4">
              نحن في <strong>مسبار الاسنان</strong> نسعى لتقديم تجربة تسوق سلسة خالية من التعقيد.
            </p>
            <ul className="text-xs space-y-3 mr-4 list-disc text-slate-600">
              <li>يتم ربط جميع طلباتك تلقائياً ببريدك الإلكتروني المستخدم أثناء الدفع.</li>
              <li>يمكنك تتبع حالة أي طلب حالي أو سابق فوراً بمجرد كتابة بريدك الإلكتروني وهاتفك هنا.</li>
              <li>للوصول الكامل للملف الشخصي، حفظ العناوين وتسريع المشتريات القادمة، يمكنك إنشاء حساب بنفس البريد وتعيين كلمة مرور.</li>
            </ul>

            <div className="mt-6 flex flex-col gap-2">
              <button 
                onClick={() => setLoginMode('track')}
                className={`py-3 px-4 rounded-xl text-center text-sm font-bold transition-all border ${loginMode === 'track' ? 'bg-[#00b5ad] text-white border-transparent shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                تتبع سريع بالبريد والهاتف
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { setLoginMode('login'); setAuthError(null); }}
                  className={`py-2 px-3 rounded-lg text-center text-xs font-bold transition-all border ${loginMode === 'login' ? 'bg-slate-900 text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  تسجيل الدخول
                </button>
                <button 
                  onClick={() => { setLoginMode('register'); setAuthError(null); }}
                  className={`py-2 px-3 rounded-lg text-center text-xs font-bold transition-all border ${loginMode === 'register' ? 'bg-slate-900 text-white border-transparent' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  إنشاء حساب جديد
                </button>
              </div>
            </div>
          </div>

          {/* Form container */}
          <div className="md:col-span-7 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <AnimatePresence mode="wait">
              {loginMode === 'track' ? (
                /* Fast Track Orders without Account login */
                <motion.div
                  key="track"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-2">تتبع سريع لطلباتك</h3>
                  <p className="text-slate-500 text-sm mb-6 font-sans">أدخل البريد الإلكتروني الذي استخدمته لتسجيل الطلب برفق متبوعاً برقم هاتفك لفلترة وعرض الطلبات.</p>

                  <form onSubmit={handleTrackOnlySubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-700 mr-1">البريد الإلكتروني للطلب</label>
                      <div className="relative">
                        <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="email"
                          required
                          placeholder="example@mail.com"
                          className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all font-sans"
                          value={trackEmail}
                          onChange={(e) => setTrackEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-700 mr-1">رقم الجوال المسجل بالطلب</label>
                      <div className="relative font-sans">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          required
                          placeholder="05xxxxxxx"
                          className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all text-right"
                          value={trackPhone}
                          onChange={(e) => setTrackPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    {trackError && (
                      <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3 text-sm font-sans">
                        <AlertCircle size={18} />
                        {trackError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={trackLoading}
                      className="w-full py-3.5 bg-[#00b5ad] hover:bg-[#008d87] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#00b5ad]/20 flex items-center justify-center gap-2"
                    >
                      {trackLoading ? <Loader2 className="animate-spin" size={18} /> : 'عرض الطلبات والتحقق من الحالة'}
                    </button>
                  </form>

                  {/* Render Quick Tracked Orders */}
                  {searchedTrack && trackedOrders.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-slate-200 space-y-4">
                      <h4 className="font-bold text-slate-900 border-r-4 border-[#00b5ad] pr-2.5 mb-4">الطلبات المسجلة ببريدك ({trackedOrders.length})</h4>
                      {trackedOrders.map((order) => {
                        const statusObj = getStatusLabelAndColor(order.status);
                        const isExpanded = expandedOrder === order.id;

                        return (
                          <div key={order.id} className="border border-slate-100 rounded-2xl bg-slate-50 overflow-hidden shadow-sm">
                            <div 
                              onClick={() => toggleOrderExpand(order.id)}
                              className="p-4 flex flex-wrap justify-between items-center gap-4 cursor-pointer hover:bg-slate-100/50 transition-colors"
                            >
                              <div className="flex gap-4 items-center">
                                <div className="p-2.5 bg-white/80 rounded-xl text-slate-600 border border-slate-100">
                                  <Package size={20} />
                                </div>
                                <div className="text-right font-sans">
                                  <p className="text-sm font-bold text-slate-900">طلب رقم #{order.id}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">{new Date(order.date_created).toLocaleDateString('ar-SA')}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusObj.bg}`}>
                                  {statusObj.text}
                                </span>
                                {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-4 bg-white border-t border-slate-100 space-y-3 font-sans">
                                <div className="divide-y divide-slate-100">
                                  {order.line_items?.map((item, idx) => (
                                    <div key={idx} className="py-2.5 flex justify-between gap-4 items-center">
                                      <div className="flex gap-3 items-center">
                                        {item.image ? (
                                          <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-md" />
                                        ) : (
                                          <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-400"><FileText size={18} /></div>
                                        )}
                                        <div className="text-right">
                                          <p className="text-xs font-bold text-slate-800">{item.name}</p>
                                          {item.meta_data && item.meta_data.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {item.meta_data.map((attr, aIdx) => (
                                                <span key={aIdx} className="text-[10px] text-teal-600 bg-teal-50/50 border border-teal-100/50 px-1 py-0.2 rounded font-sans leading-none">
                                                  {attr.key}: <strong>{attr.value}</strong>
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-left">
                                        <p className="text-xs font-bold text-slate-900">{parseFloat(item.price).toLocaleString()} ر.س</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">الكمية: {item.quantity}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-bold bg-[#00b5ad]/5 p-3 rounded-xl">
                                  <span className="text-slate-700">الإجمالي الشامل (ريال سعودي)</span>
                                  <span className="text-[#00b5ad] text-lg">{parseFloat(order.total).toLocaleString()} ر.س</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ) : (
                /* Login / Register via Auth email */
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {loginMode === 'register' ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
                  </h3>
                  <p className="text-slate-500 text-sm mb-6 font-sans">
                    {loginMode === 'register' 
                      ? 'قم بمزامنة جميع مشترياتك وصلاحيات الدخول بإنشاء حسابك اليوم.' 
                      : 'مرحباً بك مجدداً في ملفك وتتبع مشترياتك السابقة.'}
                  </p>

                  <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                    {loginMode === 'register' && (
                      <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 mr-1">الاسم الكامل</label>
                        <div className="relative">
                          <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input
                            type="text"
                            required
                            placeholder="العشاري للتجارة"
                            className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-700 mr-1">البريد الإلكتروني</label>
                      <div className="relative">
                        <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="email"
                          required
                          placeholder="example@mail.com"
                          className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all font-sans"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-700 mr-1">كلمة المرور</label>
                      <div className="relative font-sans">
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    {authError && (
                      <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3 text-sm font-sans">
                        <AlertCircle size={18} />
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {authLoading ? <Loader2 className="animate-spin" size={18} /> : (loginMode === 'register' ? 'تأكيد إنشاء الحساب' : 'دخول')}
                    </button>

                    <div className="relative flex py-3 items-center">
                      <div className="flex-grow border-t border-slate-100"></div>
                      <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold">أو باستخدام حساب Google الخاص بك</span>
                      <div className="flex-grow border-t border-slate-100"></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                      className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 shadow-sm flex items-center justify-center gap-3 font-sans"
                    >
                      {authLoading ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>
                          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          <span>تسجيل الدخول السريع بـ Google</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* Authenticated user interface */
        <div className="space-y-6">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
            >
              طلباتي ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
            >
              بيانات الحساب والملف الشخصي
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'orders' ? (
              /* ORDERS CONTENT */
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {ordersLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-[#00b5ad]" size={40} />
                    <p className="text-slate-500 font-sans">جاري جلب الطلبات الخاصة بحسابك...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50 p-6 leading-relaxed font-sans text-slate-500">
                    <Package className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="font-bold text-slate-700">لم تقم بتسجيل أي طلبات بعد</p>
                    <p className="text-xs mt-1 text-slate-400">جميع مشترياتك تظهر هنا لمتابعة تقدمها وحالتها تلقائياً.</p>
                  </div>
                ) : (
                  orders.map((order) => {
                    const statusObj = getStatusLabelAndColor(order.status);
                    const isExpanded = expandedOrder === order.id;

                    return (
                      <div key={order.id} className="border border-slate-200 rounded-3xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div 
                          onClick={() => toggleOrderExpand(order.id)}
                          className="p-5 flex flex-wrap justify-between items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex gap-4 items-center">
                            <div className="p-3 bg-teal-50 text-[#00b5ad] rounded-2xl border border-teal-100">
                              <Package size={22} />
                            </div>
                            <div className="text-right">
                              <p className="text-base font-bold text-slate-900">طلب رقم #{order.id}</p>
                              <p className="text-xs text-slate-400 mt-1 font-sans">{new Date(order.date_created).toLocaleString('ar-SA')}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-left ml-2">
                              <p className="text-sm font-bold text-slate-900">{parseFloat(order.total).toLocaleString()} ر.س</p>
                              <p className="text-[10px] text-slate-400 font-sans">{order.line_items?.reduce((c, i) => c + i.quantity, 0) || 0} منتجات</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusObj.bg}`}>
                              {statusObj.text}
                            </span>
                            {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                            
                            {/* Deliver / Shipping details in the order */}
                            <div className="grid md:grid-cols-2 gap-4 pb-4 border-b border-slate-200/60 text-sm">
                              <div className="space-y-1.5">
                                <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <Truck size={16} className="text-slate-600" />
                                  تفاصيل المستلم والتوصيل
                                </h5>
                                <p className="text-slate-600 text-xs font-sans">الاسم: {order.billing?.first_name} {order.billing?.last_name}</p>
                                <p className="text-slate-600 text-xs font-sans">الجوال: {order.billing?.phone}</p>
                                <p className="text-slate-600 text-xs">العنوان: {order.billing?.address_1}، {order.billing?.city}</p>
                              </div>
                              <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-slate-100">
                                <h5 className="font-bold text-slate-900 text-xs">طريقة وطبيعة الدفع:</h5>
                                <p className="text-slate-600 text-xs">{order.payment_method_title || 'تحويل بنكي مباشر'}</p>
                                {order.customer_note && (
                                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-xl mt-1 leading-relaxed">
                                    <strong>ملاحظة العميل:</strong> {order.customer_note}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Line items list */}
                            <div className="divide-y divide-slate-100 bg-white p-4 rounded-3xl border border-slate-100">
                              <h5 className="font-bold text-slate-800 text-xs pb-2 border-b border-slate-100 mb-2">مكونات الشحنة:</h5>
                              {order.line_items?.map((item, idx) => (
                                <div key={idx} className="py-3 flex justify-between gap-4 items-center">
                                  <div className="flex gap-3 items-center">
                                    {item.image ? (
                                      <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-xl border border-slate-100" />
                                    ) : (
                                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><FileText size={20} /></div>
                                    )}
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                      {item.meta_data && item.meta_data.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                          {item.meta_data.map((attr, aIdx) => (
                                            <span key={aIdx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-100/50 leading-none">
                                              <span>{attr.key}:</span>
                                              <strong>{attr.value}</strong>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-left font-sans">
                                    <p className="text-sm font-bold text-slate-900">{parseFloat(item.price).toLocaleString()} ر.س</p>
                                    <p className="text-xs text-slate-400 mt-1">الكمية: {item.quantity}</p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex justify-between items-center text-sm font-bold bg-[#00b5ad]/10 p-4 rounded-2xl border border-[#00b5ad]/10">
                              <span className="text-slate-800">القيمة الإجمالية للطلب</span>
                              <span className="text-[#00b5ad] text-xl font-bold font-sans">{parseFloat(order.total).toLocaleString()} ر.س</span>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </motion.div>
            ) : (
              /* PROFILE CONTENT */
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm"
              >
                <h3 className="text-xl font-bold text-slate-900 mb-6">بياناتي وعناوين الشحن</h3>
                
                <form onSubmit={handleProfileSave} className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-700 mr-1">الاسم الكامل</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all font-sans"
                        value={profileData.displayName}
                        onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-700 mr-1">رقم الجوال</label>
                      <input
                        type="text"
                        placeholder="05xxxxxxx"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all font-sans text-left"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700 mr-1">المدينة</label>
                    <input
                      type="text"
                      placeholder="الرياض"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all"
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700 mr-1">عنوان التسليم والتوصيل</label>
                    <textarea
                      rows={3}
                      placeholder="اسم الشارع، الحي، المعلم البارز"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00b5ad] outline-none transition-all resize-none leading-relaxed"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    />
                  </div>

                  {profileMessage && (
                    <div className="p-4 bg-teal-50 border border-teal-100 text-teal-700 rounded-xl flex items-center gap-3 text-sm">
                      <CheckCircle size={18} />
                      {profileMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="py-3 px-6 bg-[#00b5ad] hover:bg-[#008d87] text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    {profileLoading ? <Loader2 className="animate-spin" size={18} /> : 'حفظ التعديلات والبيانات'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
