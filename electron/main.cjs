const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");
const { fileURLToPath } = require("url");
const Database = require("better-sqlite3");

const userDir = app.getPath("userData");
const db = new Database(path.join(userDir, "pos_data.db"));
const themePath = path.join(userDir, "theme.json");
const SETUP_PIN = "827123";
const DEFAULT_THEME = {
  primary: "#2E7D32",
  secondary: "#FFFFFF",
  background: "#F5F5F5",
};
function initDb(pin) {
  if (pin !== SETUP_PIN) throw new Error("Incorrect setup PIN.");
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS store_profile (id INTEGER PRIMARY KEY CHECK(id=1), company_name TEXT, business_trade TEXT, address TEXT, phone_no TEXT, mail TEXT, logo_path TEXT, message_at_end TEXT);
    CREATE TABLE IF NOT EXISTS categories (category_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image_path TEXT, sorting_level INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS suppliers (supplier_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone_no TEXT, email TEXT, address TEXT, credit_limit REAL DEFAULT 0, current_balance REAL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS supplier_payments (payment_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT DEFAULT CURRENT_TIMESTAMP, supplier_id INTEGER, amount_paid REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (customer_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, current_balance REAL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS customer_payments (payment_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT DEFAULT CURRENT_TIMESTAMP, customer_id INTEGER, amount_paid REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, category_id INTEGER, supplier_id INTEGER, item_name TEXT NOT NULL, description TEXT, purchase_price REAL DEFAULT 0, selling_price REAL DEFAULT 0, size TEXT, weight TEXT, age_restriction INTEGER DEFAULT 0, start_date TEXT, end_date TEXT, expiry_date TEXT, quantity INTEGER DEFAULT 0, low_stock_alert INTEGER DEFAULT 5);
    CREATE TABLE IF NOT EXISTS held_carts (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT DEFAULT CURRENT_TIMESTAMP, cart_data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts (receipt_id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_code TEXT, date_time TEXT DEFAULT CURRENT_TIMESTAMP, total_amount REAL NOT NULL, customer_id INTEGER, cash_tendered REAL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS receipt_items (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id INTEGER, sku TEXT, item_name TEXT, qty_sold INTEGER, price_sold REAL);
    CREATE TABLE IF NOT EXISTS refunds (id INTEGER PRIMARY KEY AUTOINCREMENT, date_time TEXT DEFAULT CURRENT_TIMESTAMP, sku TEXT, qty INTEGER, amount REAL);
    INSERT OR IGNORE INTO store_profile (id, company_name, business_trade, message_at_end) VALUES (1, 'My Store', 'Retail Store', 'Thank you for shopping');
  `);
  const receiptColumns = db.prepare("PRAGMA table_info(receipts)").all();
  if (!receiptColumns.some((column) => column.name === "receipt_code")) {
    db.exec("ALTER TABLE receipts ADD COLUMN receipt_code TEXT");
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_receipt_code ON receipts(receipt_code)",
  );
  const existingReceipts = rows(
    "SELECT receipt_id FROM receipts WHERE receipt_code IS NULL",
  );
  for (const receipt of existingReceipts) {
    run("UPDATE receipts SET receipt_code=? WHERE receipt_id=?", [
      `R-${String(receipt.receipt_id).padStart(8, "0")}`,
      receipt.receipt_id,
    ]);
  }
  fs.writeFileSync(themePath, JSON.stringify(DEFAULT_THEME, null, 2));
  db.prepare(
    "INSERT OR REPLACE INTO app_meta(key,value) VALUES('admin_pin',?)",
  ).run(pin);
}
function seedDemoData() {
  const count = one("SELECT COUNT(*) AS count FROM products");
  if (count && count.count > 0) return;
  const seed = db.transaction(() => {
    const categories = {};
    for (const [name, sorting] of [
      ["Groceries", 1],
      ["Beverages", 2],
      ["Snacks", 3],
      ["Household", 4],
      ["Personal care", 5],
    ])
      categories[name] = run(
        "INSERT INTO categories(name,sorting_level) VALUES(?,?)",
        [name, sorting],
      ).lastInsertRowid;
    const suppliers = {};
    for (const [name, phone, email, address, credit, balance] of [
      [
        "FreshMart Wholesale",
        "+92 300 1234567",
        "orders@freshmart.local",
        "Main Market",
        50000,
        18500,
      ],
      [
        "Daily Needs Supply",
        "+92 301 7654321",
        "sales@dailyneeds.local",
        "Wholesale Avenue",
        30000,
        7200,
      ],
      [
        "Metro Beverages",
        "+92 302 5550911",
        "hello@metrobev.local",
        "Industrial Estate",
        80000,
        0,
      ],
      [
        "CleanHome Distributors",
        "+92 303 2227844",
        "orders@cleanhome.local",
        "North Warehouse",
        45000,
        12400,
      ],
    ])
      suppliers[name] = run(
        "INSERT INTO suppliers(name,phone_no,email,address,credit_limit,current_balance) VALUES(?,?,?,?,?,?)",
        [name, phone, email, address, credit, balance],
      ).lastInsertRowid;
    const customers = {};
    for (const [name, phone, balance] of [
      ["Walk-in Regular", "+92 333 5551212", 0],
      ["Nadia Khan", "+92 321 1112233", 2400],
      ["Bilal Traders", "+92 311 8781200", 6800],
      ["Ayesha Malik", "+92 333 9012234", 0],
      ["Office Pantry", "+92 300 4419821", 1250],
    ])
      customers[name] = run(
        "INSERT INTO customers(name,phone,current_balance) VALUES(?,?,?)",
        [name, phone, balance],
      ).lastInsertRowid;
    const products = [
      [
        "890100000001",
        "Groceries",
        "FreshMart Wholesale",
        "Premium Basmati Rice 5kg",
        "Long grain family pack",
        850,
        1050,
        "5kg",
        "5",
        24,
        5,
      ],
      [
        "890100000002",
        "Groceries",
        "FreshMart Wholesale",
        "Cooking Oil 1L",
        "Canola cooking oil",
        420,
        510,
        "1L",
        "1",
        36,
        8,
      ],
      [
        "890100000003",
        "Beverages",
        "Metro Beverages",
        "Black Tea 450g",
        "Strong breakfast tea",
        650,
        780,
        "450g",
        "0.45",
        18,
        5,
      ],
      [
        "890100000004",
        "Groceries",
        "FreshMart Wholesale",
        "Fine Sugar 1kg",
        "Refined white sugar",
        145,
        180,
        "1kg",
        "1",
        50,
        10,
      ],
      [
        "890100000005",
        "Groceries",
        "FreshMart Wholesale",
        "Milk Powder 500g",
        "Full cream milk powder",
        720,
        880,
        "500g",
        "0.5",
        12,
        4,
      ],
      [
        "890100000006",
        "Beverages",
        "Metro Beverages",
        "Mineral Water 1.5L",
        "Purified drinking water",
        65,
        95,
        "1.5L",
        "1.5",
        72,
        12,
      ],
      [
        "890100000007",
        "Beverages",
        "Metro Beverages",
        "Cola Can 330ml",
        "Chilled soft drink",
        75,
        110,
        "330ml",
        "0.33",
        40,
        8,
      ],
      [
        "890100000008",
        "Snacks",
        "Daily Needs Supply",
        "Potato Chips 60g",
        "Salted potato chips",
        55,
        85,
        "60g",
        "0.06",
        28,
        8,
      ],
      [
        "890100000009",
        "Snacks",
        "Daily Needs Supply",
        "Chocolate Bar 45g",
        "Milk chocolate",
        80,
        120,
        "45g",
        "0.045",
        22,
        6,
      ],
      [
        "890100000010",
        "Snacks",
        "Daily Needs Supply",
        "Cream Biscuits 120g",
        "Vanilla cream biscuits",
        65,
        100,
        "120g",
        "0.12",
        31,
        8,
      ],
      [
        "890100000011",
        "Household",
        "CleanHome Distributors",
        "Laundry Detergent 1kg",
        "Daily wash detergent",
        310,
        390,
        "1kg",
        "1",
        9,
        4,
      ],
      [
        "890100000012",
        "Household",
        "CleanHome Distributors",
        "Dishwashing Liquid 500ml",
        "Lemon dish wash",
        185,
        250,
        "500ml",
        "0.5",
        16,
        5,
      ],
      [
        "890100000013",
        "Household",
        "CleanHome Distributors",
        "Kitchen Tissue Roll",
        "Two-ply tissue",
        120,
        170,
        "1 roll",
        "0.2",
        20,
        5,
      ],
      [
        "890100000014",
        "Personal care",
        "CleanHome Distributors",
        "Hand Wash 250ml",
        "Moisturizing hand wash",
        210,
        290,
        "250ml",
        "0.25",
        14,
        4,
      ],
      [
        "890100000015",
        "Personal care",
        "CleanHome Distributors",
        "Shampoo 400ml",
        "Daily care shampoo",
        390,
        520,
        "400ml",
        "0.4",
        8,
        3,
      ],
      [
        "890100000016",
        "Groceries",
        "FreshMart Wholesale",
        "Red Lentils 1kg",
        "Premium masoor daal",
        280,
        360,
        "1kg",
        "1",
        4,
        6,
      ],
      [
        "890100000017",
        "Groceries",
        "FreshMart Wholesale",
        "Wheat Flour 10kg",
        "Stoneground flour",
        960,
        1180,
        "10kg",
        "10",
        18,
        4,
      ],
      [
        "890100000018",
        "Beverages",
        "Metro Beverages",
        "Mango Juice 1L",
        "Real fruit juice",
        190,
        260,
        "1L",
        "1",
        3,
        5,
      ],
    ];
    for (const [
      sku,
      category,
      supplier,
      name,
      description,
      purchase,
      sale,
      size,
      weight,
      quantity,
      lowStock,
    ] of products)
      run(
        "INSERT INTO products(sku,category_id,supplier_id,item_name,description,purchase_price,selling_price,size,weight,quantity,low_stock_alert) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [
          sku,
          categories[category],
          suppliers[supplier],
          name,
          description,
          purchase,
          sale,
          size,
          weight,
          quantity,
          lowStock,
        ],
      );
    const receipts = [
      ["2026-10-25 09:14:00", 1560, null, 1600],
      ["2026-10-26 11:38:00", 2440, customers["Nadia Khan"], 2000],
      ["2026-10-27 13:06:00", 875, null, 900],
      ["2026-10-28 15:22:00", 3210, customers["Bilal Traders"], 2500],
      ["2026-10-29 10:11:00", 1980, null, 2000],
      ["2026-10-30 17:45:00", 4260, customers["Office Pantry"], 4000],
    ];
    for (const [date, total, customerId, cash] of receipts) {
      const receipt = run(
        "INSERT INTO receipts(receipt_code,date_time,total_amount,customer_id,cash_tendered) VALUES(?,?,?,?,?)",
        [uniqueReceiptCode(), date, total, customerId, cash],
      );
      const product = products[Math.floor(Math.random() * products.length)];
      run(
        "INSERT INTO receipt_items(receipt_id,sku,item_name,qty_sold,price_sold) VALUES(?,?,?,?,?)",
        [receipt.lastInsertRowid, product[0], product[3], 1, product[6]],
      );
    }
    run("INSERT INTO held_carts(cart_data) VALUES(?)", [
      JSON.stringify([
        {
          sku: "890100000008",
          item_name: "Potato Chips 60g",
          selling_price: 85,
          qty: 2,
        },
      ]),
    ]);
  });
  seed();
}
function ensureRuntime() {
  if (!fs.existsSync(themePath))
    fs.writeFileSync(themePath, JSON.stringify(DEFAULT_THEME, null, 2));
}
function ensureDatabaseBootstrap() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
}
function rows(sql, params = []) {
  return db.prepare(sql).all(params);
}
function one(sql, params = []) {
  return db.prepare(sql).get(params);
}
function run(sql, params = []) {
  return db.prepare(sql).run(params);
}
function uniqueSku() {
  let sku;
  do
    sku =
      String(Date.now()).slice(-8) +
      Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0");
  while (one("SELECT sku FROM products WHERE sku=?", [sku]));
  return sku;
}
function uniqueReceiptCode() {
  let code;
  do {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    code = `R-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  } while (one("SELECT receipt_id FROM receipts WHERE receipt_code=?", [code]));
  return code;
}
function resolveImagePath(value) {
  if (!value) return "";
  if (String(value).startsWith("file://")) {
    try {
      return fileURLToPath(value);
    } catch {
      return "";
    }
  }
  return String(value);
}
function setupIpc() {
  ipcMain.handle("app-status", () => ({
    initialized:
      one("SELECT value FROM app_meta WHERE key='admin_pin'")?.value ===
      SETUP_PIN,
  }));
  ipcMain.handle("activate", (_, { pin }) => {
    initDb(pin);
    return { ok: true };
  });
  ipcMain.handle("theme", () => {
    ensureRuntime();
    return JSON.parse(fs.readFileSync(themePath, "utf8"));
  });
  ipcMain.handle("theme-save", (_, theme) => {
    const saved = { ...DEFAULT_THEME, ...theme };
    fs.writeFileSync(themePath, JSON.stringify(saved, null, 2));
    return saved;
  });
  ipcMain.handle("upload-image", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const source = result.filePaths[0];
    const stat = fs.statSync(source);
    if (stat.size > 10 * 1024 * 1024)
      throw new Error("Image must be 10 MB or smaller.");
    const imageDir = path.join(userDir, "images");
    fs.mkdirSync(imageDir, { recursive: true });
    const extension = path.extname(source).toLowerCase() || ".png";
    const destination = path.join(
      imageDir,
      `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`,
    );
    fs.copyFileSync(source, destination);
    if (!fs.existsSync(destination))
      throw new Error("The selected image could not be saved.");
    const mimeTypes = {
      ".gif": "image/gif",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const mime = mimeTypes[extension] || "application/octet-stream";
    const preview = `data:${mime};base64,${fs.readFileSync(destination).toString("base64")}`;
    return { path: destination, url: pathToFileURL(destination).href, preview };
  });
  ipcMain.handle("image-data", (_, imagePath) => {
    const resolvedPath = resolveImagePath(imagePath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) return { ok: false };
    const extension = path.extname(resolvedPath).toLowerCase();
    const mimeTypes = {
      ".gif": "image/gif",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const mime = mimeTypes[extension] || "application/octet-stream";
    return {
      ok: true,
      url: `data:${mime};base64,${fs.readFileSync(resolvedPath).toString("base64")}`,
    };
  });
  ipcMain.handle("query", (_, { sql, params }) => rows(sql, params));
  ipcMain.handle("one", (_, { sql, params }) => one(sql, params));
  ipcMain.handle("run", (_, { sql, params }) => run(sql, params));
  ipcMain.handle("save-product", (_, p) => {
    const sku = p.sku || uniqueSku();
    run(
      `INSERT INTO products(sku,category_id,supplier_id,item_name,description,purchase_price,selling_price,size,weight,age_restriction,start_date,end_date,expiry_date,quantity,low_stock_alert) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sku) DO UPDATE SET category_id=excluded.category_id,supplier_id=excluded.supplier_id,item_name=excluded.item_name,description=excluded.description,purchase_price=excluded.purchase_price,selling_price=excluded.selling_price,size=excluded.size,weight=excluded.weight,age_restriction=excluded.age_restriction,start_date=excluded.start_date,end_date=excluded.end_date,expiry_date=excluded.expiry_date,quantity=excluded.quantity,low_stock_alert=excluded.low_stock_alert`,
      [
        sku,
        p.category_id,
        p.supplier_id,
        p.item_name,
        p.description,
        p.purchase_price,
        p.selling_price,
        p.size,
        p.weight,
        p.age_restriction,
        p.start_date,
        p.end_date,
        p.expiry_date,
        p.quantity,
        p.low_stock_alert,
      ],
    );
    return one("SELECT * FROM products WHERE sku=?", [sku]);
  });
  ipcMain.handle("checkout", (_, { cart, customerId, cashTendered }) => {
    const total = cart.reduce((s, i) => s + i.selling_price * i.qty, 0);
    const receiptCode = uniqueReceiptCode();
    const receipt = run(
      "INSERT INTO receipts(receipt_code,total_amount,customer_id,cash_tendered) VALUES(?,?,?,?)",
      [receiptCode, total, customerId || null, cashTendered],
    );
    const add = db.transaction(() =>
      cart.forEach((i) => {
        run(
          "INSERT INTO receipt_items(receipt_id,sku,item_name,qty_sold,price_sold) VALUES(?,?,?,?,?)",
          [receipt.lastInsertRowid, i.sku, i.item_name, i.qty, i.selling_price],
        );
        run("UPDATE products SET quantity=quantity-? WHERE sku=?", [
          i.qty,
          i.sku,
        ]);
        if (customerId && cashTendered < total)
          run(
            "UPDATE customers SET current_balance=current_balance+? WHERE customer_id=?",
            [total - cashTendered, customerId],
          );
      }),
    );
    add();
    return {
      receiptId: receipt.lastInsertRowid,
      receiptCode,
      total,
      change: cashTendered - total,
    };
  });
  ipcMain.handle("hold", (_, cart) =>
    run("INSERT INTO held_carts(cart_data) VALUES(?)", [JSON.stringify(cart)]),
  );
  ipcMain.handle("recall", () =>
    rows("SELECT * FROM held_carts ORDER BY id DESC"),
  );
  ipcMain.handle("recall-one", (_, id) => {
    const item = one("SELECT * FROM held_carts WHERE id=?", [id]);
    run("DELETE FROM held_carts WHERE id=?", [id]);
    return JSON.parse(item.cart_data);
  });
  ipcMain.handle("refund", (_, { sku, qty }) => {
    const p = one("SELECT * FROM products WHERE sku=?", [sku]);
    if (!p) throw new Error("Product not found.");
    run("UPDATE products SET quantity=quantity+? WHERE sku=?", [qty, sku]);
    run("INSERT INTO refunds(sku,qty,amount) VALUES(?,?,?)", [
      sku,
      qty,
      -p.selling_price * qty,
    ]);
    return p;
  });
  ipcMain.handle("stock-in", (_, { supplierId, items, amountPaid }) => {
    const total = items.reduce((s, i) => s + i.purchase_price * i.qty, 0);
    const tx = db.transaction(() => {
      items.forEach((i) => {
        run("UPDATE products SET quantity=quantity+? WHERE sku=?", [
          i.qty,
          i.sku,
        ]);
      });
      if (supplierId && amountPaid < total)
        run(
          "UPDATE suppliers SET current_balance=current_balance+? WHERE supplier_id=?",
          [total - amountPaid, supplierId],
        );
    });
    tx();
    return { total };
  });
  ipcMain.handle("print-receipt", (_, { receiptId }) => {
    const receipt = one("SELECT * FROM receipts WHERE receipt_id=?", [
      receiptId,
    ]);
    if (!receipt) throw new Error("Receipt not found.");
    const items = rows("SELECT * FROM receipt_items WHERE receipt_id=?", [
      receiptId,
    ]);
    const profile = one("SELECT * FROM store_profile WHERE id=1") || {};
    const lines = [
      profile.company_name || "My Store",
      profile.business_trade || "",
      profile.address || "",
      profile.phone_no || "",
      "--------------------------------",
      `Receipt ${receipt.receipt_code || `#${receipt.receipt_id}`}`,
      receipt.date_time,
      "--------------------------------",
      ...items.map(
        (item) =>
          `${item.item_name} x${item.qty_sold}  ${Number(item.price_sold * item.qty_sold).toFixed(2)}`,
      ),
      "--------------------------------",
      `TOTAL                 ${Number(receipt.total_amount).toFixed(2)}`,
      `CASH                  ${Number(receipt.cash_tendered).toFixed(2)}`,
      `CHANGE                ${Number(receipt.cash_tendered - receipt.total_amount).toFixed(2)}`,
      profile.message_at_end || "Thank you for shopping",
      "Developed by Hamza",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const escpos = require("escpos");
      const usb = require("escpos-usb");
      escpos.USB = usb;
      const device = new escpos.USB();
      const printer = new escpos.Printer(device);
      device.open(() => printer.align("CT").text(lines).cut().close());
      return { ok: true, receiptId };
    } catch (error) {
      return {
        ok: false,
        receiptId,
        error: `Printer unavailable: ${error.message}`,
      };
    }
  });
  ipcMain.handle("void-receipt", (_, receiptId) => {
    const items = rows("SELECT * FROM receipt_items WHERE receipt_id=?", [
      receiptId,
    ]);
    const tx = db.transaction(() => {
      items.forEach((i) =>
        run("UPDATE products SET quantity=quantity+? WHERE sku=?", [
          i.qty_sold,
          i.sku,
        ]),
      );
      run("DELETE FROM receipt_items WHERE receipt_id=?", [receiptId]);
      run("DELETE FROM receipts WHERE receipt_id=?", [receiptId]);
    });
    tx();
    return { ok: true };
  });
  ipcMain.handle("drawer", () => {
    try {
      const escpos = require("escpos");
      const usb = require("escpos-usb");
      escpos.USB = usb;
      const device = new escpos.USB();
      const printer = new escpos.Printer(device);
      device.open(() =>
        printer.raw(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])).close(),
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  // HID barcode scanners emulate keyboard input and cannot be queried as a
  // separate USB device reliably. The renderer marks the scanner ready only
  // after receiving a barcode sequence ending in Enter.
  ipcMain.handle("hardware", () => ({ printer: false, scanner: false }));
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1050,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on("console-message", (_, level, message, line, sourceId) =>
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`),
  );
  win.webContents.on("render-process-gone", (_, details) =>
    console.error("Renderer process exited:", details),
  );
  win.webContents.on("unresponsive", () =>
    console.error("Renderer became unresponsive"),
  );
  win.webContents.on("before-input-event", (_, input) => {
    if (
      input.type === "keyDown" &&
      input.key.toLowerCase() === "i" &&
      input.control &&
      input.shift
    )
      win.webContents.toggleDevTools();
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.once("did-finish-load", () =>
      win.webContents.openDevTools({ mode: "detach" }),
    );
  } else win.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
  ensureRuntime();
  ensureDatabaseBootstrap();
  // Register every renderer bridge before creating the window.
  setupIpc();
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
