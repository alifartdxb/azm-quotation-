import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "crypto";

// In-memory data store for the prototype
const db = {
  customers: [
    { id: "c1", name: "Ahmed Al Fasi", companyName: "Smart Vision Carpentry", contactPerson: "Mr. Vidyut", mobile: "054 598 2017", email: "info@smartvision.ae", address: "Business Bay, Dubai", trn: "1002 5994 5600 003" },
    { id: "c2", name: "Khalid Builders", companyName: "Khalid Const LLC", contactPerson: "Eng. Tariq", mobile: "050 123 4567", email: "tariq@khalidconst.ae", address: "Sharjah Ind Area", trn: "1002 1111 2222 333" }
  ],
  products: [
    { id: "p1", sku: "NKSCS-650-1CR", name: "Shower Column Set with Spout", brand: "Nourk", price: 900.00, unit: "Pcs", category: "Sanitary", image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=200&h=200" },
    { id: "p2", sku: "NKSH-07-CR", name: "Shattaf Set", brand: "Nourk", price: 70.00, unit: "Pcs", category: "Sanitary", image: "https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?auto=format&fit=crop&q=80&w=200&h=200" },
    { id: "p3", sku: "PEX-232", name: "Angle Valve", brand: "Generic", price: 25.00, unit: "Pcs", category: "Hardware", image: "https://images.unsplash.com/photo-1620646233562-f2a316141428?auto=format&fit=crop&q=80&w=200&h=200" },
    { id: "p4", sku: "NKES-VER-30100-CR", name: "Single Lever WB Mixer", brand: "Nourk", price: 215.00, unit: "Pcs", category: "Sanitary", image: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&q=80&w=200&h=200" },
    { id: "p5", sku: "SONET 3058-White", name: "Wall Hang WC", brand: "Sonet", price: 450.00, unit: "Pcs", category: "Sanitary", image: "https://images.unsplash.com/photo-1585058173693-010bd71a067a?auto=format&fit=crop&q=80&w=200&h=200" }
  ],
  quotations: []
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // === API ROUTES ===
  app.get("/api/dashboard/stats", (req, res) => {
    res.json({
      totalQuotes: db.quotations.length,
      pendingQuotes: db.quotations.filter(q => q.status === "Pending").length,
      totalCustomers: db.customers.length,
      totalProducts: db.products.length,
      recentQuotes: db.quotations.slice(-5).reverse()
    });
  });

  // Customers
  app.get("/api/customers", (req, res) => res.json(db.customers));
  app.post("/api/customers", (req, res) => {
    const newCustomer = { id: randomUUID(), ...req.body };
    db.customers.push(newCustomer);
    res.json(newCustomer);
  });

  // Products
  app.get("/api/products", (req, res) => res.json(db.products));
  app.post("/api/products", (req, res) => {
    const newProduct = { id: randomUUID(), ...req.body };
    db.products.push(newProduct);
    res.json(newProduct);
  });

  // Quotations
  app.get("/api/quotations", (req, res) => res.json(db.quotations));
  app.get("/api/quotations/:id", (req, res) => {
    const quote = db.quotations.find(q => q.id === req.params.id);
    if (!quote) return res.status(404).json({ error: "Not found" });
    res.json(quote);
  });
  app.post("/api/quotations", (req, res) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const seq = String(db.quotations.length + 1).padStart(4, '0');
    const quoteNo = `QTN${dateStr}${seq}`;
    
    const newQuote = { 
      id: randomUUID(), 
      quoteNo,
      createdAt: new Date().toISOString(),
      status: "Pending",
      ...req.body 
    };
    db.quotations.push(newQuote);
    res.json(newQuote);
  });

  // === VITE MIDDLEWARE ===
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
