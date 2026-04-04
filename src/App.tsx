import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  Sparkles, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  ChevronLeft,
  Menu,
  X,
  ShoppingCart,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Settings,
  LogIn,
  LogOut,
  User as UserIcon,
  Heart,
  Plus,
  Minus,
  ArrowRight,
  CreditCard,
  ChevronRight
} from 'lucide-react';
import { CATEGORIES } from './constants';
import { Product } from './types';
import AdminDashboard from './components/AdminDashboard';
import Cart from './components/Cart';
import Favorites from './components/Favorites';
import Checkout from './components/Checkout';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User, isAdmin, db } from './firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

interface Banner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  link?: string;
  order: number;
  active: boolean;
}

const ToothIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 2C10 2 8 3 7 5c-1 2-1 4 0 6 0 1 1 2 2 3 1 1 1 2 1 3v2c0 1 1 2 2 2s2-1 2-2v-2c0-1 0-2 1-3 1-1 2-2 2-3 1-2 1-4 0-6-1-2-3-3-5-3Z" />
    <path d="M9 17c0 2 1 3 3 3s3-1 3-3" />
  </svg>
);

const IconMap: Record<string, any> = {
  Tooth: ToothIcon,
  Trash2,
  Sparkles
};

interface WCCategory {
  id: number;
  name: string;
  parent: number;
  slug: string;
  image?: { src: string };
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<WCCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'cart' | 'favorites' | 'checkout'>('home');
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'banners'), 
      where('active', '==', true),
      orderBy('order', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(bannerList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const timer = setInterval(() => {
        setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [banners.length]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const adminStatus = await isAdmin(currentUser.uid);
        setIsUserAdmin(adminStatus);
      } else {
        setIsUserAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdminView(false);
      setCurrentView('home');
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  const toggleFavorite = (product: Product) => {
    setFavorites(prev => {
      const isFavorite = prev.some(p => p.id === product.id);
      if (isFavorite) {
        return prev.filter(p => p.id !== product.id);
      }
      return [...prev, product];
    });
  };

  useEffect(() => {
    async function fetchCategories() {
      try {
        setCategoriesLoading(true);
        const res = await fetch('/api/categories');
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch categories');
        }
        const data = await res.json();
        console.log("Categories received:", data);
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          console.error("Categories data is not an array:", data);
        }
      } catch (err) {
        console.error(err);
        setError(`حدث خطأ أثناء تحميل التصنيفات: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
      } finally {
        setCategoriesLoading(false);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        let url = '/api/products';
        if (selectedChildId) {
          url += `?category=${selectedChildId}`;
        } else if (selectedParentId) {
          // If parent is selected but no child, we might want to show all products in parent
          // WooCommerce API supports this if we pass the parent ID
          url += `?category=${selectedParentId}`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch products');
        }
        const data = await res.json();
        
        const mappedProducts: Product[] = data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          nameEn: item.slug,
          category: item.categories[0]?.id.toString() || 'other',
          description: item.description,
          image: item.images[0]?.src,
          price: item.price,
          permalink: item.permalink
        }));
        
        setProducts(mappedProducts);
      } catch (err) {
        console.error(err);
        setError(`حدث خطأ أثناء تحميل المنتجات: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [selectedParentId, selectedChildId]);

  const parentCategories = useMemo(() => {
    return categories.filter(cat => cat.parent === 0);
  }, [categories]);

  const childCategories = useMemo(() => {
    if (selectedParentId === null) return [];
    return categories.filter(cat => cat.parent === selectedParentId);
  }, [categories, selectedParentId]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           product.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [searchQuery, products]);

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id.toString() === id);
    return cat ? cat.name : 'غير مصنف';
  };

  const handleParentClick = (id: number) => {
    if (selectedParentId === id) {
      setSelectedParentId(null);
      setSelectedChildId(null);
    } else {
      setSelectedParentId(id);
      setSelectedChildId(null);
    }
  };

  const handleChildClick = (id: number) => {
    if (selectedChildId === id) {
      setSelectedChildId(null);
    } else {
      setSelectedChildId(id);
    }
  };

  const ProductModal = ({ product, onClose }: { product: Product, onClose: () => void }) => {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-600 hover:text-blue-600 transition-colors shadow-sm"
          >
            <X size={24} />
          </button>

          <div className="md:w-1/2 h-64 md:h-auto bg-slate-100 relative">
            {product.image ? (
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <ToothIcon size={120} />
              </div>
            )}
          </div>

          <div className="md:w-1/2 p-8 md:p-12 overflow-y-auto text-right">
            <div className="mb-6 flex justify-between items-start">
              <div className="flex-grow">
                <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold mb-3">
                  {getCategoryName(product.category)}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{product.name}</h2>
                <p className="text-xl font-bold text-blue-600">
                  {(product as any).price ? `${(product as any).price} ر.س` : 'اتصل للسعر'}
                </p>
              </div>
              <button 
                onClick={() => toggleFavorite(product)}
                className={`p-3 rounded-xl transition-all ${
                  favorites.some(p => p.id === product.id) 
                    ? 'bg-red-50 text-red-500' 
                    : 'bg-slate-50 text-slate-400 hover:text-red-500'
                }`}
              >
                <Heart size={24} fill={favorites.some(p => p.id === product.id) ? "currentColor" : "none"} />
              </button>
            </div>

            <div className="prose prose-slate prose-sm max-w-none mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-3">وصف المنتج</h3>
              <div 
                className="text-slate-600 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: product.description || 'لا يوجد وصف متاح لهذا المنتج.' }}
              />
            </div>

              <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                <button 
                  onClick={() => {
                    addToCart(product);
                    onClose();
                  }}
                  className="flex-grow py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  إضافة إلى السلة
                </button>
                <a 
                  href={`https://wa.me/966575034090?text=${encodeURIComponent(`السلام عليكم، أرغب في الاستفسار عن منتج: ${product.name}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={20} />
                  واتساب
                </a>
              </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  if (isAdminView) {
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      );
    }
    if (!user || !isUserAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-right" dir="rtl">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">الدخول للوحة التحكم</h2>
            <p className="text-slate-500 mb-8">يجب تسجيل الدخول بحساب مسؤول للوصول إلى هذه الصفحة.</p>
            {!user ? (
              <button 
                onClick={handleLogin}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <LogIn size={20} />
                تسجيل الدخول عبر جوجل
              </button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                  عذراً، حسابك لا يملك صلاحيات المسؤول.
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all"
                >
                  تسجيل الخروج
                </button>
              </div>
            )}
            <button 
              onClick={() => setIsAdminView(false)}
              className="mt-6 text-blue-600 hover:underline font-medium"
            >
              العودة للمتجر
            </button>
          </div>
        </div>
      );
    }
    return <AdminDashboard onBack={() => setIsAdminView(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentView('home')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                  <ToothIcon size={24} />
                </div>
                <span className="text-xl font-bold text-blue-900 hidden sm:block">متجر أسناننا</span>
              </button>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">الرئيسية</a>
              <a href="#products" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">المنتجات</a>
              <a href="#about" className="text-slate-600 hover:text-blue-600 font-medium transition-colors">من نحن</a>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="بحث عن منتج..." 
                  className="pr-10 pl-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 transition-all w-48 lg:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentView('favorites')}
                  className={`p-2 transition-colors relative ${currentView === 'favorites' ? 'text-red-500' : 'text-slate-600 hover:text-red-500'}`}
                >
                  <Heart size={22} fill={currentView === 'favorites' ? "currentColor" : "none"} />
                  {favorites.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {favorites.length}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => setCurrentView('cart')}
                  className={`p-2 transition-colors relative ${currentView === 'cart' ? 'text-blue-600' : 'text-slate-600 hover:text-blue-600'}`}
                >
                  <ShoppingCart size={22} />
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {cart.reduce((acc, item) => acc + item.quantity, 0)}
                    </span>
                  )}
                </button>
              </div>
              
              {authLoading ? (
                <div className="w-8 h-8 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              ) : user ? (
                <div className="flex items-center gap-3">
                  {isUserAdmin && (
                    <button 
                      onClick={() => setIsAdminView(true)}
                      className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                    >
                      <Settings size={16} />
                      لوحة التحكم
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:block text-left">
                      <p className="text-xs font-bold text-slate-900 leading-none">{user.displayName}</p>
                      <button onClick={handleLogout} className="text-[10px] text-red-500 hover:underline">خروج</button>
                    </div>
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200">
                      <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-bold hover:bg-blue-600 hover:text-white transition-all"
                >
                  <LogIn size={16} />
                  دخول
                </button>
              )}

              <button 
                className="md:hidden p-2 text-slate-600"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-slate-200 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                <a href="#" className="block px-3 py-2 text-slate-600 font-medium">الرئيسية</a>
                <a href="#products" className="block px-3 py-2 text-slate-600 font-medium">المنتجات</a>
                <a href="#about" className="block px-3 py-2 text-slate-600 font-medium">من نحن</a>
                
                {isUserAdmin && (
                  <button 
                    onClick={() => {
                      setIsAdminView(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold mt-4"
                  >
                    <Settings size={18} />
                    لوحة التحكم
                  </button>
                )}

                {!user && !authLoading && (
                  <button 
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold mt-2"
                  >
                    <LogIn size={18} />
                    تسجيل الدخول
                  </button>
                )}

                {user && (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={user.photoURL || ''} className="w-10 h-10 rounded-full" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{user.displayName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-red-500">
                      <LogOut size={20} />
                    </button>
                  </div>
                )}
                <div className="pt-4 px-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="بحث عن منتج..." 
                      className="w-full pr-10 pl-4 py-2 bg-slate-100 border-none rounded-lg text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="flex-grow">
        {currentView === 'home' ? (
          <>
            {/* Hero Section / Banner Carousel */}
            <section className="relative bg-blue-900 text-white overflow-hidden min-h-[400px] lg:min-h-[600px] flex items-center">
              <AnimatePresence mode="wait">
                {banners.length > 0 ? (
                  <motion.div
                    key={banners[currentBannerIndex].id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                  >
                    <div className="absolute inset-0 bg-gradient-to-l from-blue-900/90 via-blue-900/40 to-transparent z-10" />
                    <img 
                      src={banners[currentBannerIndex].imageUrl} 
                      alt={banners[currentBannerIndex].title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center relative z-20">
                      <div className="max-w-2xl text-right mr-auto">
                        <motion.h1 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
                        >
                          {banners[currentBannerIndex].title}
                        </motion.h1>
                        <motion.p 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="text-lg text-blue-50 mb-8 leading-relaxed"
                        >
                          {banners[currentBannerIndex].subtitle}
                        </motion.p>
                        {banners[currentBannerIndex].link && (
                          <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                          >
                            <a 
                              href={banners[currentBannerIndex].link} 
                              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/40"
                            >
                              تصفح الآن
                              <ArrowRight size={20} />
                            </a>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center"
                  >
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
                    </div>
                    
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
                      <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <motion.div
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.6 }}
                        >
                          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-right">
                            شريككم الموثوق في <span className="text-blue-400">تجهيزات الأسنان</span> المتقدمة
                          </h1>
                          <p className="text-lg text-blue-100 mb-8 max-w-xl leading-relaxed text-right">
                            نقدم لكم مجموعة واسعة من المنتجات الأساسية والضرورية لمختلف إجراءات الأسنان من علاج العصب إلى التجميل والترميم، بأعلى جودة وأفضل الأسعار.
                          </p>
                          <div className="flex flex-wrap gap-4 justify-end">
                            <a href="#products" className="px-8 py-4 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20">
                              تصفح المنتجات
                            </a>
                            <a href="#contact" className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl backdrop-blur-sm transition-all border border-white/20">
                              تواصل معنا
                            </a>
                          </div>
                        </motion.div>
                        
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.8 }}
                          className="hidden lg:block relative"
                        >
                          <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-8 border-white/10">
                            <img 
                              src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=800" 
                              alt="Dental Equipment" 
                              className="w-full h-auto"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl text-blue-900 z-20">
                            <div className="flex items-center gap-3 mb-1">
                              <CheckCircle2 className="text-green-500" size={20} />
                              <span className="font-bold">جودة مضمونة</span>
                            </div>
                            <p className="text-sm text-slate-500">أفضل الماركات العالمية</p>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Carousel Controls */}
              {banners.length > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-2">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentBannerIndex(idx)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        currentBannerIndex === idx ? 'bg-white w-8' : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Categories Navigation Bar */}
            <div className="bg-white border-b border-slate-200 sticky top-16 z-40 shadow-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Parent Categories Bar */}
                <div className="flex items-center gap-6 overflow-x-auto py-6 no-scrollbar scroll-smooth">
                  {categoriesLoading ? (
                    <div className="flex gap-6">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                          <div className="w-16 h-16 bg-slate-100 animate-pulse rounded-full" />
                          <div className="w-12 h-3 bg-slate-100 animate-pulse rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedParentId(null);
                          setSelectedChildId(null);
                        }}
                        className="flex flex-col items-center gap-2 flex-shrink-0 group"
                      >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border-2 ${
                          selectedParentId === null 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-110' 
                          : 'bg-slate-100 text-slate-400 border-transparent group-hover:bg-blue-50 group-hover:text-blue-500'
                        }`}>
                          <Sparkles size={24} />
                        </div>
                        <span className={`text-xs font-bold transition-colors ${
                          selectedParentId === null ? 'text-blue-600' : 'text-slate-500'
                        }`}>
                          الكل
                        </span>
                      </button>
                      {parentCategories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleParentClick(cat.id)}
                          className="flex flex-col items-center gap-2 flex-shrink-0 group"
                        >
                          <div className={`w-16 h-16 rounded-full overflow-hidden transition-all border-2 ${
                            selectedParentId === cat.id 
                            ? 'border-blue-600 shadow-lg scale-110' 
                            : 'border-transparent group-hover:border-blue-200'
                          }`}>
                            {cat.image ? (
                              <img 
                                src={cat.image.src} 
                                alt={cat.name} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                                <ToothIcon size={24} />
                              </div>
                            )}
                          </div>
                          <span className={`text-xs font-bold transition-colors ${
                            selectedParentId === cat.id ? 'text-blue-600' : 'text-slate-500'
                          }`}>
                            {cat.name}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>

                {/* Child Categories Bar */}
                <AnimatePresence>
                  {selectedParentId !== null && childCategories.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden border-t border-slate-100"
                    >
                      <div className="flex items-center gap-2 overflow-x-auto py-4 no-scrollbar scroll-smooth">
                        {childCategories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => handleChildClick(cat.id)}
                            className={`flex-shrink-0 px-5 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                              selectedChildId === cat.id 
                              ? 'bg-blue-50 text-blue-700 border-blue-600' 
                              : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-100'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Categories & Products */}
            <section id="products" className="py-16 bg-slate-50 min-h-[600px]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">
                    {selectedChildId 
                      ? categories.find(c => c.id === selectedChildId)?.name 
                      : selectedParentId 
                        ? `تصنيفات ${categories.find(c => c.id === selectedParentId)?.name}`
                        : 'كتالوج المنتجات'}
                  </h2>
                  <p className="text-slate-600 max-w-2xl mx-auto">
                    استكشف مجموعتنا الواسعة من المواد والأدوات الطبية المتخصصة مباشرة من متجرنا
                  </p>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-slate-600 font-medium">جاري تحميل المنتجات من المتجر...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 text-red-500 rounded-full mb-4">
                      <X size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{error}</h3>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-4 text-blue-600 hover:underline font-medium"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                ) : (
                  <motion.div 
                    layout
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  >
                    <AnimatePresence mode="popLayout">
                      {filteredProducts.map((product) => (
                        <motion.div
                          key={product.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                          className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-100 group flex flex-col cursor-pointer relative"
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(product);
                            }}
                            className={`absolute top-3 left-3 z-10 p-2 rounded-xl transition-all ${
                              favorites.some(p => p.id === product.id) 
                                ? 'bg-red-50 text-red-500' 
                                : 'bg-white/80 backdrop-blur-md text-slate-400 hover:text-red-500'
                            }`}
                          >
                            <Heart size={18} fill={favorites.some(p => p.id === product.id) ? "currentColor" : "none"} />
                          </button>

                          <div 
                            className="aspect-square bg-slate-100 relative overflow-hidden"
                            onClick={() => setSelectedProduct(product)}
                          >
                            {product.image ? (
                              <img 
                                src={product.image} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <ToothIcon size={64} />
                              </div>
                            )}
                            <div className="absolute top-3 right-3">
                              <span className="bg-white/90 backdrop-blur-sm text-blue-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                {(product as any).price ? `${(product as any).price} ر.س` : 'اتصل للسعر'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="p-6 flex flex-col flex-grow text-right">
                            <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-2">{product.name}</h3>
                            <p className="text-xs text-blue-500 font-bold mb-4 uppercase tracking-wider">
                              {getCategoryName(product.category)}
                            </p>
                            
                            <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
                              <button 
                                onClick={() => setSelectedProduct(product)}
                                className="text-blue-600 hover:text-blue-700 font-bold text-sm flex items-center gap-1"
                              >
                                تفاصيل المنتج <ChevronLeft size={14} />
                              </button>
                              <button 
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(product);
                                }}
                              >
                                <ShoppingCart size={18} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}

                {!loading && !error && filteredProducts.length === 0 && (
                  <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 text-slate-400 rounded-full mb-4">
                      <Search size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">لا توجد نتائج</h3>
                    <p className="text-slate-500">جرب البحث بكلمات أخرى</p>
                  </div>
                )}
              </div>
            </section>

            {/* Features Section */}
            <section id="about" className="py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid md:grid-cols-3 gap-12">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-4">أعلى جودة</h3>
                    <p className="text-slate-600">نحرص على توفير أفضل المواد الطبية المعتمدة عالمياً لضمان نجاح إجراءاتكم العلاجية.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Sparkles size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-4">أسعار تنافسية</h3>
                    <p className="text-slate-600">نقدم أفضل الأسعار في السوق مع عروض مستمرة لدعم عياداتكم ومراكزكم الطبية.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Phone size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-4">دعم فني متواصل</h3>
                    <p className="text-slate-600">فريقنا المتخصص جاهز دائماً للإجابة على استفساراتكم وتوفير ما تحتاجونه بسرعة وكفاءة.</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : currentView === 'cart' ? (
          <Cart 
            items={cart} 
            onUpdateQuantity={updateCartQuantity} 
            onRemove={removeFromCart} 
            onCheckout={() => setCurrentView('checkout')}
            onBack={() => setCurrentView('home')}
          />
        ) : currentView === 'favorites' ? (
          <Favorites 
            items={favorites} 
            onToggleFavorite={toggleFavorite} 
            onAddToCart={addToCart}
            onBack={() => setCurrentView('home')}
          />
        ) : (
          <Checkout 
            items={cart} 
            onComplete={() => {
              setCart([]);
            }}
            onBack={() => setCurrentView('cart')}
          />
        )}
      </main>

      <footer className="bg-slate-950 text-slate-500 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
                <ToothIcon size={18} />
              </div>
              <span className="text-lg font-bold text-white">متجر أسناننا</span>
            </div>
            <p className="text-sm">© {new Date().getFullYear()} جميع الحقوق محفوظة. متجر أسناننا.</p>
            <div className="flex gap-6">
              <button 
                onClick={() => setIsAdminView(true)}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Settings size={14} />
                لوحة التحكم
              </button>
              <a href="#" className="hover:text-white transition-colors">سياسة الخصوصية</a>
              <a href="#" className="hover:text-white transition-colors">الشروط والأحكام</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
          />
        )}
      </AnimatePresence>
      {/* Floating WhatsApp Button */}
      <a 
        href="https://wa.me/966575034090" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-green-600 hover:scale-110 transition-all group"
      >
        <Phone size={32} />
        <span className="absolute right-full mr-4 px-4 py-2 bg-white text-slate-900 text-sm font-bold rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          تواصل معنا عبر واتساب
        </span>
      </a>
    </div>
  );
}
