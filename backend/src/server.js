import "dotenv/config";
import express from "express";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import multer from "multer";
import { nanoid } from "nanoid";
import { mkdir } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import { pool, rows, one } from "./db.js";
import { sendEmail, welcomeEmail, resetEmail } from "./email.js";
const app = express(),
  prod = process.env.NODE_ENV === "production",
  origins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((x) => x.trim());
const uploadsPath = fileURLToPath(new URL("../uploads/", import.meta.url));
await mkdir(uploadsPath, { recursive: true });
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(
  cors({
    origin: (o, cb) =>
      !o || origins.includes(o)
        ? cb(null, true)
        : cb(new Error("Origin not allowed")),
    credentials: true,
  }),
);
app.use(express.json({ limit: "300kb" }));
app.use(express.urlencoded({ extended: false }));
const cleanInput = (value, key = "") => {
  if (typeof value === "string") {
    const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    return key === "password" ? cleaned.slice(0, 200) : cleaned.trim().slice(0, 5000);
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => cleanInput(item));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([k, v]) => [k, cleanInput(v, k)]));
  return value;
};
app.use((req, res, next) => {
  req.body = cleanInput(req.body);
  next();
});
app.use("/uploads", express.static(uploadsPath, { maxAge: "7d" }));
const Store = MySQLStoreFactory(session),
  store = new Store({ createDatabaseTable: true }, pool);
app.use(
  session({
    name: "uk.sid",
    secret: process.env.SESSION_SECRET || "development-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: prod,
      sameSite: prod ? "none" : "lax",
      maxAge: 1209600000,
    },
  }),
);
const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: "draft-8",
  }),
  staff = (req, res, next) =>
    req.session.user && req.session.user.role !== "customer"
      ? next()
      : res.status(403).json({ error: "Staff access required" }),
  auth = (req, res, next) =>
    req.session.user
      ? next()
      : res.status(401).json({ error: "Sign in required" }),
  slugify = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 190),
  ok = (res, data) => res.json({ data });
