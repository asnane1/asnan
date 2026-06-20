import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase App and Firestore on backend using config file
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")
);
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const app = express();
app.use(express.json());

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Helper to get WP/WC credentials
const getWCCreds = () => {
  const consumerKey = process.env.WC_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.WC_CONSUMER_SECRET?.trim();
  const storeUrl = process.env.WC_STORE_URL?.trim();
  if (!consumerKey || !consumerSecret || !storeUrl) return null;
  return { consumerKey, consumerSecret, storeUrl };
};

// WordPress Media Upload Credentials
const WP_USER = process.env.WP_USER || "mohammad";
const WP_PASS = process.env.WP_PASS || "rQLU W4Yd FQ7h ZRSi Vzrx diuh";

// Helper for WC requests
const wcRequest = async (method: string, endpoint: string, body?: any, queryParams: any = {}) => {
  const creds = getWCCreds();
  if (!creds) throw new Error("WooCommerce credentials not configured");

  const baseUrl = creds.storeUrl.replace(/\/$/, "");
  
  const params = new URLSearchParams({
    consumer_key: creds.consumerKey,
    consumer_secret: creds.consumerSecret,
    ...queryParams
  });

  const apiUrl = `${baseUrl}/wp-json/wc/v3/${endpoint}?${params.toString()}`;
  const fallbackUrl = `${baseUrl}/index.php?rest_route=/wc/v3/${endpoint}&${params.toString()}`;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Asnanee-Store-App/1.0"
    }
  };
  if (body) options.body = JSON.stringify(body);

  let response = await fetch(apiUrl, options);
  if (!response.ok && response.status === 404) {
    response = await fetch(fallbackUrl, options);
  }
  return response;
};

