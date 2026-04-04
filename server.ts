import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const response = await wcRequest("GET", "products", null, { per_page: '100', ...req.query });
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
    const response = await wcRequest("GET", "orders", null, { per_page: '50' });
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