const storage = multer.diskStorage({
    destination: uploadsPath,
    filename: (req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${nanoid(8)}${extname(file.originalname).toLowerCase()}`,
      ),
  }),
  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 16 },
    fileFilter: (req, f, cb) =>
      cb(
        null,
        ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
          f.mimetype,
        ),
      ),
  });
app.get("/api/health", async (req, res) => {
  await one("SELECT 1 ok");
  res.json({ status: "ok" });
});
app.post("/api/payments/mpesa/callback", async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback || req.body?.stkCallback || {};
    const metadata = Object.fromEntries((callback.CallbackMetadata?.Item || []).filter((item) => item.Name).map((item) => [item.Name, item.Value]));
    const orderNumber = String(metadata.AccountReference || metadata.OrderNumber || "");
    if (callback.ResultCode === 0 && (orderNumber || callback.CheckoutRequestID)) {
      await rows(`UPDATE orders SET payment_status='paid',status='paid',notes=CONCAT(COALESCE(notes,''), ?) WHERE ${orderNumber ? "order_number=?" : "notes LIKE ?"}`, orderNumber ? [`\nM-Pesa receipt: ${metadata.MpesaReceiptNumber || "confirmed"}`, orderNumber] : [`\nM-Pesa receipt: ${metadata.MpesaReceiptNumber || "confirmed"}`, `%${callback.CheckoutRequestID}%`]);
      const order = await one(`SELECT * FROM orders WHERE ${orderNumber ? "order_number=?" : "notes LIKE ?"} LIMIT 1`, orderNumber ? [orderNumber] : [`%${callback.CheckoutRequestID}%`]);
      if (order) {
        const receipt = `<h2>Payment received</h2><p>We have received your M-Pesa payment for order <b>${order.order_number}</b>.</p><p>Total paid: <b>KES ${Number(order.total).toLocaleString("en-KE")}</b></p><p>Thank you for choosing Uniform Kings.</p>`;
        if (order.email) sendEmail({ to: order.email, subject: `Payment received - ${order.order_number}`, html: receipt }).catch(console.error);
        if (process.env.ADMIN_EMAIL) sendEmail({ to: process.env.ADMIN_EMAIL, subject: `M-Pesa payment received - ${order.order_number}`, html: receipt }).catch(console.error);
      }
    }
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("M-Pesa callback error", error);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});
app.post("/api/payments/mpesa/initiate", auth, async (req, res, next) => {
  try {
    const required = ["MPESA_CONSUMER_KEY","MPESA_CONSUMER_SECRET","MPESA_SHORTCODE","MPESA_PASSKEY","MPESA_CALLBACK_URL"];
    if (required.some((key) => !process.env[key])) return res.status(503).json({ error: "M-Pesa is not configured yet. Add the Daraja credentials and public callback URL." });
    const order = await one(`SELECT * FROM orders WHERE order_number=? AND (user_id=? OR user_id IS NULL)`, [String(req.body.order_number || ""), req.session.user.id]);
    if (!order) return res.status(404).json({ error: "Order not found." });
    const environment = process.env.MPESA_ENVIRONMENT === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
    const authHeader = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
    const tokenResponse = await fetch(`${environment}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${authHeader}` } });
    if (!tokenResponse.ok) throw new Error("Unable to obtain an M-Pesa access token.");
    const token = (await tokenResponse.json()).access_token;
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");
    const phone = String(order.phone).replace(/\D/g, "").replace(/^0/, "254").replace(/^\+/, "");
    const request = await fetch(`${environment}/mpesa/stkpush/v1/processrequest`, { method:"POST", headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}, body:JSON.stringify({BusinessShortCode:process.env.MPESA_SHORTCODE,Password:password,Timestamp:timestamp,TransactionType:"CustomerPayBillOnline",Amount:Math.max(1,Math.round(order.total)),PartyA:phone,PartyB:process.env.MPESA_SHORTCODE,PhoneNumber:phone,CallBackURL:process.env.MPESA_CALLBACK_URL,AccountReference:order.order_number,TransactionDesc:"Uniform Kings order"}) });
    const data = await request.json();
    if (!request.ok || data.ResponseCode !== "0") return res.status(400).json({ error: data.errorMessage || data.ResponseDescription || "M-Pesa did not accept the payment request." });
    await rows(`UPDATE orders SET notes=CONCAT(COALESCE(notes,''), ?) WHERE id=?`, [`\nM-Pesa CheckoutRequestID: ${data.CheckoutRequestID}`,order.id]);
    ok(res, { message:"M-Pesa prompt sent to the customer phone.", checkout_request_id:data.CheckoutRequestID });
  } catch (error) { next(error); }
});
app.get("/api/config", async (req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    const data = (await one(`SELECT MAX(CASE WHEN setting_key='site_name' THEN setting_value END) site_name,MAX(CASE WHEN setting_key='whatsapp_number' THEN setting_value END) whatsapp_number,MAX(CASE WHEN setting_key='contact_phone' THEN setting_value END) contact_phone,MAX(CASE WHEN setting_key='contact_email' THEN setting_value END) contact_email FROM settings`)) || {};
    data.categories = await rows(`SELECT name,slug FROM categories WHERE is_active=1 ORDER BY sort_order,name LIMIT 6`);
    ok(res, data);
  } catch (e) { next(e); }
});
app.get("/api/catalog/home", async (req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    const [products, categories, schools, heroImages] = await Promise.all([
      rows(
        `SELECT p.*,i.image_path,(SELECT GROUP_CONCAT(image_path ORDER BY sort_order,id SEPARATOR '|') FROM product_images WHERE product_id=p.id) image_paths,c.name category_name,c.slug category_slug,s.name school_name FROM products p LEFT JOIN product_images i ON i.id=(SELECT MIN(id) FROM product_images WHERE product_id=p.id) JOIN categories c ON c.id=p.category_id AND c.is_active=1 LEFT JOIN schools s ON s.id=p.school_id WHERE p.status='active' ORDER BY c.sort_order,c.name,p.is_featured DESC,p.is_new DESC,p.updated_at DESC LIMIT 600`,
      ),
      rows(
        `SELECT c.* FROM categories c WHERE c.is_active=1 AND EXISTS(SELECT 1 FROM products p WHERE p.category_id=c.id AND p.status='active') ORDER BY c.sort_order,c.name LIMIT 12`,
      ),
      rows(
        `SELECT * FROM schools WHERE is_active=1 AND is_featured=1 ORDER BY name LIMIT 8`,
      ),
      rows(`SELECT image_path,mobile_image_path,alt_text FROM hero_images WHERE is_active=1 ORDER BY sort_order,id LIMIT 8`),
    ]);
    ok(res, { products, categories, schools, heroImages });
  } catch (e) {
    next(e);
  }
});
app.get("/api/products", async (req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=180");
    const q = String(req.query.q || "").trim(),
      category = String(req.query.category || ""),
      school = String(req.query.school || ""),
      offer = String(req.query.offer || "") === "1";
    let w = [`p.status='active'`],
      p = [];
    if (q) {
      w.push(`(p.name LIKE ? OR p.sku LIKE ? OR s.name LIKE ?)`);
      p.push(...Array(3).fill(`%${q}%`));
    }
    if (category) {
      w.push("c.slug=?");
      p.push(category);
    }
    if (school) {
      w.push("s.slug=?");
      p.push(school);
    }
    if (offer) w.push(`p.compare_price IS NOT NULL AND p.compare_price>p.price`);
    ok(
      res,
      await rows(
        `SELECT p.*,i.image_path,(SELECT GROUP_CONCAT(image_path ORDER BY sort_order,id SEPARATOR '|') FROM product_images WHERE product_id=p.id) image_paths,c.name category_name,s.name school_name FROM products p LEFT JOIN product_images i ON i.id=(SELECT MIN(id) FROM product_images WHERE product_id=p.id) LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN schools s ON s.id=p.school_id WHERE ${w.join(" AND ")} ORDER BY p.is_featured DESC,p.created_at DESC LIMIT 100`,
        p,
      ),
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/products/:slug", async (req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    const p = await one(
      `SELECT p.*,c.name category_name,s.name school_name FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN schools s ON s.id=p.school_id WHERE p.slug=? AND p.status='active'`,
      [req.params.slug],
    );
    if (!p) return res.status(404).json({ error: "Product not found" });
    p.images = await rows(
      `SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order,id`,
      [p.id],
    );
    p.variants = await rows(
      `SELECT id,size,colour,sku,stock,price_adjustment FROM product_variants WHERE product_id=? AND is_active=1 ORDER BY size,colour`,
      [p.id],
    );
    p.variants = p.variants.map((variant) => ({ ...variant, stock: p.stock }));
    ok(res, p);
  } catch (e) {
    next(e);
  }
});
app.get("/api/filters", async (req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    const [categories, schools] = await Promise.all([
      rows(
        `SELECT id,name,slug FROM categories WHERE is_active=1 ORDER BY name`,
      ),
      rows(
        `SELECT id,name,slug,location FROM schools WHERE is_active=1 ORDER BY name`,
      ),
    ]);
    ok(res, { categories, schools });
  } catch (e) {
    next(e);
  }
});
app.post("/api/auth/register", limit, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim(),
      email = String(req.body.email || "")
        .trim()
        .toLowerCase(),
      password = String(req.body.password || "");
    if (name.length < 2 || !email.includes("@") || password.length < 8)
      return res
        .status(422)
        .json({
          error:
            "Enter your name, a valid email and at least 8 password characters.",
        });
    const hash = await bcrypt.hash(password, 12),
      r = await rows(
        `INSERT INTO users(name,email,password_hash) VALUES(?,?,?)`,
        [name, email, hash],
      );
    req.session.user = { id: r.insertId, name, email, role: "customer" };
    sendEmail({ to: email, subject: "Welcome to Uniform Kings", html: welcomeEmail(name) }).catch(console.error);
    ok(res, req.session.user);
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ error: "An account already exists for that email." });
    next(e);
  }
});
app.post("/api/auth/login", limit, async (req, res, next) => {
  try {
    const u = await one(`SELECT * FROM users WHERE email=?`, [
      String(req.body.email || "")
        .trim()
        .toLowerCase(),
    ]);
    if (
      !u ||
      u.status !== "active" ||
      !(await bcrypt.compare(String(req.body.password || ""), u.password_hash))
    )
      return res.status(401).json({ error: "Email or password is incorrect." });
    req.session.user = { id: u.id, name: u.name, email: u.email, role: u.role };
    await rows(`UPDATE users SET last_login_at=NOW() WHERE id=?`, [u.id]);
    ok(res, req.session.user);
  } catch (e) {
    next(e);
  }
});
app.post("/api/auth/logout", (req, res) =>
  req.session.destroy(() => ok(res, true)),
);
app.get("/api/auth/me", (req, res) => ok(res, req.session.user || null));
app.post("/api/auth/forgot-password", limit, async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase();
    const user = await one(`SELECT id,name,email FROM users WHERE email=? AND status='active'`, [email]);
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await rows(`UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL`, [user.id]);
      await rows(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))`, [user.id, tokenHash]);
      const url = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;
      sendEmail({ to: user.email, subject: "Reset your Uniform Kings password", html: resetEmail(user.name, url) }).catch(console.error);
    }
    ok(res, { message: "If that email is registered, a password-reset link has been sent." });
  } catch (e) { next(e); }
});
app.post("/api/auth/reset-password", limit, async (req, res, next) => {
  try {
    const token = String(req.body.token || ""), password = String(req.body.password || "");
    if (token.length !== 64 || password.length < 8) return res.status(422).json({ error: "Use the secure reset link and a password of at least 8 characters." });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const reset = await one(`SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW()`, [hash]);
    if (!reset) return res.status(400).json({ error: "This reset link has expired or has already been used." });
    await rows(`UPDATE users SET password_hash=? WHERE id=?`, [await bcrypt.hash(password, 12), reset.user_id]);
    await rows(`UPDATE password_reset_tokens SET used_at=NOW() WHERE id=?`, [reset.id]);
    ok(res, true);
  } catch (e) { next(e); }
});
app.get("/api/account/orders", auth, async (req, res, next) => {
  try {
    ok(
      res,
      await rows(
        `SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC`,
        [req.session.user.id],
      ),
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/checkout/methods", async (req, res, next) => {
  try {
    ok(
      res,
      await rows(
        `SELECT code,name,instructions,config_json,is_default FROM checkout_methods WHERE is_enabled=1 ORDER BY is_default DESC,sort_order,name`,
      ),
    );
  } catch (e) {
    next(e);
  }
});
app.post("/api/orders", limit, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [],
      method = await one(
        `SELECT * FROM checkout_methods WHERE code=? AND is_enabled=1`,
        [req.body.checkout_method],
      );
    if (!items.length || !method)
      return res
        .status(422)
        .json({ error: "Your cart or checkout method is invalid." });
    await c.beginTransaction();
    let subtotal = 0,
      verified = [];
    for (const item of items) {
      const [[v]] = await c.execute(
        `SELECT v.*,p.name,p.id product_id,p.status,p.stock product_stock,p.price FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? FOR UPDATE`,
        [item.variant_id],
      );
      const qty = Math.max(1, Math.min(+item.quantity || 1, 50));
      if (!v || v.status !== "active" || v.product_stock < qty)
        throw new Error("An item is unavailable in the selected quantity.");
      const price = +v.price_adjustment + +v.price;
      subtotal += price * qty;
      verified.push({ ...v, quantity: qty, price });
      await c.execute(`UPDATE products SET stock=stock-? WHERE id=?`, [qty, v.product_id]);
    }
    const num =
      "UK-" +
      new Date().toISOString().slice(2, 10).replaceAll("-", "") +
      "-" +
      nanoid(6).toUpperCase();
    const [o] = await c.execute(
      `INSERT INTO orders(order_number,user_id,customer_name,email,phone,delivery_method,delivery_address,checkout_method,subtotal,total,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [
        num,
        req.session.user?.id || null,
        String(req.body.name || "").trim(),
        String(req.body.email || "")
          .trim()
          .toLowerCase(),
        String(req.body.phone || "").trim(),
        String(req.body.delivery_method || "").trim(),
        String(req.body.address || "").trim(),
        method.code,
        subtotal,
        subtotal,
        String(req.body.notes || "").trim(),
      ],
    );
    for (const v of verified) {
      await c.execute(
        `INSERT INTO order_items(order_id,product_id,variant_id,product_name,sku,size,colour,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [
          o.insertId,
          v.product_id,
          v.id,
          v.name,
          v.sku,
          v.size,
          v.colour,
          v.quantity,
          v.price,
          v.price * v.quantity,
        ],
      );
    }
    await c.commit();
    ok(res, { order_number: num, checkout_method: method });
  } catch (e) {
    await c.rollback();
    next(e);
  } finally {
    c.release();
  }
});
app.get("/api/admin/dashboard", staff, async (req, res, next) => {
  try {
    const stats = await one(
        `SELECT (SELECT COALESCE(SUM(total),0) FROM orders WHERE payment_status='paid') total_sales,(SELECT COALESCE(SUM(total),0) FROM orders WHERE payment_status='paid' AND DATE(created_at)=CURDATE()) today_sales,(SELECT COUNT(*) FROM orders) total_orders,(SELECT COUNT(*) FROM orders WHERE status='pending_payment') pending_orders,(SELECT COUNT(*) FROM users WHERE role='customer') customers,(SELECT COUNT(*) FROM products WHERE status='active') products,(SELECT COUNT(*) FROM products WHERE stock<=5 AND status='active') low_stock`,
      ),
      recent = await rows(
        `SELECT * FROM orders ORDER BY created_at DESC LIMIT 10`,
      ),
      sales = await rows(
        `SELECT DATE(created_at) day,SUM(total) total FROM orders WHERE payment_status='paid' AND created_at>=DATE_SUB(CURDATE(),INTERVAL 13 DAY) GROUP BY DATE(created_at) ORDER BY day`,
      );
    ok(res, { stats, recent, sales });
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/products", staff, async (req, res, next) => {
  try {
    ok(
      res,
      await rows(
        `SELECT p.*,c.name category_name,s.name school_name FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN schools s ON s.id=p.school_id ORDER BY p.updated_at DESC`,
      ),
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/products/:id", staff, async (req, res, next) => {
  try {
    const product = await one(`SELECT * FROM products WHERE id=?`, [+req.params.id]);
    if (!product) return res.status(404).json({ error: "Product not found." });
    product.images = await rows(`SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order,id`, [product.id]);
    product.variants = await rows(`SELECT id,size,colour FROM product_variants WHERE product_id=? AND is_active=1 ORDER BY size,colour`, [product.id]);
    ok(res, product);
  } catch (e) { next(e); }
});
app.get("/api/admin/categories", staff, async (req, res, next) => {
  try { ok(res, await rows(`SELECT * FROM categories ORDER BY sort_order,name`)); } catch (e) { next(e); }
});
app.post("/api/admin/categories", staff, async (req, res, next) => {
  try {
    const b = req.body, name = String(b.name || "");
    if (name.length < 2) return res.status(422).json({ error: "Enter a category name." });
    const result = await rows(`INSERT INTO categories(name,slug,description,is_active,sort_order) VALUES(?,?,?,?,?)`, [name, slugify(b.slug || name), b.description || null, b.is_active === false ? 0 : 1, +b.sort_order || 0]);
    ok(res, { id: result.insertId });
  } catch (e) { next(e); }
});
app.patch("/api/admin/categories/:id", staff, async (req, res, next) => {
  try { const b=req.body; await rows(`UPDATE categories SET name=?,slug=?,description=?,is_active=?,sort_order=? WHERE id=?`, [b.name,slugify(b.slug||b.name),b.description||null,b.is_active?1:0,+b.sort_order||0,+req.params.id]); ok(res,true); } catch(e){next(e);}
});
app.get("/api/admin/schools", staff, async (req, res, next) => {
  try { ok(res, await rows(`SELECT * FROM schools ORDER BY name`)); } catch (e) { next(e); }
});
app.post("/api/admin/schools", staff, async (req, res, next) => {
  try {
    const b=req.body, name=String(b.name||"");
    if(name.length<2)return res.status(422).json({error:"Enter a school name."});
    const result=await rows(`INSERT INTO schools(name,slug,location,school_type,description,is_featured,is_active) VALUES(?,?,?,?,?,?,?)`,[name,slugify(b.slug||name),b.location||null,b.school_type||null,b.description||null,b.is_featured?1:0,b.is_active===false?0:1]);
    ok(res,{id:result.insertId});
  }catch(e){next(e);}
});
app.patch("/api/admin/schools/:id", staff, async (req,res,next)=>{
  try{const b=req.body;await rows(`UPDATE schools SET name=?,slug=?,location=?,school_type=?,description=?,is_featured=?,is_active=? WHERE id=?`,[b.name,slugify(b.slug||b.name),b.location||null,b.school_type||null,b.description||null,b.is_featured?1:0,b.is_active?1:0,+req.params.id]);ok(res,true);}catch(e){next(e);}
});
app.post("/api/admin/products", staff, async (req, res, next) => {
  try {
    const b = req.body,
      r = await rows(
        `INSERT INTO products(category_id,school_id,name,slug,sku,short_description,description,price,compare_price,stock,status,is_featured,is_new,seo_title,seo_description) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.category_id || null,
          b.school_id || null,
          b.name,
          slugify(b.slug || b.name),
          b.sku || `UK-${nanoid(10).toUpperCase()}`,
          b.short_description || null,
          b.description || null,
          +b.price || 0,
          +b.compare_price || null,
          Math.max(0, +b.stock || 0),
          b.status || "draft",
          b.is_featured ? 1 : 0,
          b.is_new ? 1 : 0,
          b.seo_title || null,
          b.seo_description || null,
        ],
      );
    ok(res, { id: r.insertId });
  } catch (e) {
    next(e);
  }
});
app.patch("/api/admin/products/:id", staff, async (req, res, next) => {
  try {
    const b = req.body;
    if (String(b.name || "").trim().length < 2) return res.status(422).json({ error: "A product name is required." });
    await rows(`UPDATE products SET category_id=?,school_id=?,name=?,slug=?,short_description=?,description=?,price=?,compare_price=?,stock=?,status=?,is_featured=?,is_new=?,seo_title=?,seo_description=? WHERE id=?`, [b.category_id||null,b.school_id||null,b.name,slugify(b.slug||b.name),b.short_description||null,b.description||null,+b.price||0,+b.compare_price||null,Math.max(0,+b.stock||0),b.status||"draft",b.is_featured?1:0,b.is_new?1:0,b.seo_title||null,b.seo_description||null,+req.params.id]);
    ok(res, true);
  } catch (e) { next(e); }
});
app.post(
  "/api/admin/products/:id/images",
  staff,
  upload.array("images", 16),
  async (req, res, next) => {
    try {
      for (const [i, f] of req.files.entries())
        await rows(
          `INSERT INTO product_images(product_id,image_path,alt_text,sort_order) VALUES(?,?,?,?)`,
          [req.params.id, `/uploads/${f.filename}`, req.body.alt_text || "", i],
        );
      ok(res, true);
    } catch (e) {
      next(e);
    }
  },
);
app.post("/api/admin/products/:id/variants", staff, async (req, res, next) => {
  try {
    const b = req.body;
    const variants = Array.isArray(b.variants) ? b.variants : [b];
    if (!variants.length || variants.length > 100) return res.status(422).json({ error: "Add between 1 and 100 options." });
    const created = [];
    for (const variant of variants) {
      const r = await rows(
        `INSERT INTO product_variants(product_id,size,colour,sku,stock,low_stock_level,price_adjustment) VALUES(?,?,?,?,?,?,?)`,
        [req.params.id, variant.size || "", variant.colour || "", variant.sku || `UKV-${nanoid(10).toUpperCase()}`, 0, +variant.low_stock_level || 5, +variant.price_adjustment || 0],
      );
      created.push(r.insertId);
    }
    ok(res, { ids: created });
  } catch (e) {
    next(e);
  }
});
app.put("/api/admin/products/:id/variants", staff, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    if (!variants.length || variants.length > 100) return res.status(422).json({ error: "Add between 1 and 100 options." });
    await c.beginTransaction();
    await c.execute(`DELETE FROM product_variants WHERE product_id=?`, [+req.params.id]);
    for (const variant of variants) await c.execute(
      `INSERT INTO product_variants(product_id,size,colour,sku,stock,low_stock_level,price_adjustment) VALUES(?,?,?,?,0,5,0)`,
      [+req.params.id, String(variant.size || "").trim(), String(variant.colour || "").trim(), `UKV-${nanoid(10).toUpperCase()}`],
    );
    await c.commit(); ok(res, true);
  } catch (e) { await c.rollback(); next(e); } finally { c.release(); }
});
app.get("/api/admin/orders", staff, async (req, res, next) => {
  try {
    ok(
      res,
      await rows(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 300`),
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/orders/:id", staff, async (req, res, next) => {
  try {
    const order = await one(`SELECT * FROM orders WHERE id=?`, [+req.params.id]);
    if (!order) return res.status(404).json({ error: "Order not found." });
    order.items = await rows(`SELECT * FROM order_items WHERE order_id=? ORDER BY id`, [order.id]);
    ok(res, order);
  } catch (e) { next(e); }
});
app.get("/api/admin/orders/:id/pdf", staff, async (req, res, next) => {
  try {
    const order = await one(`SELECT * FROM orders WHERE id=?`, [+req.params.id]);
    if (!order) return res.status(404).json({ error: "Order not found." });
    const items = await rows(`SELECT * FROM order_items WHERE order_id=? ORDER BY id`, [order.id]);
    const thermal = req.query.format === "thermal";
    const doc = new PDFDocument({ size: thermal ? [226.77, 841.89] : "A4", margin: thermal ? 14 : 45 });
    const buyerName = String(order.customer_name || "walk-in-customer").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "walk-in-customer";
    const filename = `${thermal ? "receipt" : "invoice"}-${buyerName}-${order.order_number}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const label = (text, value) => { doc.font("Helvetica").fontSize(thermal ? 7 : 10).text(text, { continued: true }).font("Helvetica-Bold").text(value, { align: "right" }); };
    if (!thermal) { doc.rect(0, 0, doc.page.width, 132).fill("#f0e8da"); doc.y = 45; }
    doc.font("Helvetica-Bold").fontSize(thermal ? 13 : 22).fillColor("#23385d").text("UNIFORM KINGS", { align: "center" });
    doc.font("Helvetica").fontSize(thermal ? 6 : 9).fillColor("#667085").text("QUALITY UNIFORMS - PROUD FUTURES", { align: "center" });
    doc.moveDown(.55).fillColor(thermal ? "#172033" : "#a56f5d").font("Helvetica-Bold").fontSize(thermal ? 9 : 15).text(thermal ? "SALES RECEIPT" : "TAX INVOICE", { align: "center" });
    doc.font("Helvetica").fontSize(thermal ? 7 : 10).text(order.order_number, { align: "center" }).text(new Date(order.created_at).toLocaleString("en-KE"), { align: "center" });
    doc.moveDown(.8).strokeColor(thermal ? "#d9dee7" : "#a56f5d").lineWidth(thermal ? 1 : 2).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width-doc.page.margins.right,doc.y).stroke().lineWidth(1).moveDown(.6);
    if (!thermal) { doc.font("Helvetica-Bold").fontSize(10).text("Billed to"); doc.font("Helvetica").text(order.customer_name); if(order.phone) doc.text(order.phone); if(order.email) doc.text(order.email); doc.moveDown(.6); }
    const left = doc.page.margins.left, columns = thermal
      ? { item: width*.48, qty: width*.11, price: width*.19, total: width*.22 }
      : { item: width*.53, qty: width*.10, price: width*.17, total: width*.20 };
    const xQty = left + columns.item, xPrice = xQty + columns.qty, xTotal = xPrice + columns.price;
    let tableY = doc.y;
    doc.rect(left, tableY, width, thermal ? 17 : 23).fill(thermal ? "#23385d" : "#a56f5d");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(thermal ? 6 : 9)
      .text("ITEM", left + 4, tableY + (thermal ? 5 : 7), { width:columns.item-6 })
      .text("QTY", xQty, tableY + (thermal ? 5 : 7), { width:columns.qty, align:"center" })
      .text("PRICE", xPrice, tableY + (thermal ? 5 : 7), { width:columns.price-3, align:"right" })
      .text("TOTAL", xTotal, tableY + (thermal ? 5 : 7), { width:columns.total-4, align:"right" });
    tableY += thermal ? 17 : 23;
    items.forEach((item, index) => {
      const variant = [item.size,item.colour].filter(Boolean).join(" / ") || "Standard";
      const itemHeight = Math.max(thermal ? 30 : 34, doc.heightOfString(item.product_name, { width:columns.item-8 }) + (thermal ? 15 : 17));
      doc.rect(left, tableY, width, itemHeight).fill(index % 2 ? (thermal ? "#edf1f6" : "#f3ebe3") : (thermal ? "#fafbfd" : "#fffaf5"));
      doc.fillColor("#172033").font("Helvetica-Bold").fontSize(thermal ? 6.4 : 9).text(item.product_name, left+4, tableY+5, { width:columns.item-8 });
      doc.fillColor("#667085").font("Helvetica").fontSize(thermal ? 5.5 : 7.5).text(variant, left+4, tableY+itemHeight-(thermal ? 11 : 13), { width:columns.item-8 });
      doc.fillColor("#172033").font("Helvetica").fontSize(thermal ? 6 : 8.5).text(String(item.quantity), xQty, tableY+8, { width:columns.qty, align:"center" });
      doc.text(Number(item.unit_price).toLocaleString("en-KE"), xPrice, tableY+8, { width:columns.price-3, align:"right" });
      doc.font("Helvetica-Bold").text(Number(item.line_total).toLocaleString("en-KE"), xTotal, tableY+8, { width:columns.total-4, align:"right" });
      tableY += itemHeight;
    });
    doc.y = tableY + 5;
    doc.moveDown(.45).strokeColor("#d9dee7").moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.width-doc.page.margins.right,doc.y).stroke().moveDown(.55);
    label("Subtotal  ", `KES ${Number(order.subtotal).toLocaleString("en-KE")}`); if(+order.delivery_fee) label("Delivery  ", `KES ${Number(order.delivery_fee).toLocaleString("en-KE")}`);
    doc.moveDown(.45); const totalY = doc.y;
    doc.fillColor("#172033").font("Helvetica-Bold").fontSize(thermal ? 9 : 14).text("TOTAL PAID", left, totalY, { width:width*.5 });
    doc.text(`KES ${Number(order.total).toLocaleString("en-KE")}`, left+width*.5, totalY, { width:width*.5, align:"right" });
    doc.y = totalY + (thermal ? 22 : 28);
    doc.font("Helvetica").fontSize(thermal ? 6 : 9).fillColor("#667085").text("Thank you for choosing Uniform Kings.", left, doc.y, { width, align:"center" }).text("Keep this receipt as proof of purchase.", left, doc.y, { width, align:"center" });
    doc.end();
  } catch (e) { next(e); }
});
app.post("/api/admin/walkins", staff, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(422).json({ error: "Add at least one item to the walk-in sale." });
    await c.beginTransaction();
    let total = 0; const verified = [];
    for (const item of items) {
      const [[v]] = await c.execute(`SELECT v.*,p.name,p.id product_id,p.price,p.status,p.stock product_stock FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? FOR UPDATE`, [+item.variant_id]);
      const quantity = Math.max(1, Math.min(+item.quantity || 1, 50));
      if (!v || v.status !== "active" || v.product_stock < quantity) throw new Error("One of the selected options is no longer available in that quantity.");
      const price = +v.price + +v.price_adjustment;
      total += price * quantity; verified.push({ ...v, quantity, price });
      await c.execute(`UPDATE products SET stock=stock-? WHERE id=?`, [quantity, v.product_id]);
    }
    const orderNumber = `WK-${new Date().toISOString().slice(2,10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;
    const [created] = await c.execute(`INSERT INTO orders(order_number,customer_name,email,phone,delivery_method,delivery_address,checkout_method,status,payment_status,subtotal,total,notes) VALUES(?,?,?,?,?,'','walkin','completed','paid',?,?,?)`, [orderNumber, String(req.body.customer_name || "Walk-in customer"), String(req.body.email || ""), String(req.body.phone || ""), "Walk-in sale", total, total, String(req.body.notes || "")]);
    for (const v of verified) {
      await c.execute(`INSERT INTO order_items(order_id,product_id,variant_id,product_name,sku,size,colour,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?,?,?,?)`, [created.insertId,v.product_id,v.id,v.name,v.sku,v.size,v.colour,v.quantity,v.price,v.price*v.quantity]);
    }
    await c.execute(`INSERT INTO audit_logs(user_id,action,entity_type,entity_id,ip_address) VALUES(?,?,?,?,?)`, [req.session.user.id,"walkin_sale_created","order",created.insertId,req.ip]);
    await c.commit(); ok(res, { id: created.insertId, order_number: orderNumber });
  } catch (e) { await c.rollback(); next(e); } finally { c.release(); }
});
app.patch("/api/admin/orders/:id", staff, async (req, res, next) => {
  try {
    const current = await one(`SELECT status FROM orders WHERE id=?`, [+req.params.id]);
    if (!current) return res.status(404).json({ error: "Order not found." });
    if (current.status === "completed") return res.status(409).json({ error: "Completed orders are locked from editing." });
    const allowedStatus = ["pending_payment","paid","processing","awaiting_personalisation","ready_dispatch","dispatched","ready_pickup","delivered","completed","cancelled","refunded"];
    const allowedPayment = ["pending","paid","failed","refunded"];
    if (!allowedStatus.includes(req.body.status) || !allowedPayment.includes(req.body.payment_status)) return res.status(422).json({ error: "Choose a valid order and payment status." });
    if (req.body.status === "completed") req.body.payment_status = "paid";
    await rows(`UPDATE orders SET customer_name=?,phone=?,email=?,delivery_address=?,status=?,payment_status=? WHERE id=?`, [
      String(req.body.customer_name || "Walk-in customer"), String(req.body.phone || ""), String(req.body.email || ""), String(req.body.delivery_address || ""), req.body.status, req.body.payment_status, +req.params.id,
    ]);
    await rows(
      `INSERT INTO audit_logs(user_id,action,entity_type,entity_id,ip_address) VALUES(?,?,?,?,?)`,
      [
        req.session.user.id,
        "order_status_updated",
        "order",
        req.params.id,
        req.ip,
      ],
    );
    ok(res, true);
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/checkout", staff, async (req, res, next) => {
  try {
    ok(
      res,
      await rows(`SELECT * FROM checkout_methods ORDER BY sort_order,name`),
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/hero-images", staff, async (req, res, next) => {
  try { ok(res, await rows(`SELECT * FROM hero_images ORDER BY sort_order,id`)); } catch (e) { next(e); }
});
app.post("/api/admin/hero-images", staff, upload.fields([{ name:"desktop_image", maxCount:1 }, { name:"mobile_image", maxCount:1 }]), async (req, res, next) => {
  try {
    const desktop = req.files?.desktop_image?.[0], mobile = req.files?.mobile_image?.[0];
    if (!desktop) return res.status(422).json({ error:"A desktop hero image is required." });
    const result = await rows(`INSERT INTO hero_images(image_path,mobile_image_path,alt_text,sort_order,is_active) VALUES(?,?,?,?,1)`, [`/uploads/${desktop.filename}`, mobile ? `/uploads/${mobile.filename}` : null, String(req.body.alt_text||"Uniform Kings collection"), +req.body.sort_order||0]);
    ok(res, { id:result.insertId });
  } catch (e) { next(e); }
});
app.patch("/api/admin/hero-images/:id", staff, async (req, res, next) => {
  try { await rows(`UPDATE hero_images SET is_active=? WHERE id=?`, [req.body.is_active?1:0,+req.params.id]); ok(res,true); } catch (e) { next(e); }
});
app.delete("/api/admin/hero-images/:id", staff, async (req, res, next) => {
  try { await rows(`DELETE FROM hero_images WHERE id=?`, [+req.params.id]); ok(res,true); } catch (e) { next(e); }
});
app.get("/api/admin/settings", staff, async (req, res, next) => {
  try {
    const data = await rows("SELECT setting_key,setting_value FROM settings WHERE setting_key IN ('site_name','contact_phone','contact_email','whatsapp_number')");
    ok(res, Object.fromEntries(data.map((row) => [row.setting_key, row.setting_value || ""])));
  } catch (e) { next(e); }
});
app.patch("/api/admin/settings", staff, async (req, res, next) => {
  try {
    const allowed = ["site_name", "contact_phone", "contact_email", "whatsapp_number"];
    for (const key of allowed) {
      if (Object.hasOwn(req.body, key)) await rows("INSERT INTO settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [key, String(req.body[key] || "").trim()]);
    }
    ok(res, true);
  } catch (e) { next(e); }
});
app.patch("/api/admin/checkout/:id", staff, async (req, res, next) => {
  const c = await pool.getConnection();
  try {
    const b = req.body;
    await c.beginTransaction();
    if (b.is_default) await c.execute(`UPDATE checkout_methods SET is_default=FALSE`);
    await c.execute(
      `UPDATE checkout_methods SET name=?,instructions=?,is_enabled=?,is_default=?,config_json=? WHERE id=?`,
      [
        b.name,
        b.instructions || null,
        b.is_enabled ? 1 : 0,
        b.is_enabled && b.is_default ? 1 : 0,
        JSON.stringify(b.config || {}),
        req.params.id,
      ],
    );
    await c.commit();
    if (b.config?.whatsapp_number)
      await rows(
        `INSERT INTO settings(setting_key,setting_value) VALUES('whatsapp_number',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
        [b.config.whatsapp_number],
      );
    ok(res, true);
  } catch (e) {
    await c.rollback();
    next(e);
  } finally {
    c.release();
  }
});
app.get("/api/seo/merchant-feed.xml", async (_req, res, next) => {
  try {
    const website = String(process.env.FRONTEND_URL || "https://uniformkings.co.ke").split(",")[0].replace(/\/$/, "");
    const api = String(process.env.API_URL || "https://api.uniformkings.co.ke").replace(/\/$/, "");
    const xml = (value) => String(value ?? "").replace(/[<>&'\"]/g, (character) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '\"':"&quot;" })[character]);
    const products = await rows(`SELECT p.id,p.name,p.slug,p.short_description,p.description,p.price,p.stock,p.sku,c.name category_name,i.image_path FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN product_images i ON i.id=(SELECT MIN(id) FROM product_images WHERE product_id=p.id) WHERE p.status='active' AND i.image_path IS NOT NULL ORDER BY p.updated_at DESC`);
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Uniform Kings Kenya</title><link>${xml(website)}</link><description>School uniforms, shoes, sportswear and professional uniforms in Kenya.</description>${products.map((product) => `<item><g:id>${xml(product.sku || product.id)}</g:id><g:title>${xml(product.name)}</g:title><g:description>${xml(product.short_description || product.description || `${product.name} from Uniform Kings Kenya.`)}</g:description><g:link>${xml(`${website}/product/${product.slug}`)}</g:link><g:image_link>${xml(`${api}${product.image_path}`)}</g:image_link><g:availability>${+product.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability><g:price>${Number(product.price).toFixed(2)} KES</g:price><g:condition>new</g:condition><g:brand>Uniform Kings</g:brand><g:product_type>${xml(product.category_name || "Uniforms")}</g:product_type></item>`).join("")}</channel></rss>`);
  } catch (error) { next(error); }
});

app.get("/api/seo/sitemap.xml", async (_req, res, next) => {
  try {
    const website = String(process.env.FRONTEND_URL || "https://uniformkings.co.ke").split(",")[0].replace(/\/$/, "");
    const xml = (value) => String(value).replace(/[<>&'\"]/g, (character) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '\"':"&quot;" })[character]);
    const [products, categories] = await Promise.all([
      rows("SELECT slug,updated_at FROM products WHERE status='active' ORDER BY updated_at DESC"),
      rows("SELECT slug,created_at AS updated_at FROM categories WHERE is_active=1 ORDER BY sort_order,name"),
    ]);
    const urls = [
      ["/", new Date(), "daily", "1.0"],
      ["/shop", new Date(), "daily", "0.9"],
      ["/about", new Date(), "monthly", "0.6"],
      ["/delivery", new Date(), "monthly", "0.5"],
      ["/returns", new Date(), "monthly", "0.5"],
      ["/privacy", new Date(), "yearly", "0.3"],
      ...categories.map((category) => [`/shop?category=${encodeURIComponent(category.slug)}`, category.updated_at, "weekly", "0.8"]),
      ...products.map((product) => [`/product/${encodeURIComponent(product.slug)}`, product.updated_at, "weekly", "0.9"]),
    ];
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([path,date,frequency,priority]) => `<url><loc>${xml(website + path)}</loc><lastmod>${new Date(date || Date.now()).toISOString()}</lastmod><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`).join("")}</urlset>`);
  } catch (error) { next(error); }
});

app.use((req, res) => res.status(404).json({ error: "API route not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.code === "ER_DUP_ENTRY" ? 409 : 500)
    .json({
      error: prod ? "Something went wrong. Please try again." : err.message,
    });
});
export default app;

if (process.env.UNIFORM_KINGS_PASSENGER !== "1") {
  app.listen(+(process.env.PORT || 3001), () =>
    console.log(
      `Uniform Kings API: http://localhost:${process.env.PORT || 3001}`,
    ),
  );
}
