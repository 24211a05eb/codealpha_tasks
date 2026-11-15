const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "store.db"));

db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Processing',
    shipping_address TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

const productCount = db
  .prepare("SELECT COUNT(*) AS count FROM products")
  .get().count;
if (!productCount) {
  const insert = db.prepare(`
    INSERT INTO products (name, category, description, price, image, featured)
    VALUES (@name, @category, @description, @price, @image, @featured)
  `);
  const seed = [
    {
      name: "Cloud Knit Sweater",
      category: "Apparel",
      description:
        "A relaxed, heavyweight knit made for crisp mornings and slow weekends.",
      price: 78,
      image:
        "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85",
      featured: 1,
    },
    {
      name: "Arc Table Lamp",
      category: "Home",
      description:
        "Soft, sculptural light with a warm glow for your reading nook.",
      price: 124,
      image:
        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85",
      featured: 1,
    },
    {
      name: "Daily Carry Tote",
      category: "Accessories",
      description:
        "Roomy, durable canvas with an inside pocket for the essentials.",
      price: 42,
      image:
        "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=85",
      featured: 1,
    },
    {
      name: "Ceramic Pour Over",
      category: "Kitchen",
      description:
        "A considered morning ritual, shaped by hand in a speckled stoneware clay.",
      price: 36,
      image:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
      featured: 0,
    },
    {
      name: "Field Notes Journal",
      category: "Stationery",
      description:
        "Lay-flat pages for ideas, lists, and everything in between.",
      price: 18,
      image:
        "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=85",
      featured: 0,
    },
    {
      name: "Moss Glass Vase",
      category: "Home",
      description:
        "A simple silhouette that lets your favorite stems take center stage.",
      price: 54,
      image:
        "https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=900&q=85",
      featured: 0,
    },
  ];
  const transaction = db.transaction(() =>
    seed.forEach((product) => insert.run(product)),
  );
  transaction();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "northstar-local-session",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);
app.use(express.static(path.join(__dirname, "public")));

function currentUser(req) {
  if (!req.session.userId) return null;
  return (
    db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(req.session.userId) || null
  );
}

function requireUser(req, res, next) {
  if (!currentUser(req))
    return res.status(401).json({ error: "Please log in to continue." });
  next();
}

app.get("/api/products", (req, res) => {
  const category = req.query.category;
  const products =
    category && category !== "All"
      ? db
          .prepare(
            "SELECT * FROM products WHERE category = ? ORDER BY featured DESC, id",
          )
          .all(category)
      : db.prepare("SELECT * FROM products ORDER BY featured DESC, id").all();
  res.json(products);
});

app.get("/api/products/:id", (req, res) => {
  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.json(product);
});

app.get("/api/me", (req, res) => res.json({ user: currentUser(req) }));

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res
      .status(400)
      .json({
        error:
          "Enter your name, a valid email, and a password of at least 6 characters.",
      });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)")
      .run(name.trim(), email.trim().toLowerCase(), hash);
    req.session.userId = result.lastInsertRowid;
    res.status(201).json({ user: currentUser(req) });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE")
      return res
        .status(409)
        .json({ error: "An account with that email already exists." });
    res.status(500).json({ error: "Unable to create your account." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get((email || "").trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.password))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  req.session.userId = user.id;
  res.json({ user: currentUser(req) });
});

app.post("/api/logout", (req, res) =>
  req.session.destroy(() => res.json({ success: true })),
);

app.post("/api/orders", requireUser, (req, res) => {
  const { items, shippingAddress } = req.body;
  if (!Array.isArray(items) || !items.length || !shippingAddress?.trim()) {
    return res
      .status(400)
      .json({ error: "Add items and a shipping address before checking out." });
  }
  const ids = items.map((item) => Number(item.productId)).filter(Boolean);
  const products = db
    .prepare(
      `SELECT * FROM products WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(...ids);
  const byId = new Map(products.map((product) => [product.id, product]));
  const normalized = items
    .map((item) => ({
      product: byId.get(Number(item.productId)),
      quantity: Math.max(1, Math.min(20, Number(item.quantity) || 1)),
    }))
    .filter((item) => item.product);
  if (!normalized.length)
    return res
      .status(400)
      .json({ error: "Your cart contains unavailable products." });
  const total = normalized.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const transaction = db.transaction(() => {
    const order = db
      .prepare(
        "INSERT INTO orders (user_id, total, shipping_address) VALUES (?, ?, ?)",
      )
      .run(req.session.userId, total, shippingAddress.trim());
    const insertItem = db.prepare(
      "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
    );
    normalized.forEach((item) =>
      insertItem.run(
        order.lastInsertRowid,
        item.product.id,
        item.quantity,
        item.product.price,
      ),
    );
    return order.lastInsertRowid;
  });
  res.status(201).json({ orderId: transaction(), total });
});

app.get("/api/orders", requireUser, (req, res) => {
  const orders = db
    .prepare(
      "SELECT id, total, status, shipping_address AS shippingAddress, created_at AS createdAt FROM orders WHERE user_id = ? ORDER BY id DESC",
    )
    .all(req.session.userId);
  res.json(orders);
});

app.get("/product/:id", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "product.html")),
);
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

app.listen(PORT, () =>
  console.log(`Northstar Market running at http://localhost:${PORT}`),
);