// API Routes
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const creds = getWCCreds();
  if (!creds) return res.status(500).json({ error: "Store URL not configured" });

  const baseUrl = creds.storeUrl.replace(/\/$/, "");
  const uploadUrl = `${baseUrl}/wp-json/wp/v2/media`;
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");

  try {
    const options = {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Disposition": `attachment; filename="${req.file.originalname}"`,
        "Content-Type": req.file.mimetype,
      },
      body: req.file.buffer,
    };

    let response = await fetch(uploadUrl, options);
    
    // Fallback for non-pretty permalinks
    if (!response.ok && response.status === 404) {
      const fallbackUploadUrl = `${baseUrl}/index.php?rest_route=/wp/v2/media`;
      response = await fetch(fallbackUploadUrl, options);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
      console.error("WP Upload Error:", errorData);
      return res.status(response.status).json({ 
        error: "WordPress Upload Error", 
        details: errorData.message || "فشل الرفع إلى ووردبريس",
        code: errorData.code
      });
    }

    const data = await response.json();
    res.json({ url: data.source_url, id: data.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/test-connection", async (req, res) => {
  const creds = getWCCreds();
  if (!creds) {
    return res.json({ 
      status: "error", 
      message: "Credentials missing",
      keys: Object.keys(process.env).filter(k => k.startsWith('WC_'))
    });
  }
  try {
    const response = await wcRequest("GET", "products", null, { per_page: '1' });
    if (response.ok) {
      res.json({ status: "success", message: "Connected!" });
    } else {
      const err = await response.text();
      res.json({ status: "error", details: err });
    }
  } catch (error: any) {
    res.json({ status: "error", message: error.message });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    // If a specific per_page or page is requested, do a single request as usual
    if (req.query.per_page || req.query.page) {
      const response = await wcRequest("GET", "products", null, { per_page: '100', ...req.query });
      const data = await response.json();
      return res.json(data);
    }

    // Otherwise, fetch ALL pages to guarantee loading every product ("open list")
    // 1. Fetch the first page and check headers for total pages count
    const firstPageResponse = await wcRequest("GET", "products", null, { per_page: '100', page: '1', ...req.query });
    if (!firstPageResponse.ok) {
      const errText = await firstPageResponse.text();
      throw new Error(`WooCommerce API Error: ${errText}`);
    }

    const firstPageData = await firstPageResponse.json();
    if (!Array.isArray(firstPageData)) {
      return res.json(firstPageData);
    }

    let allProducts = [...firstPageData];

    // Read Woocommerce/WordPress total pages header
    const totalPagesHeader = firstPageResponse.headers.get('x-wp-totalpages');
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;

    if (totalPages > 1) {
      // Fetch remaining pages in parallel for maximum performance
      const pagePromises = [];
      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(
          wcRequest("GET", "products", null, { per_page: '100', page: p.toString(), ...req.query })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                return Array.isArray(data) ? data : [];
              }
              return [];
            })
            .catch(() => [])
        );
      }

      const otherPagesDataArray = await Promise.all(pagePromises);
      for (const pageData of otherPagesDataArray) {
        allProducts = allProducts.concat(pageData);
      }
    }

    res.json(allProducts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/products/:id/variations", async (req, res) => {
  try {
    const response = await wcRequest("GET", `products/${req.params.id}/variations`, null, { per_page: '100' });
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const response = await wcRequest("GET", "products/categories", null, { per_page: '100' });
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const ordersCol = collection(db, "orders");
    const q = query(ordersCol, orderBy("date_created", "desc"));
    const snapshot = await getDocs(q);
    const ordersList = snapshot.docs.map(docSnap => ({
      ...docSnap.data()
    }));
    res.json(ordersList);
  } catch (error: any) {
    console.error("Error reading orders from Firestore:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    const orderDocRef = doc(db, "orders", orderId);
    
    const orderSnap = await getDoc(orderDocRef);
    if (!orderSnap.exists()) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }
    
    await updateDoc(orderDocRef, {
      status: req.body.status,
      date_modified: new Date().toISOString()
    });
    
    const finalSnap = await getDoc(orderDocRef);
    res.json(finalSnap.data());
  } catch (error: any) {
    console.error("Error updating order in Firestore:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const response = await wcRequest("POST", "products", req.body);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const response = await wcRequest("PUT", `products/${req.params.id}`, req.body);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const response = await wcRequest("DELETE", `products/${req.params.id}`, null, { force: 'true' });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const response = await wcRequest("POST", "products/categories", req.body);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const response = await wcRequest("PUT", `products/categories/${req.params.id}`, req.body);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const response = await wcRequest("DELETE", `products/categories/${req.params.id}`, null, { force: 'true' });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const DEFAULT_GATEWAYS = [
  {
    id: "bacs",
    title: "التحويل البنكي المباشر (البنك)",
    description: "الدفع من خلال تحويل المبلغ لحسابنا البنكي ورفع إيصال التحويل للمتابعة.",
    enabled: true,
    settings: {
      account_details: { value: [] }
    }
  },
  {
    id: "cod",
    title: "الدفع عند الاستلام (COD)",
    description: "الدفع نقداً أو ببطاقة الصرف عند استلام طلبك من مندوب الشحن.",
    enabled: true,
    settings: {}
  }
];

const DEFAULT_ZONES = [
  {
    id: "sa",
    name: "المملكة العربية السعودية"
  }
];

const DEFAULT_METHODS: Record<string, any[]> = {
  sa: [
    {
      instance_id: 1,
      method_id: "flat_rate",
      title: "شحن ثابت",
      enabled: true,
      settings: {
        cost: {
          value: "25"
        }
      }
    },
    {
      instance_id: 2,
      method_id: "free_shipping",
      title: "شحن مجاني",
      enabled: false,
      settings: {
        min_amount: {
          value: "300"
        }
      }
    }
  ]
};

app.get("/api/payment-gateways", async (req, res) => {
  try {
    const colSnap = await getDocs(collection(db, "payment_gateways"));
    if (colSnap.empty) {
      for (const gateway of DEFAULT_GATEWAYS) {
        await setDoc(doc(db, "payment_gateways", gateway.id), gateway);
      }
      return res.json(DEFAULT_GATEWAYS);
    }
    const list = colSnap.docs.map(docSnap => ({ ...docSnap.data() }));
    // Sort so bacs and cod are consistent
    list.sort((a: any, b: any) => (a.id === "bacs" ? -1 : 1));
    res.json(list);
  } catch (error: any) {
    console.error("Error getting payment gateways:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/payment-gateways/:id", async (req, res) => {
  try {
    const gatewayId = req.params.id;
    const body = req.body;
    const docRef = doc(db, "payment_gateways", gatewayId);
    
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    
    const updateData: any = {};
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    
    if (body.settings !== undefined) {
      const mergedSettings = { ...(existingData.settings || {}), ...body.settings };
      if (body.settings.account_details !== undefined && Array.isArray(body.settings.account_details)) {
        mergedSettings.account_details = { value: body.settings.account_details };
      }
      updateData.settings = mergedSettings;
    }
    
    await setDoc(docRef, updateData, { merge: true });
    
    const finalSnap = await getDoc(docRef);
    res.json({ id: gatewayId, ...finalSnap.data() });
  } catch (error: any) {
    console.error("Error updating payment gateway:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/shipping-zones", async (req, res) => {
  try {
    const colSnap = await getDocs(collection(db, "shipping_zones"));
    if (colSnap.empty) {
      for (const zone of DEFAULT_ZONES) {
        await setDoc(doc(db, "shipping_zones", zone.id), zone);
        const methods = DEFAULT_METHODS[zone.id] || [];
        for (const method of methods) {
          await setDoc(doc(db, "shipping_zones", zone.id, "methods", String(method.instance_id)), method);
        }
      }
      return res.json(DEFAULT_ZONES);
    }
    const list = colSnap.docs.map(docSnap => ({ ...docSnap.data() }));
    res.json(list);
  } catch (error: any) {
    console.error("Error getting shipping zones:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/shipping-zones/:id/methods", async (req, res) => {
  try {
    const zoneId = req.params.id;
    const methodsSnap = await getDocs(collection(db, "shipping_zones", zoneId, "methods"));
    if (methodsSnap.empty) {
      const methods = DEFAULT_METHODS[zoneId] || [];
      for (const method of methods) {
        await setDoc(doc(db, "shipping_zones", zoneId, "methods", String(method.instance_id)), method);
      }
      return res.json(methods);
    }
    const list = methodsSnap.docs.map(docSnap => ({ ...docSnap.data() }));
    list.sort((a: any, b: any) => a.instance_id - b.instance_id);
    res.json(list);
  } catch (error: any) {
    console.error("Error getting shipping methods:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/shipping-zones/:zoneId/methods/:methodId", async (req, res) => {
  try {
    const { zoneId, methodId } = req.params;
    const body = req.body;
    const methodRef = doc(db, "shipping_zones", zoneId, "methods", methodId);
    
    const existingSnap = await getDoc(methodRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    
    const updateData: any = {};
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.title !== undefined) updateData.title = body.title;
    
    if (body.settings !== undefined) {
      updateData.settings = { ...(existingData.settings || {}), ...body.settings };
    }
    
    await setDoc(methodRef, updateData, { merge: true });
    const finalSnap = await getDoc(methodRef);
    res.json({ instance_id: parseInt(methodId), ...finalSnap.data() });
  } catch (error: any) {
    console.error("Error updating shipping method:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const orderBody = req.body;
    
    // Fetch all existing orders to determine the next sequential ID
    const ordersCol = collection(db, "orders");
    const snapshot = await getDocs(ordersCol);
    let nextNum = 1001;
    
    if (!snapshot.empty) {
      let maxSeqId = 1000;
      snapshot.docs.forEach(docSnap => {
        const d = docSnap.data();
        const idNum = parseInt(d.id, 10);
        if (typeof idNum === 'number' && !isNaN(idNum)) {
          // If the existing ID is less than 100000, treat it as part of our sequence
          if (idNum < 100000 && idNum > maxSeqId) {
            maxSeqId = idNum;
          }
        }
      });
      nextNum = maxSeqId + 1;
    }
    
    const orderId = String(nextNum);
    
    const newOrder = {
      ...orderBody,
      id: nextNum,
      status: req.body.status || "pending",
      currency: orderBody.currency || "SAR",
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString()
    };
    
    await setDoc(doc(db, "orders", orderId), newOrder);
    res.json({ id: orderId, ...newOrder });
  } catch (error: any) {
    console.error("Error creating order in Firestore:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GOOGLE INTEGRATIONS (Sitemap, merchant, indexing, performance)
// ==========================================

// Helper to retrieve all WooCommerce products
const getAllProductsForFeeds = async () => {
  try {
    const firstPageResponse = await wcRequest("GET", "products", null, { per_page: "100", page: "1" });
    if (!firstPageResponse.ok) return [];
    
    const firstPageData = await firstPageResponse.json();
    if (!Array.isArray(firstPageData)) return [];
    
    let allProducts = [...firstPageData];
    const totalPagesHeader = firstPageResponse.headers.get("x-wp-totalpages");
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
    
    if (totalPages > 1) {
      const pagePromises = [];
      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(
          wcRequest("GET", "products", null, { per_page: "100", page: p.toString() })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                return Array.isArray(data) ? data : [];
              }
              return [];
            })
            .catch(() => [])
        );
      }
      const otherPagesDataArray = await Promise.all(pagePromises);
      for (const pageData of otherPagesDataArray) {
        allProducts = allProducts.concat(pageData);
      }
    }
    return allProducts;
  } catch (error) {
    console.error("Error fetching all products for Google feed/sitemap:", error);
    return [];
  }
};

// Helper to retrieve all WooCommerce categories
const getAllCategoriesForSitemap = async () => {
  try {
    const response = await wcRequest("GET", "products/categories", null, { per_page: "100" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching categories for sitemap:", error);
    return [];
  }
};

// Helper to get Google API JWT Authentication Client
const getGoogleAuth = () => {
  const credentialsPath = path.join(process.cwd(), "google-credentials.json");
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }
  try {
    const creds = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: [
        "https://www.googleapis.com/auth/indexing", 
        "https://www.googleapis.com/auth/webmasters.readonly"
      ]
    });
    return auth;
  } catch (error) {
    console.error("Error setting up Google Auth JWT:", error);
    return null;
  }
};

// Site ownership verification html files (e.g. google12345.html)
app.get("/google:verificationId.html", (req, res) => {
  const verificationId = req.params.verificationId;
  res.set("Content-Type", "text/html");
  res.send(`google-site-verification: google${verificationId}.html`);
});

// Dynamic XML Sitemap
app.get("/sitemap.xml", async (req, res) => {
  try {
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const baseUrl = `${protocol}://${host}`;
    
    const [products, categories] = await Promise.all([
      getAllProductsForFeeds(),
      getAllCategoriesForSitemap()
    ]);
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/cart</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`;

    // Add Products to Sitemap
    products.forEach((product: any) => {
      const updatedDate = product.date_modified ? product.date_modified.split("T")[0] : new Date().toISOString().split("T")[0];
      xml += `
  <url>
    <loc>${baseUrl}/?product=${product.id}</loc>
    <lastmod>${updatedDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    // Add Categories to Sitemap
    categories.forEach((cat: any) => {
      xml += `
  <url>
    <loc>${baseUrl}/?category=${cat.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `
</urlset>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);
  } catch (error: any) {
    res.status(500).send(`<error>${error.message}</error>`);
  }
});

// Dynamic Google Merchant XML Feed
app.get("/google-merchant.xml", async (req, res) => {
  try {
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const baseUrl = `${protocol}://${host}`;
    
    const products = await getAllProductsForFeeds();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>متجر اسناني - Asnanee Store</title>
  <link>${baseUrl}</link>
  <description>جميع مستلزمات ومنتجات العناية بالأسنان العالية الجودة</description>
  <language>ar</language>`;

    products.forEach((product: any) => {
      if (product.status !== "publish") return;
      
      const id = product.id;
      const title = product.name ? product.name.replace(/[<>&'"]/g, (c: string) => {
        switch (c) {
          case "<": return "&lt;";
          case ">": return "&gt;";
          case "&": return "&amp;";
          case "'": return "&apos;";
          case "\"": return "&quot;";
          default: return c;
        }
      }) : "";
      
      let description = (product.short_description || product.description || "لا يوجد وصف متاح")
        .replace(/<[^>]*>/g, "")
        .trim();
        
      if (description.length > 1000) {
        description = description.substring(0, 995) + "...";
      }
      
      description = description.replace(/[<>&'"]/g, (c: string) => {
        switch (c) {
          case "<": return "&lt;";
          case ">": return "&gt;";
          case "&": return "&amp;";
          case "'": return "&apos;";
          case "\"": return "&quot;";
          default: return c;
        }
      });

      const link = `${baseUrl}/?product=${product.id}`;
      const imageUrl = (product.images && product.images[0]?.src) || "";
      const price = `${product.price || product.regular_price || "0"} SAR`;
      const availability = product.stock_status === "instock" ? "in_stock" : "out_of_stock";
      
      xml += `
  <item>
    <g:id>${id}</g:id>
    <g:title>${title}</g:title>
    <g:description>${description}</g:description>
    <g:link>${link}</g:link>
    <g:image_link>${imageUrl}</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>${availability}</g:availability>
    <g:price>${price}</g:price>
    <g:brand>Asnanee</g:brand>
  </item>`;
    });

    xml += `
</channel>
</rss>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);
  } catch (error: any) {
    res.status(500).send(`<error>${error.message}</error>`);
  }
});

// GET configuration status
app.get("/api/google/config", async (req, res) => {
  try {
    const configPath = path.join(process.cwd(), "google-credentials.json");
    const exists = fs.existsSync(configPath);
    if (!exists) {
      return res.json({ configured: false });
    }
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    res.json({
      configured: true,
      clientEmail: parsed.client_email,
      projectId: parsed.project_id
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST save Google Credentials
app.post("/api/google/config", async (req, res) => {
  try {
    const { serviceAccountJson } = req.body;
    if (!serviceAccountJson) {
      return res.status(400).json({ error: "ملف الاعتماد مفتاح JSON مطلوب" });
    }

    let parsed;
    try {
      parsed = typeof serviceAccountJson === "string" ? JSON.parse(serviceAccountJson) : serviceAccountJson;
    } catch (e) {
      return res.status(400).json({ error: "صيغة JSON غير صالحة" });
    }

    if (!parsed.client_email || !parsed.private_key) {
      return res.status(400).json({ error: "ملف الخدمة (Service Account) غير صالح أو ينقصه حقول أساسية" });
    }

    const configPath = path.join(process.cwd(), "google-credentials.json");
    fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), "utf-8");
    res.json({ success: true, clientEmail: parsed.client_email, projectId: parsed.project_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Google configuration
app.delete("/api/google/config", async (req, res) => {
  try {
    const configPath = path.join(process.cwd(), "google-credentials.json");
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST dynamic Search Indexing submission (using Google Indexing API)
app.post("/api/google/indexing", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "الرابط مطلوب للإرسال" });

    const auth = getGoogleAuth();
    if (!auth) {
      return res.status(400).json({ error: "بيانات اعتماد حساب خدمات جوجل (Google Service Account) غير مهيأة" });
    }

    await auth.authorize();
    const indexing = google.indexing({
      version: "v3",
      auth: auth
    });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: "URL_UPDATED"
      }
    });

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("GSC Indexing API error:", error);
    res.status(500).json({ error: error.message || "فشل إرسال الطلب لجوجل" });
  }
});

// POST dynamic stats from Search Console (Search analytics performance for a product name or URL)
app.post("/api/google/performance", async (req, res) => {
  try {
    const { productUrl, productName } = req.body;
    const auth = getGoogleAuth();
    if (!auth) {
      return res.json({ 
        notConfigured: true,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        queries: []
      });
    }

    await auth.authorize();
    const searchconsole = google.searchconsole({
      version: "v1",
      auth: auth
    });

    // List properties to match our host
    const sitesResponse = await searchconsole.sites.list({});
    const siteList = sitesResponse.data.siteEntry || [];
    if (siteList.length === 0) {
      return res.json({ success: false, error: "لم يتم العثور على أية مواقع معتمدة في حساب Search Console" });
    }

    const host = req.get("host") || "";
    let siteUrl = siteList[0].siteUrl || "";
    // Match exact site domain if possible
    const matched = siteList.find(s => s.siteUrl?.includes(host));
    if (matched) {
      siteUrl = matched.siteUrl || "";
    }

    // Default dates (last 30 days)
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const queryPayload: any = {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 15
    };

    // Filter by page URL if provided, or fallback to query filtering using product name
    if (productUrl) {
      queryPayload.dimensionFilterGroups = [{
        filters: [{
          dimension: "page",
          operator: "equals",
          expression: productUrl
        }]
      }];
      // Add "page" dimension as well to retrieve specific performance
      queryPayload.dimensions = ["query", "page"];
    } else if (productName) {
      queryPayload.dimensionFilterGroups = [{
        filters: [{
          dimension: "query",
          operator: "contains",
          expression: productName
        }]
      }];
    }

    const performanceResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: queryPayload
    });

    const rows = performanceResponse.data.rows || [];
    
    let totalClicks = 0;
    let totalImpressions = 0;
    let avgPosition = 0;
    let count = 0;

    const queriesList = rows.map((row: any) => {
      const q = row.keys?.[0] || "";
      totalClicks += row.clicks || 0;
      totalImpressions += row.impressions || 0;
      avgPosition += row.position || 0;
      count++;
      return {
        query: q,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: (row.ctr || 0) * 100,
        position: row.position || 0
      };
    });

    res.json({
      success: true,
      siteUrl,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      position: count > 0 ? avgPosition / count : 0,
      queries: queriesList
    });
  } catch (error: any) {
    console.error("GSC Analytics error:", error);
    res.status(500).json({ error: error.message || "خطأ أثناء جلب إحصائيات الأداء من جوجل" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).end();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = 3000;
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
