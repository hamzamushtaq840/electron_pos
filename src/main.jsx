import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const call = (command, payload) => window.pos.invoke(command, payload);
const query = (sql, params = []) => call("query", { sql, params });
const one = (sql, params = []) => call("one", { sql, params });
const run = (sql, params = []) => call("run", { sql, params });
const money = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const today = () => new Date().toISOString().slice(0, 10);

const ToastContext = React.createContext(() => {});
function useToast() {
  return React.useContext(ToastContext);
}
function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const notify = (message, type = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((current) => [...current, { id, message, type }]);
    window.setTimeout(
      () => setItems((current) => current.filter((item) => item.id !== id)),
      3600,
    );
  };
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack">
        {items.map((item) => (
          <div className={`toast toast-${item.type}`} key={item.id}>
            <strong>
              {item.type === "error"
                ? "Attention"
                : item.type === "warning"
                  ? "Check this"
                  : "Saved"}
            </strong>
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

class ModuleErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("POS module crashed:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="surface error-state">
        <div className="icon-disc danger">!</div>
        <h2>This page could not load</h2>
        <p>{this.state.error.message}</p>
        <button
          className="button primary"
          onClick={() => this.setState({ error: null })}
        >
          Reload page
        </button>
      </div>
    );
  }
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose?.()
      }
    >
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Hamza POS</p>
            <h3>{title}</h3>
          </div>
          {onClose && (
            <button className="icon-button" onClick={onClose}>
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
async function imagePreview(value) {
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  try {
    const result = await call("image-data", value);
    return result?.ok ? result.url : "";
  } catch {
    return "";
  }
}
function ImageUpload({ value, onChange, label = "Upload image" }) {
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  useEffect(() => {
    let active = true;
    imagePreview(value).then((url) => {
      if (active && (url || !value)) setPreview(url);
    });
    return () => {
      active = false;
    };
  }, [value]);
  async function choose() {
    try {
      setBusy(true);
      const result = await call("upload-image");
      if (result?.canceled) return;
      if (result?.path) {
        onChange(result.path);
        setPreview(result.preview || "");
      }
    } catch (error) {
      const message = error.message.includes("No handler registered")
        ? "The running Electron process is outdated. Close the POS completely and restart npm run dev."
        : error.message;
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="image-upload">
      <div className="image-preview">
        {preview ? (
          <img
            src={preview}
            alt="Selected upload"
            onError={() => {
              setPreview("");
              notify("The selected image could not be previewed.", "error");
            }}
          />
        ) : (
          <span>＋</span>
        )}
      </div>
      <div className="image-upload-copy">
        <strong>{value ? "Image selected" : label}</strong>
        <small>PNG, JPG, WEBP or GIF · max 10 MB</small>
        <div className="image-upload-actions">
          <button
            type="button"
            className="button tiny"
            onClick={(event) => {
              event.stopPropagation();
              choose();
            }}
            disabled={busy}
          >
            {busy ? "Choosing..." : value ? "Replace image" : "Choose image"}
          </button>
          {value && (
            <button
              type="button"
              className="button tiny danger-text"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange("");
                setPreview("");
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function ImagePreview({ value, className = "", fallback = "—" }) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    let active = true;
    imagePreview(value).then((url) => {
      if (active) setPreview(url);
    });
    return () => {
      active = false;
    };
  }, [value]);
  return preview ? (
    <img className={className} src={preview} alt="" />
  ) : (
    fallback
  );
}
function SearchBox({
  value,
  onChange,
  placeholder = "Search by name, SKU or phone...",
  onKeyDown,
}) {
  return (
    <div className="search-box">
      <span>⌕</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      <kbd>⌘ K</kbd>
    </div>
  );
}
function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="header-actions">{actions}</div>
    </div>
  );
}
function EmptyState({ icon = "◌", title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function StatusBadge({ children, tone = "green" }) {
  return (
    <span className={`status-badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
function singular(label) {
  return label.replace(/ies$/, "y").replace(/s$/, "");
}

function SidebarIcon({ name }) {
  const icons = {
    sale: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4l1.5-5.4H7" />
      </svg>
    ),
    dashboard: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13a8 8 0 1 1 16 0" />
        <path d="M12 13l4-4" />
      </svg>
    ),
    products: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 9h16" />
      </svg>
    ),
    stock: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v14" />
        <path d="m7 13 5 5 5-5" />
      </svg>
    ),
    categories: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7h14" />
        <path d="M5 12h14" />
        <path d="M5 17h14" />
      </svg>
    ),
    suppliers: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12a7 7 0 0 1 12-4" />
        <path d="m14 5 3 3-3 3" />
        <path d="M19 12a7 7 0 0 1-12 4" />
        <path d="m10 19-3-3 3-3" />
      </svg>
    ),
    customers: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19a7 7 0 0 1 14 0" />
      </svg>
    ),
    transactions: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 17 17 6" />
        <path d="M10 6h7v7" />
      </svg>
    ),
    reports: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19h14" />
        <path d="M8 16v-4" />
        <path d="M12 16V9" />
        <path d="M16 16v-6" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.7" />
      </svg>
    ),
  };
  return icons[name] || null;
}

function Activation({ done }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    try {
      await call("activate", { pin });
      done();
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <main className="activation">
      <form className="activation-card" onSubmit={submit}>
        <div className="brand-lockup">
          <div className="brand-mark">H</div>
          <div>
            <b>Hamza POS</b>
            <span>Offline retail workspace</span>
          </div>
        </div>
        <div className="activation-title">
          <p className="eyebrow">First-time setup</p>
          <h1>Unlock your store.</h1>
          <p>Enter the one-time setup PIN to initialize this local database.</p>
        </div>
        <Field label="Setup PIN">
          <input
            className="input large pin-input"
            required
            type="password"
            maxLength="6"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
          />
        </Field>
        {error && <div className="inline-error">{error}</div>}
        <button className="button primary large full">Initialize POS</button>
        <small className="muted">All store data stays on this computer.</small>
      </form>
    </main>
  );
}

const CartRow = memo(function CartRow({ item, onQty, onRemove }) {
  return (
    <div className="cart-row">
      <div className="cart-product">
        <div className="product-avatar">{item.item_name?.slice(0, 1)}</div>
        <div>
          <strong>{item.item_name}</strong>
          <small>
            {item.sku} · {item.size || "Standard"}
          </small>
        </div>
      </div>
      <div className="qty-control">
        <button onClick={() => onQty(item.sku, Math.max(1, item.qty - 1))}>
          −
        </button>
        <input
          value={item.qty}
          type="number"
          min="1"
          onChange={(event) => onQty(item.sku, event.target.value)}
          onBlur={(event) =>
            onQty(item.sku, Math.max(1, Number(event.target.value) || 1))
          }
        />
        <button onClick={() => onQty(item.sku, item.qty + 1)}>+</button>
      </div>
      <strong className="line-total">
        {money(item.selling_price * item.qty)}
      </strong>
      <button className="remove-button" onClick={() => onRemove(item.sku)}>
        ×
      </button>
    </div>
  );
});

function Sale({ navigate }) {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [cash, setCash] = useState("");
  const [held, setHeld] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [showRefund, setShowRefund] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const buffer = useRef("");
  const checkoutRef = useRef(String(Date.now()).slice(-5));
  const notify = useToast();
  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.selling_price) * item.qty,
        0,
      ),
    [cart],
  );
  const change = Math.max(0, Number(cash || 0) - total);

  useEffect(() => {
    query("SELECT * FROM customers ORDER BY name")
      .then(setCustomers)
      .catch((error) => notify(error.message, "error"));
    const listener = (event) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        )
      )
        return;
      if (event.key === "Enter") {
        const value = buffer.current;
        buffer.current = "";
        if (value) {
          setScannerReady(true);
          addProduct(value);
        }
      } else if (event.key.length === 1) buffer.current += event.key;
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  async function addProduct(value) {
    const term = String(value || "").trim();
    if (!term) return;
    try {
      const product = await one(
        "SELECT * FROM products WHERE LOWER(CAST(sku AS TEXT))=LOWER(?) OR LOWER(COALESCE(item_name,'')) LIKE LOWER(?) ORDER BY CASE WHEN LOWER(CAST(sku AS TEXT))=LOWER(?) THEN 0 ELSE 1 END LIMIT 1",
        [term, `%${term}%`, term],
      );
      if (!product) {
        notify("No product matched that barcode or search.", "error");
        return;
      }
      if (product.quantity <= 0) {
        notify(`${product.item_name} is out of stock.`, "warning");
        return;
      }
      setCart((current) => {
        const found = current.find((item) => item.sku === product.sku);
        return found
          ? current.map((item) =>
              item.sku === product.sku ? { ...item, qty: item.qty + 1 } : item,
            )
          : [...current, { ...product, qty: 1 }];
      });
      setSearch("");
      setResults([]);
      if (product.age_restriction > 0)
        notify(
          `Check ID — this item is ${product.age_restriction}+ only.`,
          "warning",
        );
    } catch (error) {
      notify(error.message, "error");
    }
  }
  async function searchItems(value) {
    setSearch(value);
    const term = String(value || "").trim();
    try {
      setResults(
        term
          ? await query(
              "SELECT * FROM products WHERE LOWER(CAST(sku AS TEXT)) LIKE LOWER(?) OR LOWER(COALESCE(item_name,'')) LIKE LOWER(?) ORDER BY item_name LIMIT 10",
              [`%${term}%`, `%${term}%`],
            )
          : [],
      );
    } catch (error) {
      notify(error.message, "error");
    }
  }
  async function checkout() {
    if (!cart.length)
      return notify("Add at least one product before checkout.", "warning");
    if (cart.some((item) => Number(item.qty) < 1))
      return notify("Each cart quantity must be at least 1.", "warning");
    if (Number(cash || 0) < total && !customerId)
      return notify(
        "Select a Khata customer for an underpaid sale.",
        "warning",
      );
    try {
      const result = await call("checkout", {
        cart,
        customerId,
        cashTendered: Number(cash || 0),
      });
      setReceipt(result);
      setCart([]);
      setCash("");
      setCustomerId("");
      notify(
        `Receipt ${result.receiptCode || `#${result.receiptId}`} created.`,
      );
    } catch (error) {
      notify(error.message, "error");
    }
  }
  async function printReceipt() {
    const result = await call("print-receipt", {
      receiptId: receipt.receiptId,
    });
    result.ok
      ? notify("Receipt sent to printer.")
      : notify(result.error, "error");
  }
  async function drawer() {
    const result = await call("drawer");
    result.ok
      ? notify("Cash drawer opened.")
      : notify(result.error || "Drawer unavailable.", "error");
  }
  async function holdCart() {
    if (!cart.length)
      return notify("There is no active cart to hold.", "warning");
    await call("hold", cart);
    setCart([]);
    notify("Cart held for later.");
  }
  async function recallCarts() {
    setHeld(await call("recall"));
  }
  function updateQty(sku, qty) {
    setCart((current) =>
      current.map((item) => (item.sku === sku ? { ...item, qty } : item)),
    );
  }
  return (
    <div className="sale-screen">
      <div className="sale-main">
        <PageHeader
          eyebrow="Workspace"
          title="New sale"
          description="Scan a barcode or search the catalogue to build a fast checkout."
          actions={
            <>
              <StatusBadge tone={scannerReady ? "green" : "gray"}>
                {scannerReady ? "Scanner ready" : "Scanner not detected"}
              </StatusBadge>
              <button className="button ghost" onClick={drawer}>
                Open drawer
              </button>
            </>
          }
        />
        <div className="sale-search">
          <SearchBox
            value={search}
            onChange={searchItems}
            placeholder="Scan barcode or search product..."
          />
          <button className="button primary" onClick={() => addProduct(search)}>
            Add item
          </button>
          {results.length > 0 && (
            <div className="search-results">
              {results.map((product) => (
                <button
                  key={product.sku}
                  onClick={() => addProduct(product.sku)}
                >
                  <div>
                    <strong>{product.item_name}</strong>
                    <small>
                      {product.sku} · {product.quantity} in stock
                    </small>
                  </div>
                  <b>{money(product.selling_price)}</b>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="surface cart-surface">
          <div className="surface-head">
            <div>
              <h2>Current cart</h2>
              <span>
                {cart.reduce((sum, item) => sum + item.qty, 0)} items ·{" "}
                {cart.length} lines
              </span>
            </div>
            <button className="button subtle" onClick={() => setCart([])}>
              Clear cart
            </button>
          </div>
          {cart.length ? (
            <div className="cart-list">
              {cart.map((item) => (
                <CartRow
                  key={item.sku}
                  item={item}
                  onQty={updateQty}
                  onRemove={(sku) =>
                    setCart((current) =>
                      current.filter((item) => item.sku !== sku),
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="＋"
              title="Your cart is ready"
              text="Scan an item to start a new sale."
            />
          )}
        </div>
      </div>
      <aside className="checkout-panel">
        <div className="checkout-header">
          <span>Checkout</span>
          <b>#{checkoutRef.current}</b>
        </div>
        <div className="checkout-fields">
          <Field label="Khata customer">
            <select
              className="input large"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Walk-in customer</option>
              {customers.map((customer) => (
                <option key={customer.customer_id} value={customer.customer_id}>
                  {customer.name} · balance {money(customer.current_balance)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cash tendered">
            <input
              className="input large cash-input"
              type="number"
              min="0"
              value={cash}
              onChange={(event) => setCash(event.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
        <div className="checkout-summary">
          <div>
            <span>Subtotal</span>
            <b>{money(total)}</b>
          </div>
          <div>
            <span>Khata due</span>
            <b>
              {customerId && Number(cash || 0) < total
                ? money(total - Number(cash || 0))
                : "0.00"}
            </b>
          </div>
          <div className="total-row">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="change-row">
            <span>Change</span>
            <strong>{money(change)}</strong>
          </div>
        </div>
        <button className="button primary checkout-button" onClick={checkout}>
          Complete sale <span>↵</span>
        </button>
        <div className="quick-actions">
          <button className="button ghost" onClick={holdCart}>
            Hold
          </button>
          <button className="button ghost" onClick={recallCarts}>
            Recall
          </button>
          <button className="button ghost" onClick={() => setShowRefund(true)}>
            Refund
          </button>
        </div>
        <div className="payment-note">
          <span className="status-dot" />
          Offline payment mode · no internet required
        </div>
      </aside>
      {held.length > 0 && (
        <Modal title="Recall a held cart" onClose={() => setHeld([])}>
          <div className="held-list">
            {held.map((item) => (
              <button
                key={item.id}
                className="held-card"
                onClick={async () => {
                  setCart(await call("recall-one", item.id));
                  setHeld([]);
                  notify("Held cart recalled.");
                }}
              >
                <span className="held-icon">⌁</span>
                <div>
                  <strong>Held cart #{item.id}</strong>
                  <small>{item.timestamp}</small>
                </div>
                <b>Open →</b>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {showRefund && (
        <RefundModal
          onClose={() => setShowRefund(false)}
          onDone={() => setShowRefund(false)}
        />
      )}
      {receipt && (
        <Modal title="Sale complete" onClose={() => setReceipt(null)}>
          <div className="success-panel">
            <div className="success-icon">✓</div>
            <h2>Receipt {receipt.receiptCode || `#${receipt.receiptId}`}</h2>
            <p>Your sale was saved locally.</p>
            <div className="receipt-result">
              <div>
                <span>Total</span>
                <b>{money(receipt.total)}</b>
              </div>
              <div>
                <span>Change</span>
                <b>{money(receipt.change)}</b>
              </div>
            </div>
            <div className="modal-actions">
              <button className="button primary" onClick={printReceipt}>
                Print receipt
              </button>
              <button className="button ghost" onClick={drawer}>
                Open drawer
              </button>
              <button
                className="button subtle"
                onClick={() => setReceipt(null)}
              >
                New sale
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RefundModal({ onClose, onDone }) {
  const [term, setTerm] = useState("");
  const [product, setProduct] = useState(null);
  const [matches, setMatches] = useState([]);
  const [qty, setQty] = useState(1);
  const notify = useToast();
  async function find(
    searchTerm = term,
    showEmptyMessage = true,
    selectSingle = false,
  ) {
    const value = String(searchTerm || "").trim();
    if (!value) return notify("Enter a barcode or item name.", "warning");
    const compactSku = value.replace(/\s+/g, "");
    try {
      const found = await query(
        "SELECT * FROM products WHERE LOWER(REPLACE(CAST(sku AS TEXT), ' ', '')) LIKE LOWER(?) OR LOWER(COALESCE(item_name, '')) LIKE LOWER(?) ORDER BY item_name LIMIT 8",
        [`%${compactSku}%`, `%${value}%`],
      );
      setMatches(found);
      if (selectSingle && found.length === 1) {
        setProduct(found[0]);
        setMatches([]);
      }
      if (!found.length && showEmptyMessage) {
        notify("No product matched that barcode or item name.", "error");
      }
    } catch (error) {
      setMatches([]);
      notify(error.message || "Product search failed.", "error");
    }
  }
  useEffect(() => {
    const value = term.trim();
    if (!value) return undefined;
    const timer = window.setTimeout(() => find(value, false), 180);
    return () => window.clearTimeout(timer);
  }, [term]);
  async function refund() {
    try {
      await call("refund", { sku: product.sku, qty: Number(qty) });
      notify("Refund recorded and stock restored.");
      onDone();
    } catch (error) {
      notify(error.message, "error");
    }
  }
  return (
    <Modal title="Process refund" onClose={onClose}>
      <div className="refund-search">
        <div className="refund-search-input">
          <SearchBox
            value={term}
            onChange={(value) => {
              setTerm(value);
              setProduct(null);
              setMatches([]);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                find(term, true, true);
              }
            }}
            placeholder="Scan original barcode or search..."
          />
          {matches.length > 0 && !product && (
            <div className="refund-results">
              {matches.map((item) => (
                <button
                  key={item.sku}
                  onClick={() => {
                    setProduct(item);
                    setMatches([]);
                  }}
                >
                  <span>
                    <strong>{item.item_name}</strong>
                    <small>
                      {item.sku} · {item.quantity} in stock
                    </small>
                  </span>
                  <b>{money(item.selling_price)}</b>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="button primary"
          onClick={() => find(term, true, true)}
        >
          Find
        </button>
      </div>
      {product ? (
        <div className="refund-product">
          <div className="product-avatar large-avatar">
            {product.item_name.slice(0, 1)}
          </div>
          <div>
            <h3>{product.item_name}</h3>
            <p>
              {product.sku} · Sale price {money(product.selling_price)}
            </p>
          </div>
          <Field label="Quantity">
            <input
              className="input large"
              type="number"
              min="1"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
            />
          </Field>
        </div>
      ) : (
        <EmptyState
          icon="↩"
          title="Find the original item"
          text="Refunds return stock and record a negative transaction."
        />
      )}
      <div className="modal-actions">
        <button className="button subtle" onClick={onClose}>
          Cancel
        </button>
        <button className="button danger" disabled={!product} onClick={refund}>
          Confirm refund
        </button>
      </div>
    </Modal>
  );
}

function CrudPage({
  title,
  eyebrow,
  description,
  table,
  columns,
  fields,
  createLabel = "Add record",
  onSaved,
  rowActions,
  saveHandler,
}) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const notify = useToast();
  const load = () =>
    query(`SELECT * FROM ${table} ORDER BY 1 DESC`)
      .then(setItems)
      .catch((error) => setError(error.message));
  useEffect(() => {
    load();
  }, [table]);
  const filtered = items.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.trim().toLowerCase()),
  );
  async function save(event) {
    event.preventDefault();
    try {
      const values = fields.map((field) => form[field.key] ?? "");
      if (saveHandler) await saveHandler(form);
      else if (form._editing) {
        const key = columns[0].key;
        const editable = fields.filter((field) => field.key !== key);
        await run(
          `UPDATE ${table} SET ${editable.map((field) => `${field.key}=?`).join(",")} WHERE ${key}=?`,
          [...editable.map((field) => form[field.key] ?? ""), form[key]],
        );
      } else
        await run(
          `INSERT INTO ${table}(${fields.map((field) => field.key).join(",")}) VALUES(${fields.map(() => "?").join(",")})`,
          values,
        );
      setForm(null);
      await load();
      onSaved?.();
      notify(`${singular(title)} saved.`);
    } catch (error) {
      setError(error.message);
      notify(error.message, "error");
    }
  }
  async function remove(item) {
    if (!window.confirm(`Delete ${item[columns[0].key]}?`)) return;
    try {
      await run(`DELETE FROM ${table} WHERE ${columns[0].key}=?`, [
        item[columns[0].key],
      ]);
      await load();
      notify("Record deleted.");
    } catch (error) {
      notify(error.message, "error");
    }
  }
  return (
    <div className="module-page">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <button className="button primary" onClick={() => setForm({})}>
            ＋ {createLabel}
          </button>
        }
      />
      {error && <div className="inline-error">{error}</div>}
      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} />
        <span className="result-count">{filtered.length} records</span>
      </div>
      <div className="surface table-surface">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item[columns[0].key]}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render
                      ? column.render(item)
                      : (item[column.key] ?? "—")}
                  </td>
                ))}
                <td className="row-actions">
                  {rowActions?.(item)}
                  <button
                    className="button tiny"
                    onClick={() => setForm({ ...item, _editing: true })}
                  >
                    Edit
                  </button>
                  <button
                    className="button tiny danger-text"
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <EmptyState
            icon="⌕"
            title="No records found"
            text="Try another search or add your first record."
          />
        )}
      </div>
      {form && (
        <Modal
          title={
            form._editing ? `Edit ${singular(title)}` : `Add ${singular(title)}`
          }
          onClose={() => setForm(null)}
          wide
        >
          <form className="form-grid modern-form" onSubmit={save}>
            {fields.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint}>
                {field.type === "image" ? (
                  <ImageUpload
                    value={form[field.key] ?? ""}
                    onChange={(value) =>
                      setForm({ ...form, [field.key]: value })
                    }
                    label={field.uploadLabel || "Upload image"}
                  />
                ) : field.type === "select" ? (
                  <select
                    className="input large"
                    required={field.required}
                    value={form[field.key] ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, [field.key]: event.target.value })
                    }
                  >
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input large"
                    required={field.required}
                    type={field.type || "text"}
                    value={form[field.key] ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, [field.key]: event.target.value })
                    }
                    placeholder={field.placeholder}
                  />
                )}
              </Field>
            ))}
            <div className="form-actions">
              <button
                type="button"
                className="button subtle"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button className="button primary">Save changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SupplierPage() {
  const [payment, setPayment] = useState(null);
  const [version, setVersion] = useState(0);
  const fields = [
    { key: "name", label: "Supplier name", required: true },
    { key: "phone_no", label: "Phone" },
    { key: "email", label: "Email", type: "email" },
    { key: "address", label: "Address" },
    {
      key: "credit_limit",
      label: "Credit limit",
      type: "number",
      hint: "Maximum unpaid purchasing allowance",
    },
    {
      key: "current_balance",
      label: "Opening balance",
      type: "number",
      hint: "Amount currently owed to this supplier",
    },
  ];
  return (
    <>
      <CrudPage
        key={version}
        eyebrow="Inventory"
        title="Suppliers"
        description="Manage vendors, credit limits and outstanding payables."
        table="suppliers"
        columns={[
          { key: "supplier_id", label: "ID" },
          { key: "name", label: "Supplier" },
          { key: "phone_no", label: "Phone" },
          {
            key: "credit_limit",
            label: "Credit limit",
            render: (item) => money(item.credit_limit),
          },
          {
            key: "current_balance",
            label: "You owe",
            render: (item) => (
              <strong
                className={
                  item.current_balance > 0 ? "amount-danger" : "amount-good"
                }
              >
                {money(item.current_balance)}
              </strong>
            ),
          },
        ]}
        fields={fields}
        createLabel="Add supplier"
        rowActions={(item) => (
          <button className="button tiny" onClick={() => setPayment(item)}>
            Pay
          </button>
        )}
      />
      <SupplierPaymentsModal
        supplier={payment}
        onClose={() => setPayment(null)}
        onSaved={() => {
          setPayment(null);
          setVersion((value) => value + 1);
        }}
      />
    </>
  );
}

