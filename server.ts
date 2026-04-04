import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Helper to get WC credentials
const getWCCreds = () => {
  const consumerKey = process.env.WC_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.WC_CONSUMER_SECRET?.trim();
  const storeUrl = process.env.WC_STORE_URL?.trim();
  if (!consumerKey || !consumerSecret || !storeUrl) return null;
  return { consumerKey, consumerSecret, storeUrl };
};

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
