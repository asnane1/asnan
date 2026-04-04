import { Product, Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'endo', name: 'علاج العصب (Endodontic)', icon: 'Tooth' },
  { id: 'disposable', name: 'الأدوات الاستهلاكية (Disposables)', icon: 'Trash2' },
  { id: 'cosmetic', name: 'الترميم والتجميل (Cosmetic)', icon: 'Sparkles' },
];

export const PRODUCTS: Product[] = [
  // Endodontic
  { id: 'e1', name: 'حقن وريشة غسيل العصب', nameEn: 'Irrigation syringes and tips', category: 'endo' },
  { id: 'e2', name: 'ملفات K و H', nameEn: 'K file, H file', category: 'endo' },
  { id: 'e3', name: 'غوتا بيرشا', nameEn: 'Gutta percha', category: 'endo' },
  { id: 'e4', name: 'ورق نقاط العصب', nameEn: 'Paper point', category: 'endo' },
  { id: 'e5', name: 'هيدروكسيد الكالسيوم', nameEn: 'Calcium hydroxide', category: 'endo' },
  { id: 'e6', name: 'Endo Ice', nameEn: 'Endo Ice', category: 'endo' },
  { id: 'e7', name: 'فورمو-كريسول', nameEn: 'Formo-cresol', category: 'endo' },
  { id: 'e8', name: 'مواد ملء العصب', nameEn: 'Endo Sealers', category: 'endo' },
  { id: 'e9', name: 'ملفات دوارة للعصب', nameEn: 'Endo rotary files', category: 'endo' },
  { id: 'e10', name: 'أدوات قياس العصب', nameEn: 'Endodontic instruments', category: 'endo' },
  { id: 'e11', name: 'رُقعة قياس العصب', nameEn: 'Endo ruler', category: 'endo' },
  { id: 'e12', name: 'مثبتات العصب', nameEn: 'Endodontic burs', category: 'endo' },
  { id: 'e13', name: 'أجهزة لعمليات العصب', nameEn: 'Endo motors', category: 'endo' },
  { id: 'e14', name: 'أجهزة تحديد القمة', nameEn: 'Apex locators', category: 'endo' },
  { id: 'e15', name: 'ماء هيبوكلوريت الصوديوم', nameEn: 'Sodium hypochlorite', category: 'endo' },
  { id: 'e16', name: 'مثقاب غيتس', nameEn: 'Gates drill', category: 'endo' },

  // Disposables
  { id: 'd1', name: 'رول قطني', nameEn: 'Cotton rolls', category: 'disposable' },
  { id: 'd2', name: 'إسفنجة شاش', nameEn: 'Gauze sponge', category: 'disposable' },
  { id: 'd3', name: 'أطراف هواء/ماء', nameEn: 'Air/water tips', category: 'disposable' },
  { id: 'd4', name: 'روب/مئزر للمريض', nameEn: 'Patient bibs, napkin', category: 'disposable' },
  { id: 'd5', name: 'مخارج اللعاب', nameEn: 'Saliva ejectors', category: 'disposable' },
  { id: 'd6', name: 'أجهزة شفط عالية الحجم', nameEn: 'High volume suction', category: 'disposable' },

  // Cosmetic and Restoration
  { id: 'c1', name: 'دليل الألوان', nameEn: 'Shade guide', category: 'cosmetic' },
  { id: 'c2', name: 'مواد الزجاج الأيوني', nameEn: 'Glass ionomers', category: 'cosmetic' },
  { id: 'c3', name: 'المواد المركبة', nameEn: 'Composite', category: 'cosmetic' },
  { id: 'c4', name: 'مثبتات المركب', nameEn: 'Composite sealants', category: 'cosmetic' },
  { id: 'c5', name: 'روابط', nameEn: 'Bond', category: 'cosmetic' },
  { id: 'c6', name: 'مواد الحفر والتخطيط', nameEn: 'Etchants', category: 'cosmetic' },
  { id: 'c7', name: 'أطراف مخصصة', nameEn: 'Tips', category: 'cosmetic' },
];