function SupplierPaymentsModal({ supplier, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const notify = useToast();
  if (!supplier) return null;
  async function save(event) {
    event.preventDefault();
    try {
      const payment = Number(amount);
      if (payment <= 0) throw new Error("Enter a payment amount.");
      await run(
        "UPDATE suppliers SET current_balance=MAX(0,current_balance-?) WHERE supplier_id=?",
        [payment, supplier.supplier_id],
      );
      await run(
        "INSERT INTO supplier_payments(supplier_id,amount_paid) VALUES(?,?)",
        [supplier.supplier_id, payment],
      );
      onSaved();
    } catch (error) {
      notify(error.message, "error");
    }
  }
  return (
    <Modal title={`Pay ${supplier.name}`} onClose={onClose}>
      <div className="balance-callout">
        <span>Current balance owed</span>
        <strong>{money(supplier.current_balance)}</strong>
        <small>
          Payments reduce this payable balance. Purchases increase it when
          unpaid.
        </small>
      </div>
      <form onSubmit={save}>
        <Field label="Payment amount">
          <input
            className="input large"
            autoFocus
            type="number"
            min="0.01"
            max={supplier.current_balance}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Note (optional)">
          <input
            className="input large"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Bank transfer, cash..."
          />
        </Field>
        <div className="form-actions">
          <button type="button" className="button subtle" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Record payment</button>
        </div>
      </form>
    </Modal>
  );
}

function Dashboard({ storeName }) {
  const [data, setData] = useState({});
  const [trend, setTrend] = useState([]);
  const [trendRange, setTrendRange] = useState("7");
  const [low, setLow] = useState([]);
  const [hardware, setHardware] = useState({});
  const [error, setError] = useState("");
  const trendOptions = {
    7: { label: "Last 7 days", modifier: "-6 day", format: "weekday" },
    15: { label: "Last 15 days", modifier: "-14 day", format: "date" },
    week: { label: "This week", modifier: "week", format: "weekday" },
    month: { label: "This month", modifier: "month", format: "date" },
  };
  function trendDateRange() {
    if (trendRange === "month") {
      return "date('now','start of month')";
    }
    if (trendRange === "week") {
      return "date('now','-' || ((strftime('%w','now') + 6) % 7) || ' days')";
    }
    return `date('now','${trendOptions[trendRange].modifier}')`;
  }
  async function load() {
    try {
      const selectedTrend = trendOptions[trendRange];
      const startDate = trendDateRange();
      const values = await Promise.all([
        one(
          "SELECT COALESCE(SUM(total_amount),0) sales FROM receipts WHERE DATE(date_time)=CURRENT_DATE",
        ),
        one(
          "SELECT COALESCE(SUM((ri.price_sold-p.purchase_price)*ri.qty_sold),0) profit FROM receipt_items ri JOIN products p ON p.sku=ri.sku JOIN receipts r ON r.receipt_id=ri.receipt_id WHERE DATE(r.date_time)=CURRENT_DATE",
        ),
        one("SELECT COALESCE(SUM(current_balance),0) payables FROM suppliers"),
        one(
          "SELECT COALESCE(SUM(current_balance),0) receivables FROM customers",
        ),
        query(
          "SELECT sku,item_name,quantity,low_stock_alert FROM products WHERE NULLIF(TRIM(CAST(low_stock_alert AS TEXT)), '') IS NOT NULL AND CAST(low_stock_alert AS INTEGER)>0 AND quantity<=CAST(low_stock_alert AS INTEGER) ORDER BY quantity",
        ),
        query(
          `SELECT DATE(date_time) day,COALESCE(SUM(total_amount),0) sales FROM receipts WHERE DATE(date_time)>=${startDate} AND DATE(date_time)<=DATE('now') GROUP BY DATE(date_time) ORDER BY day`,
        ),
        call("hardware"),
      ]);
      setData({ ...values[0], ...values[1], ...values[2], ...values[3] });
      setLow(values[4]);
      const salesByDay = new Map(values[5].map((item) => [item.day, item]));
      const start = new Date();
      if (trendRange === "month") {
        start.setDate(1);
      } else if (trendRange === "week") {
        const mondayOffset = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - mondayOffset);
      } else {
        start.setDate(start.getDate() - Number(trendRange) + 1);
      }
      const days = [];
      const cursor = new Date(start);
      const end = new Date();
      const dateKey = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      while (cursor <= end) {
        const day = dateKey(cursor);
        days.push({
          day,
          sales: salesByDay.get(day)?.sales || 0,
          labelFormat: selectedTrend.format,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      if (trendRange === "month") {
        const monthWeeks = [];
        for (let index = 0; index < days.length; index += 7) {
          const week = days.slice(index, index + 7);
          monthWeeks.push({
            day: `week-${monthWeeks.length + 1}`,
            sales: week.reduce((sum, item) => sum + Number(item.sales || 0), 0),
            label: `${week[0].day.slice(8)}-${week[week.length - 1].day.slice(8)} ${new Date(`${week[0].day}T12:00:00`).toLocaleDateString(undefined, { month: "short" })}`,
          });
        }
        setTrend(monthWeeks);
      } else {
        setTrend(days);
      }
      setHardware(values[6]);
    } catch (error) {
      setError(error.message);
    }
  }
  useEffect(() => {
    load();
  }, [trendRange]);
  const max = Math.max(1, ...trend.map((item) => Number(item.sales)));
  return (
    <div className="module-page">
      <PageHeader
        eyebrow="Workspace"
        title={`Good morning, ${storeName || "My Store"}`}
        description={`Here is what is happening in your store today · ${today()}`}
        actions={
          <button className="button ghost" onClick={load}>
            ↻ Refresh
          </button>
        }
      />
      {error && <div className="inline-error">{error}</div>}
      <div className="metric-grid">
        {[
          ["Today's sales", data.sales, "Revenue collected"],
          ["Today's profit", data.profit, "After product cost"],
          ["Payables", data.payables, "You owe suppliers"],
          ["Receivables", data.receivables, "Customers owe you"],
        ].map(([label, value, sub]) => (
          <div className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="hardware-strip">
        <div>
          <span className="hardware-icon">⌁</span>
          <div>
            <strong>Barcode scanner</strong>
            <small>Keyboard input device</small>
          </div>
          <StatusBadge tone={hardware.scanner ? "green" : "gray"}>
            {hardware.scanner ? "Scanner ready" : "Not detected"}
          </StatusBadge>
        </div>
        <div>
          <span className="hardware-icon">▣</span>
          <div>
            <strong>Thermal printer</strong>
            <small>ESC/POS USB printer</small>
          </div>
          <StatusBadge tone={hardware.printer ? "green" : "gray"}>
            {hardware.printer ? "Connected" : "Not detected"}
          </StatusBadge>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="surface chart-card">
          <div className="surface-head">
            <div>
              <p className="eyebrow">{trendOptions[trendRange].label}</p>
              <h2>Sales trend</h2>
            </div>
            <select
              className="select trend-select"
              value={trendRange}
              onChange={(event) => setTrendRange(event.target.value)}
              aria-label="Sales trend period"
            >
              <option value="7">Last 7 days</option>
              <option value="15">Last 15 days</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
          <div className="bar-chart">
            {trend.map((item) => (
              <div className="bar-column" key={item.day}>
                <strong>{money(item.sales)}</strong>
                <div
                  className="bar"
                  style={{
                    height: `${Math.max(8, (Number(item.sales) / max) * 150)}px`,
                  }}
                />
                <small>
                  {item.label ||
                    (item.labelFormat === "weekday"
                      ? new Date(`${item.day}T12:00:00`).toLocaleDateString(
                          undefined,
                          { weekday: "short" },
                        )
                      : new Date(`${item.day}T12:00:00`).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        ))}
                </small>
              </div>
            ))}
          </div>
        </div>
        <div className="surface">
          <div className="surface-head">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2>Low stock</h2>
            </div>
            <span className="count-pill">{low.length}</span>
          </div>
          {low.length ? (
            <div className="low-stock-list">
              {low.slice(0, 7).map((item) => (
                <div key={item.sku}>
                  <div>
                    <strong>{item.item_name}</strong>
                    <small>{item.sku}</small>
                  </div>
                  <b>{item.quantity} left</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="✓"
              title="Stock looks healthy"
              text="No products are below their alert level."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StockIn() {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState([]);
  const [items, setItems] = useState([]);
  const [paid, setPaid] = useState("");
  const notify = useToast();
  useEffect(() => {
    query("SELECT * FROM suppliers ORDER BY name").then(setSuppliers);
  }, []);
  async function searchProducts(value) {
    setTerm(value);
    const search = String(value || "").trim();
    if (!search) {
      setMatches([]);
      return;
    }
    try {
      setMatches(
        await query(
          "SELECT * FROM products WHERE LOWER(CAST(sku AS TEXT)) LIKE LOWER(?) OR LOWER(COALESCE(item_name,'')) LIKE LOWER(?) ORDER BY item_name LIMIT 8",
          [`%${search}%`, `%${search}%`],
        ),
      );
    } catch (error) {
      notify(error.message, "error");
    }
  }
  async function add(selectedSku = term) {
    const search = String(selectedSku || "").trim();
    if (!search) return notify("Search for a product first.", "warning");
    const product = await one(
      "SELECT * FROM products WHERE LOWER(CAST(sku AS TEXT))=LOWER(?) OR LOWER(COALESCE(item_name,'')) LIKE LOWER(?) ORDER BY CASE WHEN LOWER(CAST(sku AS TEXT))=LOWER(?) THEN 0 ELSE 1 END LIMIT 1",
      [search, `%${search}%`, search],
    );
    if (!product) return notify("Product not found.", "error");
    setItems((current) => {
      const found = current.find((item) => item.sku === product.sku);
      return found
        ? current.map((item) =>
            item.sku === product.sku ? { ...item, qty: item.qty + 1 } : item,
          )
        : [...current, { ...product, qty: 1 }];
    });
    setTerm("");
    setMatches([]);
  }
  const total = items.reduce(
    (sum, item) => sum + item.purchase_price * item.qty,
    0,
  );
  async function post() {
    if (!supplierId) return notify("Choose a supplier.", "warning");
    if (!items.length) return notify("Add at least one product.", "warning");
    try {
      await call("stock-in", {
        supplierId,
        items,
        amountPaid: Number(paid || 0),
      });
      notify(
        `Stock posted. Supplier payable updated by ${money(Math.max(0, total - Number(paid || 0)))}.`,
      );
      setItems([]);
      setPaid("");
    } catch (error) {
      notify(error.message, "error");
    }
  }
  return (
    <div className="module-page">
      <PageHeader
        eyebrow="Inventory"
        title="Stock in"
        description="Receive goods, increase stock and keep supplier payables accurate."
      />
      <div className="stock-workspace">
        <div className="surface stock-entry">
          <Field label="Supplier">
            <select
              className="input large"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.name} · balance {money(supplier.current_balance)}
                </option>
              ))}
            </select>
          </Field>
          <div className="add-line">
            <SearchBox
              value={term}
              onChange={searchProducts}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder="Scan or search product..."
            />
            <button className="button primary" onClick={add}>
              Add item
            </button>
            {matches.length > 0 && (
              <div className="stock-search-results">
                {matches.map((product) => (
                  <button key={product.sku} onClick={() => add(product.sku)}>
                    <span>
                      <strong>{product.item_name}</strong>
                      <small>
                        {product.sku} · {product.quantity} in stock
                      </small>
                    </span>
                    <b>{money(product.purchase_price)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
          {items.length ? (
            <div className="stock-lines">
              {items.map((item) => (
                <div className="stock-line" key={item.sku}>
                  <div className="product-avatar">
                    {item.item_name.slice(0, 1)}
                  </div>
                  <div>
                    <strong>{item.item_name}</strong>
                    <small>
                      {item.sku} · Cost {money(item.purchase_price)}
                    </small>
                  </div>
                  <input
                    className="input quantity-input"
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row) =>
                          row.sku === item.sku
                            ? {
                                ...row,
                                qty: Math.max(
                                  1,
                                  Number(event.target.value) || 1,
                                ),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                  <strong>{money(item.purchase_price * item.qty)}</strong>
                  <button
                    className="remove-button"
                    onClick={() =>
                      setItems((current) =>
                        current.filter((row) => row.sku !== item.sku),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="＋"
              title="Add received products"
              text="Search by item name or scan a barcode."
            />
          )}
        </div>
        <aside className="surface stock-summary">
          <p className="eyebrow">Purchase summary</p>
          <div className="summary-stat">
            <span>Items received</span>
            <strong>{items.reduce((sum, item) => sum + item.qty, 0)}</strong>
          </div>
          <div className="summary-stat">
            <span>Total bill</span>
            <strong>{money(total)}</strong>
          </div>
          <Field label="Amount paid now">
            <input
              className="input large"
              type="number"
              min="0"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <div className="balance-callout">
            <span>New payable</span>
            <strong>{money(Math.max(0, total - Number(paid || 0)))}</strong>
          </div>
          <button
            className="button primary large full"
            disabled={!items.length}
            onClick={post}
          >
            Post stock in
          </button>
        </aside>
      </div>
    </div>
  );
}

function Transactions() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const notify = useToast();
  const load = () =>
    query("SELECT * FROM receipts ORDER BY receipt_id DESC")
      .then(setItems)
      .catch((error) => setError(error.message));
  useEffect(() => {
    load();
  }, []);
  const filtered = items.filter(
    (item) =>
      String(item.receipt_code || item.receipt_id)
        .toLowerCase()
        .includes(search.trim().toLowerCase()) ||
      String(item.receipt_id).includes(search.trim()) ||
      String(item.date_time)
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  async function print(receiptId) {
    const result = await call("print-receipt", { receiptId });
    result.ok
      ? notify("Receipt sent to printer.")
      : notify(result.error, "error");
  }
  return (
    <div className="module-page">
      <PageHeader
        eyebrow="Customers"
        title="Transactions"
        description="Search, reprint and void completed receipts."
        actions={
          <button className="button ghost" onClick={load}>
            ↻ Refresh
          </button>
        }
      />
      {error && <div className="inline-error">{error}</div>}
      <div className="toolbar">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search receipt number or date..."
        />
        <span className="result-count">{filtered.length} receipts</span>
      </div>
      <div className="surface table-surface">
        <table className="data-table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date & time</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Cash</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.receipt_id}>
                <td>
                  <strong>{item.receipt_code || `#${item.receipt_id}`}</strong>
                </td>
                <td>{item.date_time}</td>
                <td>
                  {item.customer_id ? `Khata #${item.customer_id}` : "Walk-in"}
                </td>
                <td>
                  <strong>{money(item.total_amount)}</strong>
                </td>
                <td>{money(item.cash_tendered)}</td>
                <td className="row-actions">
                  <button
                    className="button tiny"
                    onClick={() => print(item.receipt_id)}
                  >
                    Print
                  </button>
                  <button
                    className="button tiny danger-text"
                    onClick={async () => {
                      if (
                        window.confirm("Void this receipt and restore stock?")
                      ) {
                        await call("void-receipt", item.receipt_id);
                        notify("Receipt voided and stock restored.");
                        load();
                      }
                    }}
                  >
                    Void
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <EmptyState
            title="No receipts yet"
            text="Completed sales will appear here."
          />
        )}
      </div>
    </div>
  );
}

function Reports() {
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [tab, setTab] = useState("supplier");
  useEffect(() => {
    query(
      "SELECT sp.*,s.name FROM supplier_payments sp LEFT JOIN suppliers s ON s.supplier_id=sp.supplier_id ORDER BY sp.payment_id DESC",
    ).then(setSupplierPayments);
    query(
      "SELECT cp.*,c.name FROM customer_payments cp LEFT JOIN customers c ON c.customer_id=cp.customer_id ORDER BY cp.payment_id DESC",
    ).then(setCustomerPayments);
  }, []);
  const rows = tab === "supplier" ? supplierPayments : customerPayments;
  return (
    <div className="module-page">
      <PageHeader
        eyebrow="Customers"
        title="Payment reports"
        description="A clear audit trail for supplier payables and customer Khata collections."
      />
      <div className="report-tabs">
        <button
          className={tab === "supplier" ? "active" : ""}
          onClick={() => setTab("supplier")}
        >
          Supplier payments
        </button>
        <button
          className={tab === "customer" ? "active" : ""}
          onClick={() => setTab("customer")}
        >
          Customer receipts
        </button>
      </div>
      <div className="surface table-surface">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Date</th>
              <th>{tab === "supplier" ? "Supplier" : "Customer"}</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.payment_id}>
                <td>#{item.payment_id}</td>
                <td>{item.date}</td>
                <td>{item.name || "Unknown"}</td>
                <td>
                  <strong>{money(item.amount_paid)}</strong>
                </td>
                <td>
                  <StatusBadge>
                    {tab === "supplier" ? "Payable reduced" : "Khata reduced"}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState
            title="No payment records"
            text="Payments will appear here after you record them."
          />
        )}
      </div>
    </div>
  );
}

function Settings({ theme, setTheme, onProfileSaved }) {
  const [profile, setProfile] = useState({});
  const [activeTab, setActiveTab] = useState("profile");
  const notify = useToast();
  useEffect(() => {
    one("SELECT * FROM store_profile WHERE id=1").then((savedProfile) =>
      setProfile(savedProfile || {}),
    );
  }, []);
  function updateTheme(key, value) {
    const next = { ...theme, [key]: value };
    setTheme(next);
    document.documentElement.style.setProperty(`--${key}`, value);
  }
  async function updateLogo(value) {
    const next = { ...profile, logo_path: value };
    setProfile(next);
    try {
      await run("UPDATE store_profile SET logo_path=? WHERE id=1", [
        value || null,
      ]);
      onProfileSaved?.(next);
      notify(value ? "Store logo saved." : "Store logo removed.");
    } catch (error) {
      notify(error.message, "error");
    }
  }
  async function save(event) {
    event.preventDefault();
    await run(
      "UPDATE store_profile SET company_name=?,business_trade=?,address=?,phone_no=?,mail=?,logo_path=?,message_at_end=? WHERE id=1",
      [
        profile.company_name,
        profile.business_trade,
        profile.address,
        profile.phone_no,
        profile.mail,
        profile.logo_path,
        profile.message_at_end,
      ],
    );
    await call("theme-save", theme);
    onProfileSaved?.(profile);
    notify("Store profile and theme saved.");
  }
  return (
    <div className="module-page">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Make the POS feel like your store and configure receipt identity."
      />
      <div className="settings-layout">
        <div className="settings-nav">
          <button
            className={activeTab === "profile" ? "active" : ""}
            onClick={() => setActiveTab("profile")}
          >
            Store profile<span>Receipt identity</span>
          </button>
          <button
            className={activeTab === "theme" ? "active" : ""}
            onClick={() => setActiveTab("theme")}
          >
            Theme & appearance<span>Colors and contrast</span>
          </button>
          <button
            className={activeTab === "hardware" ? "active" : ""}
            onClick={() => setActiveTab("hardware")}
          >
            Hardware<span>Printer and drawer</span>
          </button>
        </div>
        <div className="surface settings-content">
          {activeTab === "profile" && (
            <form className="form-grid modern-form" onSubmit={save}>
              <div className="form-section-title">
                <h2>Store profile</h2>
                <p>These details appear on printed receipts.</p>
              </div>
              {[
                ["company_name", "Company name"],
                ["business_trade", "Business / trade"],
                ["address", "Address"],
                ["phone_no", "Phone number"],
                ["mail", "Email address"],
                ["logo_path", "Logo local path"],
                ["message_at_end", "Message at end"],
              ].map(([key, label]) =>
                key === "logo_path" ? (
                  <div className="field" key={key}>
                    <span>{label}</span>
                    <ImageUpload
                      value={profile[key] || ""}
                      onChange={updateLogo}
                      label="Upload store logo"
                    />
                  </div>
                ) : (
                  <Field key={key} label={label}>
                    <input
                      className="input large"
                      value={profile[key] || ""}
                      onChange={(event) =>
                        setProfile({ ...profile, [key]: event.target.value })
                      }
                    />
                  </Field>
                ),
              )}
              <div className="receipt-tag">
                <span>Receipt tag</span>
                <strong>Developed by Hamza</strong>
                <small>
                  Hardcoded footer appended to every ESC/POS receipt.
                </small>
              </div>
              <div className="form-actions">
                <button className="button primary">Save profile</button>
              </div>
            </form>
          )}
          {activeTab === "theme" && (
            <div className="theme-editor">
              <div className="form-section-title">
                <h2>Theme & appearance</h2>
                <p>Changes apply immediately and are stored locally.</p>
              </div>
              <div className="theme-preview">
                <div
                  className="preview-sidebar"
                  style={{ background: theme.primary }}
                >
                  <strong>Hamza POS</strong>
                  <span
                    className="preview-nav-active"
                    style={{ background: theme.secondary }}
                  >
                    Dashboard
                  </span>
                  <span>Products</span>
                  <span>Transactions</span>
                </div>
                <div
                  className="preview-workspace"
                  style={{ background: theme.background }}
                >
                  <div className="preview-toolbar">
                    <div>
                      <small>Dashboard</small>
                      <strong>Good morning, store owner</strong>
                    </div>
                    <button
                      className="preview-primary"
                      style={{ background: theme.primary }}
                    >
                      New sale
                    </button>
                  </div>
                  <div className="preview-stats">
                    <div
                      className="preview-stat"
                      style={{ background: theme.secondary }}
                    >
                      <small>Today&apos;s sales</small>
                      <strong>$1,248.00</strong>
                    </div>
                    <div
                      className="preview-stat"
                      style={{ background: theme.secondary }}
                    >
                      <small>Items in stock</small>
                      <strong>486</strong>
                    </div>
                  </div>
                  <div
                    className="preview-table"
                    style={{ background: theme.secondary }}
                  >
                    <div className="preview-table-head">
                      <span>Product</span>
                      <span>Qty</span>
                      <span>Total</span>
                    </div>
                    <div>
                      <span>Milk 1 litre</span>
                      <span>2</span>
                      <span>$6.00</span>
                    </div>
                    <div>
                      <span>Whole wheat bread</span>
                      <span>1</span>
                      <span>$3.50</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="color-grid">
                {[
                  ["primary", "Primary color"],
                  ["secondary", "Secondary color"],
                  ["background", "App background"],
                ].map(([key, label]) => (
                  <label className="color-field" key={key}>
                    <span>{label}</span>
                    <input
                      type="color"
                      value={theme[key] || "#ffffff"}
                      onChange={(event) => updateTheme(key, event.target.value)}
                    />
                    <code>{theme[key]}</code>
                  </label>
                ))}
              </div>
              <div className="theme-actions">
                <button
                  className="button primary"
                  onClick={async () => {
                    await call("theme-save", theme);
                    notify("Theme saved locally.");
                  }}
                >
                  Save theme
                </button>
                <button
                  className="button subtle"
                  onClick={async () => {
                    const defaults = {
                      primary: "#2E7D32",
                      secondary: "#FFFFFF",
                      background: "#F5F5F5",
                    };
                    setTheme(defaults);
                    Object.entries(defaults).forEach(([key, value]) =>
                      document.documentElement.style.setProperty(
                        `--${key}`,
                        value,
                      ),
                    );
                    await call("theme-save", defaults);
                    notify("Theme reset to default.");
                  }}
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}
          {activeTab === "hardware" && (
            <div className="theme-editor">
              <div className="form-section-title">
                <h2>Hardware</h2>
                <p>
                  Optional devices fail safely; sales remain available without
                  them.
                </p>
              </div>
              <div className="hardware-setting">
                <div>
                  <strong>Cash drawer</strong>
                  <span>Send ESC/POS kick command after checkout.</span>
                </div>
                <label className="switch">
                  <input type="checkbox" defaultChecked />
                  <i />
                </label>
              </div>
              <div className="hardware-setting">
                <div>
                  <strong>Printer port</strong>
                  <span>USB thermal printer via escpos-usb.</span>
                </div>
                <select className="input">
                  <option>USB (automatic)</option>
                  <option>COM1</option>
                  <option>COM2</option>
                </select>
              </div>
              <div className="hardware-setting">
                <div>
                  <strong>Barcode scanner</strong>
                  <span>HID keyboard scanner ending with Enter.</span>
                </div>
                <StatusBadge tone="gray">Auto detect</StatusBadge>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Customers() {
  const [payment, setPayment] = useState(null);
  const [version, setVersion] = useState(0);
  const fields = [
    { key: "name", label: "Customer name", required: true },
    { key: "phone", label: "Phone" },
    {
      key: "current_balance",
      label: "Opening balance",
      type: "number",
      hint: "Amount the customer currently owes",
    },
  ];
  return (
    <>
      <CrudPage
        key={version}
        eyebrow="Customers"
        title="Khata customers"
        description="Track customer credit and receive payments against outstanding balances."
        table="customers"
        columns={[
          { key: "customer_id", label: "ID" },
          { key: "name", label: "Customer" },
          { key: "phone", label: "Phone" },
          {
            key: "current_balance",
            label: "They owe",
            render: (item) => (
              <strong
                className={
                  item.current_balance > 0 ? "amount-danger" : "amount-good"
                }
              >
                {money(item.current_balance)}
              </strong>
            ),
          },
        ]}
        fields={fields}
        createLabel="Add customer"
        rowActions={(item) => (
          <button className="button tiny" onClick={() => setPayment(item)}>
            Receive
          </button>
        )}
      />
      <CustomerPaymentModal
        customer={payment}
        onClose={() => setPayment(null)}
        onSaved={() => {
          setPayment(null);
          setVersion((value) => value + 1);
        }}
      />
    </>
  );
}

function CustomerPaymentModal({ customer, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const notify = useToast();
  if (!customer) return null;
  async function save(event) {
    event.preventDefault();
    try {
      const payment = Number(amount);
      if (payment <= 0) throw new Error("Enter a payment amount.");
      await run(
        "UPDATE customers SET current_balance=MAX(0,current_balance-?) WHERE customer_id=?",
        [payment, customer.customer_id],
      );
      await run(
        "INSERT INTO customer_payments(customer_id,amount_paid) VALUES(?,?)",
        [customer.customer_id, payment],
      );
      notify("Customer payment received.");
      onSaved();
    } catch (error) {
      notify(error.message, "error");
    }
  }
  return (
    <Modal title={`Receive from ${customer.name}`} onClose={onClose}>
      <div className="balance-callout">
        <span>Outstanding Khata balance</span>
        <strong>{money(customer.current_balance)}</strong>
        <small>
          Receiving money reduces what this customer owes the store.
        </small>
      </div>
      <form onSubmit={save}>
        <Field label="Amount received">
          <input
            className="input large"
            autoFocus
            type="number"
            min="0.01"
            max={customer.current_balance}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <div className="form-actions">
          <button type="button" className="button subtle" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Record receipt</button>
        </div>
      </form>
    </Modal>
  );
}

function ProductPage() {
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
    query(
      "SELECT category_id AS value,name AS label FROM categories ORDER BY sorting_level,name",
    ).then(setCategories);
    query(
      "SELECT supplier_id AS value,name AS label FROM suppliers ORDER BY name",
    ).then(setSuppliers);
  }, []);
  const fields = [
    {
      key: "sku",
      label: "SKU / barcode",
      hint: "Leave blank to auto-generate",
    },
    {
      key: "category_id",
      label: "Category",
      type: "select",
      required: true,
      options: categories,
    },
    { key: "item_name", label: "Item name", required: true },
    { key: "description", label: "Description" },
    {
      key: "supplier_id",
      label: "Supplier",
      type: "select",
      options: suppliers,
    },
    {
      key: "purchase_price",
      label: "Purchase price",
      type: "number",
      required: true,
    },
    {
      key: "selling_price",
      label: "Selling price",
      type: "number",
      required: true,
    },
    { key: "size", label: "Size" },
    { key: "weight", label: "Weight" },
    { key: "age_restriction", label: "Age restriction", type: "number" },
    { key: "start_date", label: "Start date", type: "date" },
    { key: "end_date", label: "End date", type: "date" },
    { key: "expiry_date", label: "Expiry date", type: "date" },
    { key: "quantity", label: "Quantity", type: "number" },
    { key: "low_stock_alert", label: "Low stock alert", type: "number" },
  ];
  return (
    <CrudPage
      eyebrow="Inventory"
      title="Products"
      description="Manage prices, stock, categories and barcode identity."
      table="products"
      columns={[
        { key: "sku", label: "SKU" },
        { key: "item_name", label: "Product" },
        {
          key: "selling_price",
          label: "Price",
          render: (item) => money(item.selling_price),
        },
        {
          key: "quantity",
          label: "Stock",
          render: (item) => (
            <strong
              className={
                Number(item.low_stock_alert) > 0 &&
                Number(item.quantity) <= Number(item.low_stock_alert)
                  ? "amount-danger"
                  : "amount-good"
              }
            >
              {item.quantity}
            </strong>
          ),
        },
        { key: "category_id", label: "Category" },
      ]}
      fields={fields}
      createLabel="Add product"
      saveHandler={(form) =>
        call("save-product", {
          ...form,
          category_id: form.category_id || null,
          supplier_id: form.supplier_id || null,
          low_stock_alert:
            form.low_stock_alert === "" || form.low_stock_alert == null
              ? null
              : form.low_stock_alert,
        })
      }
    />
  );
}

function App() {
  const [status, setStatus] = useState();
  const [theme, setTheme] = useState({});
  const [profile, setProfile] = useState({});
  const [page, setPage] = useState("sale");
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([call("app-status"), call("theme")])
      .then(([appStatus, savedTheme]) => {
        setStatus(appStatus);
        setTheme(savedTheme);
        Object.entries(savedTheme).forEach(([key, value]) =>
          document.documentElement.style.setProperty(`--${key}`, value),
        );
      })
      .catch((error) => setError(error.message));
  }, []);
  useEffect(() => {
    if (status?.initialized) {
      one("SELECT * FROM store_profile WHERE id=1")
        .then((savedProfile) => setProfile(savedProfile || {}))
        .catch(() => {});
    }
  }, [status?.initialized]);
  if (error)
    return (
      <main className="activation">
        <div className="surface error-state">
          <h2>Hamza POS could not start</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  if (!status)
    return (
      <div className="loading-screen">
        <div className="brand-mark">H</div>
        <strong>Loading your store...</strong>
      </div>
    );
  if (!status.initialized)
    return <Activation done={() => call("app-status").then(setStatus)} />;
  const nav = [
    {
      section: "Workspace",
      items: [
        ["sale", "sale", "New sale"],
        ["dashboard", "dashboard", "Dashboard"],
      ],
    },
    {
      section: "Inventory",
      items: [
        ["products", "products", "Products"],
        ["stock", "stock", "Stock in"],
        ["categories", "categories", "Categories"],
        ["suppliers", "suppliers", "Suppliers"],
      ],
    },
    {
      section: "Customers",
      items: [
        ["customers", "customers", "Khata customers"],
        ["transactions", "transactions", "Transactions"],
        ["reports", "reports", "Reports"],
      ],
    },
    { section: "System", items: [["settings", "settings", "Settings"]] },
  ];
  const titles = {
    sale: "New sale",
    dashboard: "Dashboard",
    products: "Products",
    stock: "Stock in",
    categories: "Categories",
    suppliers: "Suppliers",
    customers: "Khata customers",
    transactions: "Transactions",
    reports: "Reports",
    settings: "Settings",
  };
  const sections = {
    sale: "Workspace",
    dashboard: "Workspace",
    products: "Inventory",
    stock: "Inventory",
    categories: "Inventory",
    suppliers: "Inventory",
    customers: "Customers",
    transactions: "Customers",
    reports: "Customers",
    settings: "System",
  };
  const content = {
    sale: <Sale navigate={setPage} />,
    dashboard: <Dashboard storeName={profile.company_name} />,
    products: <ProductPage />,
    stock: <StockIn />,
    categories: (
      <CrudPage
        eyebrow="Inventory"
        title="Categories"
        description="Organize your catalogue into fast, searchable departments."
        table="categories"
        columns={[
          { key: "category_id", label: "ID" },
          { key: "name", label: "Category" },
          {
            key: "image_path",
            label: "Image",
            render: (item) =>
              item.image_path ? (
                <ImagePreview className="table-thumb" value={item.image_path} />
              ) : (
                "—"
              ),
          },
          { key: "sorting_level", label: "Order" },
        ]}
        fields={[
          { key: "name", label: "Category name", required: true },
          { key: "image_path", label: "Category image", type: "image" },
          { key: "sorting_level", label: "Sorting level", type: "number" },
        ]}
        createLabel="Add category"
      />
    ),
    suppliers: <SupplierPage />,
    customers: <Customers />,
    transactions: <Transactions />,
    reports: <Reports />,
    settings: (
      <Settings theme={theme} setTheme={setTheme} onProfileSaved={setProfile} />
    ),
  }[page];
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">H</div>
          <div>
            <b>Hamza POS</b>
            <span>Offline retail workspace</span>
          </div>
        </div>
        <div className="store-chip">
          {profile.logo_path ? (
            <ImagePreview
              value={profile.logo_path}
              className="store-avatar store-logo"
              fallback={(profile.company_name || "My Store")
                .slice(0, 1)
                .toUpperCase()}
            />
          ) : (
            <span className="store-avatar">
              {(profile.company_name || "My Store").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{profile.company_name || "My Store"}</strong>
            <small>{profile.business_trade || "Business / trade"}</small>
          </div>
        </div>
        <div className="nav-scroll">
          {nav.map((group) => (
            <div className="nav-group" key={group.section}>
              <p>{group.section}</p>
              {group.items.map(([key, icon, label]) => (
                <button
                  key={key}
                  className={page === key ? "active" : ""}
                  onClick={() => setPage(key)}
                >
                  <i>
                    <SidebarIcon name={icon} />
                  </i>
                  <span>{label}</span>
                  {key === "sale" && <em>⌘1</em>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <StatusBadge>Local database</StatusBadge>
          <small>v1.0 · All data stays offline</small>
        </div>
      </nav>
      <main className="app-main">
        <header className="topbar">
          <div>
            <button
              className="breadcrumb-link"
              onClick={() => setPage("dashboard")}
              title="Go to Dashboard"
            >
              {sections[page]}
            </button>
            <span className="breadcrumb-separator">/</span>
            <strong className="breadcrumb-current">{titles[page]}</strong>
          </div>
          <div className="topbar-actions">
            <span className="date-label">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
            <button className="avatar-button">H</button>
          </div>
        </header>
        <ModuleErrorBoundary key={page}>{content}</ModuleErrorBoundary>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
);
