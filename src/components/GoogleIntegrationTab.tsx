import React, { useState, useEffect } from "react";
import { 
  Globe, 
  Key, 
  Copy, 
  Check, 
  ExternalLink, 
  TrendingUp, 
  Send, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Info, 
  RefreshCw, 
  Trash2,
  FileText
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: string;
  regular_price: string;
  sale_price: string;
  status: string;
  type: "simple" | "variable";
  categories: Array<{ id: number; name: string }>;
  images: Array<{ src: string }>;
  description: string;
  short_description: string;
}

interface PerformanceData {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export default function GoogleIntegrationTab({ products }: { products: Product[] }) {
  const [config, setConfig] = useState<{ configured: boolean; clientEmail?: string; projectId?: string } | null>(null);
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submittingConfig, setSubmittingConfig] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Site Verification Hook
  const [verificationId, setVerificationId] = useState("");
  
  // Automated Indexing State
  const [indexingStatus, setIndexingStatus] = useState<Record<number, { status: "idle" | "loading" | "success" | "error"; msg?: string }>>({});
  
  // Keyword Search Console Performance Connect State
  const [performanceCache, setPerformanceCache] = useState<Record<number, PerformanceData>>({});
  const [loadingPerformance, setLoadingPerformance] = useState<Record<number, boolean>>({});

  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const merchantFeedUrl = `${baseUrl}/google-merchant.xml`;

  useEffect(() => {
    fetchGoogleConfig();
  }, []);

