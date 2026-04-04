import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
    
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
        "Authorization": `Basic ${auth}`,
        "User-Agent": "Asnanee-Store-App/1.0"
      }
    };
    if (body) options.body = JSON.stringify(body);

    let response = await fetch(apiUrl, options);
    if (!response.ok && response.status === 404) {
      console.log(`404 on ${apiUrl}, trying fallback...`);
      response = await fetch(fallbackUrl, options);
    }
    return response;
  };

  // API Routes
  app.get("/api/products", async (req, res) => {
    try {
      const response = await wcRequest("GET", "products", null, { per_page: '100', ...req.query });
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const response = await wcRequest("POST", "products", req.body);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const response = await wcRequest("PUT", `products/${req.params.id}`, req.body);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const response = await wcRequest("DELETE", `products/${req.params.id}`, null, { force: true });
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const response = await wcRequest("GET", "products/categories", null, { per_page: '100' });
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const response = await wcRequest("POST", "products/categories", req.body);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const response = await wcRequest("PUT", `products/categories/${req.params.id}`, req.body);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const response = await wcRequest("DELETE", `products/categories/${req.params.id}`, null, { force: true });
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders", async (req, res) => {
    try {
      const response = await wcRequest("GET", "orders", null, { per_page: '50' });
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const response = await wcRequest("PUT", `orders/${req.params.id}`, req.body);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: "WC API Error", details: errorText });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

if (!process.env.VERCEL) {
  startServer();
}

let cachedApp: any;
export default async (req: any, res: any) => {
  if (!cachedApp) {
    cachedApp = await startServer();
  }
  return cachedApp(req, res);
}