  const fetchGoogleConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/google/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to load Google Config:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceAccountJson.trim()) return;

    setSubmittingConfig(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/google/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAccountJson }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ غير معروف في حفظ الإعدادات");

      setSuccessMsg("تم حفظ بيانات اعتماد جوجل بنجاح وتفعيل الربط التلقائي!");
      setServiceAccountJson("");
      fetchGoogleConfig();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "تأكد من صحة كود مفتاح JSON");
    } finally {
      setSubmittingConfig(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm("هل أنت متأكد من حذف تكامِل جوجل؟ سيؤدي ذلك لتعطيل الأرشفة التلقائية الحية.")) return;
    
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/google/config", { method: "DELETE" });
      if (res.ok) {
        setConfig({ configured: false });
        setSuccessMsg("تمت إزالة مفاتيح الربط.");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleCopyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Submit product to Google Indexing API
  const handleIndexProduct = async (product: Product) => {
    const productUrl = `${baseUrl}/?product=${product.id}`;
    setIndexingStatus(prev => ({ ...prev, [product.id]: { status: "loading" } }));

    try {
      // If config is not configured, simulate local success and guide user
      if (!config?.configured) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIndexingStatus(prev => ({ 
          ...prev, 
          [product.id]: { 
            status: "success", 
            msg: "تمت المحاكاة بنجاح! قم بربط ملف الخدمة (Service Account) للأرشفة التلقائية الحقيقية." 
          } 
        }));
        return;
      }

      const res = await fetch("/api/google/indexing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إرسال طلب الأرشفة الفوري");

      setIndexingStatus(prev => ({ 
        ...prev, 
        [product.id]: { 
          status: "success", 
          msg: "تم الإرسال بنجاح لجوجل! سيتم الزحف إليه خلال دقائق." 
        } 
      }));
    } catch (err: any) {
      setIndexingStatus(prev => ({ 
        ...prev, 
        [product.id]: { 
          status: "error", 
          msg: err.message || "حدث خطأ أثناء الإرسال" 
        } 
      }));
    }
  };

  // Fetch or simulate live keywords and performance metrics for a specific product name
  const handleFetchPerformance = async (product: Product) => {
    setLoadingPerformance(prev => ({ ...prev, [product.id]: true }));
    const productUrl = `${baseUrl}/?product=${product.id}`;

    try {
      const res = await fetch("/api/google/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productUrl,
          productName: product.name 
        }),
      });

      const data = await res.json();

      if (data.notConfigured || !config?.configured) {
        // Safe and neat mockup based of word search phrases (as requested by user)
        // Simulate continuous random updates to show integration in action!
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        const randomC = Math.floor(Math.random() * 50) + 15;
        const randomI = randomC * (Math.floor(Math.random() * 8) + 10);
        const randomCTR = (randomC / randomI) * 100;
        const randomPos = Math.random() * 3 + 1.2;

        const mockQueries = [
          { query: `شراء ${product.name}`, clicks: Math.floor(randomC * 0.5), impressions: Math.floor(randomI * 0.4), ctr: randomCTR, position: randomPos },
          { query: `${product.name} سعر`, clicks: Math.floor(randomC * 0.3), impressions: Math.floor(randomI * 0.3), ctr: randomCTR + 1, position: randomPos + 0.5 },
          { query: `متجر لبيع ${product.name}`, clicks: Math.floor(randomC * 0.15), impressions: Math.floor(randomI * 0.2), ctr: randomCTR - 2, position: randomPos + 1.1 },
          { query: `أفضل سعر لـ ${product.name} في السعودية`, clicks: Math.floor(randomC * 0.05), impressions: Math.floor(randomI * 0.1), ctr: randomCTR - 4, position: randomPos + 2.3 }
        ];

        setPerformanceCache(prev => ({
          ...prev,
          [product.id]: {
            clicks: randomC,
            impressions: randomI,
            ctr: randomCTR,
            position: randomPos,
            queries: mockQueries
          }
        }));
      } else if (res.ok && data.success) {
        setPerformanceCache(prev => ({
          ...prev,
          [product.id]: {
            clicks: data.clicks || 0,
            impressions: data.impressions || 0,
            ctr: data.ctr || 0,
            position: data.position || 0,
            queries: data.queries || []
          }
        }));
      } else {
        throw new Error(data.error || "فشلت عملية الاتصال بالبيانات");
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingPerformance(prev => ({ ...prev, [product.id]: false }));
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 text-right" dir="rtl">
      
      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-r-4 border-emerald-500 rounded-xl text-emerald-800 text-sm font-bold flex items-center gap-2 mb-4 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border-r-4 border-rose-500 rounded-xl text-rose-800 text-sm font-bold flex items-center gap-2 mb-4 animate-fadeIn">
          <AlertTriangle size={18} className="text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main introduction */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl translate-x-12 translate-y-12"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-black tracking-wide uppercase">
              أدوات محركات البحث والتاجر
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-100">تحسين محركات بـجوجل والتزامن التلقائي الحجمي</h2>
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              نقوم بربط تلقائي وفوري ومفتوح لكافة المنتجات التي يتم إضافتها في وورد بريس مع جوجل سيرش كونسل (Search Console) والتاجر (Merchant Center). يتضمن ذلك توليد خريطة للموقع سريعة ومحدثة بشكل مستدام، إضافة للتحديث التلقائي لعبارات البحث واسترجاع الإحصائيات الفورية.
            </p>
          </div>
          <div className="flex gap-4 self-start md:self-center shrink-0">
            <a 
              href="/sitemap.xml" 
              target="_blank" 
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-xs flex items-center gap-2 transition-all"
            >
              <Globe size={16} />
              معاينة خريطة الموقع
            </a>
            <a 
              href="/google-merchant.xml" 
              target="_blank" 
              className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              <FileText size={16} />
              معاينة RSS التاجر
            </a>
          </div>
        </div>
      </div>

      {/* Grid of integration URLs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Search Console Sitemap Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
              <Globe size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">1. خريطة الموقع الديناميكية (Sitemap.xml)</h3>
              <p className="text-xs text-slate-500">محدثة تلقائياً ومستجيبة لأي إضافة جديدة</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            توفر هذه الخريطة قائمة متكاملة بكافة روابط الموقع، المدونات، وتصنيفات المنتجات من أجل تمكين روبوتات جوجل من فهرستها وفحص أي تغيير فوراً.
          </p>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">رابط الملف للخريطة لتقديمه في Search Console:</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-3 rounded-2xl text-left font-mono text-xs select-all text-blue-600 overflow-x-auto relative">
              <button 
                onClick={() => handleCopyUrl(sitemapUrl, "sitemap")}
                className="absolute right-2 top-11/2 -translate-y-11/2 p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all mr-2 shadow-sm"
                title="نسخ الرابط"
              >
                {copiedText === "sitemap" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
              <span className="pl-12 block">{sitemapUrl}</span>
            </div>
          </div>

          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs text-blue-800 flex items-start gap-2 leading-relaxed">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="font-medium">
              <strong>خطوات الربط:</strong> افتح حسابك في <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="font-bold underline text-blue-600">Google Search Console</a>، توجه إلى تبويب "خرائط الموقع" (Sitemaps)، ثم أدخل الرابط أعلاه لتبقى منتجاتك متصلة وتتحدث هناك فورياً وبصورة آلية.
            </p>
          </div>
        </div>

        {/* Merchant Center Feed Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">2. خلاصة جوجل للمتسوقين (Google Merchant XML Feed)</h3>
              <p className="text-xs text-slate-500">تمكين عرض منتجاتك كإعلانات وتسوق مجاني</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            يُولد هذا الرابط خلاصة متطابقة مع معايير Google Shopping RSS 2.0، تشمل أسعار المنتجات وصورها وحجم مخزونها وتفاصيلها لمزامنتها مع مستودع Merchant Center تلقائياً.
          </p>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">رابط التغذية الدائم لتقديمه في Google Merchant:</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-3 rounded-2xl text-left font-mono text-xs select-all text-emerald-600 overflow-x-auto relative">
              <button 
                onClick={() => handleCopyUrl(merchantFeedUrl, "merchant")}
                className="absolute right-2 top-11/2 -translate-y-11/2 p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all mr-2 shadow-sm"
                title="نسخ الرابط"
              >
                {copiedText === "merchant" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
              <span className="pl-12 block">{merchantFeedUrl}</span>
            </div>
          </div>

          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-xs text-emerald-800 flex items-start gap-2 leading-relaxed">
            <Info size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="font-medium">
              <strong>وظيفة المزامنة التلقائية:</strong> عند تقديم هذا الرابط في Google Merchant Center بجدولة تبويب "الخلاصات المبرمجة" (Scheduled Feeds) يومياً، سيقوم جوجل بجلب الأسعار الحديثة والتحديثات التلقائية فوراً دون تدخل يدوي مكرر.
            </p>
          </div>
        </div>

      </div>

      {/* Auto Verification tool code */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-lg font-black text-slate-900">3. تفعيل التحقق التلقائي السلس لملكية الموقع (Site Ownership Verification)</h3>
        <p className="text-sm text-slate-600 leading-relaxed font-medium">
          هل تطلب منك جوجل رفع ملف تحقق لإثبات ملكية هذا النطاق؟ لا داعي للرفع اليدوي أو استخدام بروتوكول FTP! بمجرد إدخال رقم التعريف أدناه، سيقوم خادمنا بصنع هذا الملف لك فورياً!
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-grow space-y-2 w-full">
            <label className="text-xs font-bold text-slate-700 block text-right">أدخل المفتاح الفريد لملف جوجل (مثال: googlea1b2c3d4e5f6.html فقط اكتب الحروف والأرقام مثل a1b2c3d4e5f6):</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">google[کود_جوجل].html</span>
              <input 
                type="text" 
                placeholder="مثال: a1b2c3d4e5f6"
                value={verificationId}
                onChange={(e) => setVerificationId(e.target.value.replace(/google|\.html/g, ""))}
                className="w-full pl-36 pr-4 py-3 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-mono text-xs tracking-wider"
              />
            </div>
          </div>
        </div>

        {verificationId && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between gap-4 animate-fadeIn">
            <div className="text-xs text-amber-800 leading-relaxed font-bold">
              <span>الرابط جاهز للتحقق المباشر من جوجل الآن: </span>
              <a 
                href={`${baseUrl}/google${verificationId}.html`} 
                target="_blank" 
                rel="noreferrer" 
                className="underline font-mono text-blue-600 block sm:inline"
              >
                {baseUrl}/google{verificationId}.html
              </a>
            </div>
            <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black shrink-0 animate-pulse">
              نشط وتلقائي!
            </span>
          </div>
        )}
      </div>

      {/* Google Service Account config block */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-lg space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <Key size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">4. ربط مفاتيح سحابة جوجل (Google Cloud Service Account)</h3>
              <p className="text-xs text-slate-500">مطلوب لتشغيل الفهرسة الفورية واسترجاع عبارات البحث الحية</p>
            </div>
          </div>
          <div>
            {loadingConfig ? (
              <Loader2 className="animate-spin text-indigo-600" size={20} />
            ) : config?.configured ? (
              <span className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                متصل بخدمات جوجل
              </span>
            ) : (
              <span className="px-3.5 py-1.5 bg-rose-500/10 text-rose-500 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                غير متصل (يعمل بوضع المعاينة المحاكية)
              </span>
            )}
          </div>
        </div>

        {config?.configured && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 block">بريد حساب الخدمات المتصل (Email):</span>
              <span className="font-mono text-xs text-slate-800 break-all">{config.clientEmail}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 block">معرف المشروع في جوجل (Project ID):</span>
              <span className="font-mono text-xs text-slate-800">{config.projectId}</span>
            </div>
            <div className="md:col-span-2 pt-2 flex justify-end">
              <button 
                onClick={handleDeleteConfig}
                className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                فصل التكامِل ومسح مفتاح الاعتماد
              </button>
            </div>
          </div>
        )}

        {!config?.configured && (
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">قم بلصق محتويات ملف المفتاح الخدمي (Google Service Account JSON Key) هنا لتشغيل التحديثات الحية:</label>
              <textarea 
                rows={5}
                required
                value={serviceAccountJson}
                onChange={(e) => setServiceAccountJson(e.target.value)}
                placeholder='{ "type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..." }'
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-left focus:ring-2 focus:ring-indigo-500 transition-all focus:bg-white resize-y"
                dir="ltr"
              />
            </div>
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="text-xs text-slate-500 max-w-lg leading-relaxed font-medium">
                <strong>💡 شروط التفعيل الحقيقي:</strong> اصنع حساب خدمات (Service Account) في بوابة Google Cloud مع تفعيل صلاحيات Google Search Console API و Indexing API، وتحميل مفتاح JSON. ثم أضف البريد الخاص بالخدمة كمالك مفوض في كونسول البحث.
              </div>
              <button 
                type="submit"
                disabled={submittingConfig}
                className="px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-2xl transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2"
              >
                {submittingConfig ? <Loader2 className="animate-spin" size={16} /> : <Key size={16} />}
                حفظ المفتاح وتفعيل المزامنة الحية
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Automated Indexing & GSC phrase linking */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Products auto indexer column */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Send className="text-blue-500" size={20} />
            <h3 className="text-base font-black text-slate-950">الأرشفة والتقديم الفوري للمنتجات 🚀</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            يوفر هذا القسم آلية لإخطار جوجل فوراً بأي تغيير أو منتج تمت إضافته في ووردبريس، فيقوم روبوت جوجل بالزحف إليه فورياً دون انتظار المزامنات اليدوية.
          </p>

          <div className="space-y-3 h-[420px] overflow-y-auto pr-1">
            {products.map(product => {
              const status = indexingStatus[product.id];
              return (
                <div key={product.id} className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-2xl flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                      <img src={product.images[0]?.src || undefined} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-black text-slate-900 truncate">{product.name}</h4>
                      <p className="text-[10px] text-blue-600 font-mono tracking-tight font-bold">{product.price || product.regular_price} ر.س</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {status?.status === "success" && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-black" title={status.msg}>
                        تم الإرسال ✓
                      </span>
                    )}
                    {status?.status === "error" && (
                      <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-black" title={status.msg}>
                        خلل ⚠
                      </span>
                    )}
                    
                    <button 
                      onClick={() => handleIndexProduct(product)}
                      disabled={status?.status === "loading"}
                      className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                      title="طلب فهرسة للرابط في سيرش كونسل"
                    >
                      {status?.status === "loading" ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Keywords Linkage Performance Grid Column */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 xl:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-indigo-600" size={20} />
              <h3 className="text-base font-black text-slate-950">ربط اسم المنتجات كعبارة بحث في جوجل كونسول وتحديث مستمر 🎯</h3>
            </div>
            {!config?.configured && (
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                وضع المحاكاة نشط
              </span>
            )}
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed font-bold">
            ربط اسم أي منتج تلقائياً كعبارة بحث دلالية في Google Search Console. اضغط على أي منتج من القائمة أدناه لتحديث الإحصائيات الفورية لمرات ظهور منتجك ونسب النقر والعبارات المؤدية لشرائه بحسب إدخالات العملاء.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pl-1">
              {products.map(product => {
                const perf = performanceCache[product.id];
                const loading = loadingPerformance[product.id];

                return (
                  <div key={product.id} className="p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-200/60 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                          <img src={product.images[0]?.src || undefined} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="text-xs font-black text-slate-800 truncate" title={product.name}>{product.name}</h4>
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded block w-max mt-1">
                            عبارة البحث: {product.name}
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleFetchPerformance(product)}
                        disabled={loading}
                        className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                        title="تحديث البيانات من سيرش كونسل"
                      >
                        {loading ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                      </button>
                    </div>

                    {/* Stats display if exists */}
                    {perf ? (
                      <div className="space-y-3 pt-2 border-t border-dashed border-slate-200 animate-fadeIn">
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div className="p-1.5 bg-indigo-50/50 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block">النقرات</span>
                            <span className="text-xs font-extrabold text-indigo-700">{perf.clicks}</span>
                          </div>
                          <div className="p-1.5 bg-blue-50/50 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block">الظهور</span>
                            <span className="text-xs font-extrabold text-blue-700">{perf.impressions}</span>
                          </div>
                          <div className="p-1.5 bg-emerald-50/50 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block">نقر/ظهور</span>
                            <span className="text-xs font-extrabold text-emerald-700">{perf.ctr.toFixed(1)}%</span>
                          </div>
                          <div className="p-1.5 bg-amber-50/50 rounded-lg">
                            <span className="text-[8px] font-black text-slate-400 block">الترتيب</span>
                            <span className="text-xs font-extrabold text-amber-700">{perf.position.toFixed(1)}</span>
                          </div>
                        </div>

                        {/* Top Searched Queries list */}
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-slate-400 block">أبرز الكلمات المستعلمة المؤدية للمنتج:</span>
                          <div className="space-y-1">
                            {perf.queries.map((q, qIdx) => (
                              <div key={qIdx} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-slate-100 text-[10px]">
                                <span className="font-bold text-slate-700 text-right">{q.query}</span>
                                <span className="text-[9px] font-mono text-indigo-600 font-bold bg-indigo-100/50 px-1.5 py-0.2 rounded shrink-0">
                                  {q.clicks} نقرة
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-[10px] font-bold">
                        لم يتم مزامنتها بعد. اضغط تحديث ⟳ لجلب عبارات سيرش كونسل.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
