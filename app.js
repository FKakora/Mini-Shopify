/* Mini Store – a small Shopify-style demo.
   Storefront and admin share one "database" saved in localStorage. */
const $ = s => document.querySelector(s);
const R = n => "R" + Number(n).toLocaleString("en-ZA", {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace(/\u00a0/g, " ");
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const COLORS = ["#c9d6e8", "#e8d5c9", "#d3e8c9", "#e8c9dc", "#e8e3c9", "#c9e8e4"];

/* ---------- data ---------- */
const sampleOrders = () => {
  const n = [["Naledi M.", "naledi@example.com"], ["Ayanda K.", "ayanda@example.com"], ["Pieter v.", "pieter@example.com"], ["Sarah J.", "sarah@example.com"]];
  const t = [["Canvas Tote Bag", 1, 189], ["Ceramic Mug", 2, 129], ["Cotton T-Shirt", 1, 249], ["Wool Beanie", 2, 159]];
  return Array.from({length: 8}, (_, i) => {
    const c = n[i % 4], p = t[i % 4], d = new Date(Date.now() - (i % 7) * 864e5).toISOString().slice(0, 10);
    return {id: 1000 - i, date: d, email: c[1], name: c[0], items: [{id: i % 4 + 1, title: p[0], q: p[1]}], total: p[1] * p[2], status: i < 2 ? "Unfulfilled" : "Fulfilled"};
  });
};
const seed = () => ({
  pid: 7, oid: 1001,
  products: [
    {id: 1, title: "Canvas Tote Bag", price: 189, stock: 24, collection: "Accessories", status: "active", color: COLORS[0]},
    {id: 2, title: "Ceramic Mug", price: 129, stock: 40, collection: "Home", status: "active", color: COLORS[1]},
    {id: 3, title: "Cotton T-Shirt", price: 249, stock: 4, collection: "Apparel", status: "active", color: COLORS[2]},
    {id: 4, title: "Wool Beanie", price: 159, stock: 12, collection: "Apparel", status: "active", color: COLORS[3]},
    {id: 5, title: "Soy Candle", price: 219, stock: 0, collection: "Home", status: "active", color: COLORS[4]},
    {id: 6, title: "Leather Wallet", price: 449, stock: 9, collection: "Accessories", status: "draft", color: COLORS[5]}
  ],
  orders: sampleOrders(),
  discounts: [{code: "WELCOME10", pct: 10, active: true}]
});
let db = null;
try { db = JSON.parse(localStorage.getItem("ms-db")); } catch (e) { db = null; }
if (!db || !db.products) db = seed();
const save = () => { try { localStorage.setItem("ms-db", JSON.stringify(db)); } catch (e) {} };

/* ---------- ui state ---------- */
const ui = {mode: "shop", tab: "dash", cat: "All", q: "", sort: "feat", cart: [], code: "", open: false, step: "cart", msg: ""};
const findP = id => db.products.find(p => p.id == id);

function toast(t) {
  const e = $("#toast"); e.textContent = t; e.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("on"), 1800);
}

/* ---------- cart maths ---------- */
function calc() {
  const lines = ui.cart.map(l => ({...l, p: findP(l.id)})).filter(l => l.p);
  const sub = lines.reduce((s, l) => s + l.p.price * l.q, 0);
  const d = db.discounts.find(x => x.active && x.code === ui.code.trim().toUpperCase());
  const off = d ? Math.round(sub * d.pct) / 100 : 0;
  const ship = !sub || sub - off >= 800 ? 0 : 75;
  return {lines, sub, d, off, ship, total: sub - off + ship};
}

/* ---------- storefront ---------- */
function grid() {
  const q = ui.q.toLowerCase();
  const l = db.products.filter(p => p.status === "active" && (ui.cat === "All" || p.collection === ui.cat) && p.title.toLowerCase().includes(q));
  if (ui.sort === "lo") l.sort((a, b) => a.price - b.price);
  if (ui.sort === "hi") l.sort((a, b) => b.price - a.price);
  if (!l.length) return `<div class="empty">No products found. Try another search or collection.</div>`;
  return l.map(p => `<div class="card"><div class="sw" style="background:${p.color}">${esc(p.title[0])}</div>
    <div class="info"><h3>${esc(p.title)}</h3><span class="muted">${esc(p.collection)}${p.stock > 0 && p.stock <= 5 ? " · only " + p.stock + " left" : ""}</span><b>${R(p.price)}</b></div>
    <button class="btn" data-act="add" data-v="${p.id}" ${p.stock < 1 ? "disabled" : ""}>${p.stock < 1 ? "Sold out" : "Add to cart"}</button></div>`).join("");
}
function shop() {
  const cats = ["All", ...new Set(db.products.filter(p => p.status === "active").map(p => p.collection))];
  return `<main class="wrap"><section class="hero"><h1>Mini Store</h1><p>Simple goods, delivered. Free delivery over R800.</p></section>
  <div class="tools"><input id="q" type="search" placeholder="Search products" aria-label="Search products" value="${esc(ui.q)}">
  <select id="sort" aria-label="Sort products"><option value="feat">Featured</option><option value="lo" ${ui.sort === "lo" ? "selected" : ""}>Price: low to high</option><option value="hi" ${ui.sort === "hi" ? "selected" : ""}>Price: high to low</option></select>
  <div class="chips" role="group" aria-label="Collections">${cats.map(c => `<button class="chip" aria-pressed="${c === ui.cat}" data-act="cat" data-v="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
  <div class="grid" id="grid">${grid()}</div></main>`;
}

function cartHtml() {
  if (ui.step === "done") return `<div class="ph"><h2>Order placed</h2><button class="btn ghost" data-act="closecart">Close</button></div>
    <div class="pb"><p>Order <b>#${ui.msg}</b> is confirmed. You can see it in the admin under Orders.</p><p class="muted">Demo only, nothing was charged.</p></div>`;
  const c = calc();
  if (ui.step === "checkout") return `<div class="ph"><h2>Checkout</h2><button class="btn ghost" data-act="back">Back</button></div>
    <form id="co" class="pb" novalidate><label>Email<input name="email" type="email" autocomplete="email"><span class="err"></span></label>
    <label>Full name<input name="name" autocomplete="name"><span class="err"></span></label>
    <div class="row"><span>Total</span><b>${R(c.total)}</b></div><span class="err" id="cerr"></span><button class="btn">Pay ${R(c.total)}</button></form>`;
  if (!c.lines.length) return `<div class="ph"><h2>Your cart</h2><button class="btn ghost" data-act="closecart">Close</button></div><div class="pb"><div class="empty">Your cart is empty. Add a product to get started.</div></div>`;
  const note = !ui.code ? "" : c.d ? `<span class="muted">${esc(c.d.code)} applied: ${c.d.pct}% off</span>` : `<span class="err">That code is not valid.</span>`;
  return `<div class="ph"><h2>Your cart</h2><button class="btn ghost" data-act="closecart">Close</button></div>
  <div class="pb">${c.lines.map(l => `<div class="line"><div><b>${esc(l.p.title)}</b><div class="qty"><button data-act="qty" data-v="${l.id}|-1" aria-label="Decrease">−</button><span>${l.q}</span><button data-act="qty" data-v="${l.id}|1" aria-label="Increase">+</button></div>
    <button class="link" data-act="rm" data-v="${l.id}">Remove</button></div><b>${R(l.p.price * l.q)}</b></div>`).join("")}
    <form id="cf" class="row2"><input name="code" placeholder="Discount code" aria-label="Discount code" value="${esc(ui.code)}"><button class="btn ghost">Apply</button></form>${note}</div>
  <div class="pf"><div class="row"><span class="muted">Subtotal</span><span>${R(c.sub)}</span></div>
  ${c.off ? `<div class="row"><span class="muted">Discount</span><span>−${R(c.off)}</span></div>` : ""}
  <div class="row"><span class="muted">Delivery</span><span>${c.ship ? R(c.ship) : "Free"}</span></div>
  <div class="row"><b>Total</b><b>${R(c.total)}</b></div><button class="btn" data-act="checkout">Continue to checkout</button></div>`;
}

/* ---------- admin ---------- */
function ordersTable(l, act) {
  if (!l.length) return `<p class="muted">No orders yet. Place one from the storefront.</p>`;
  return `<div class="scroll"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th>${act ? "<th></th>" : ""}</tr></thead><tbody>
  ${l.map(o => `<tr><td>#${o.id}</td><td>${o.date}</td><td>${esc(o.name)}<br><span class="muted">${esc(o.email)}</span></td>
  <td>${o.items.map(i => esc(i.title) + " ×" + i.q).join(", ")}</td><td>${R(o.total)}</td><td><span class="pill ${o.status}">${o.status}</span></td>
  ${act ? `<td>${o.status === "Unfulfilled" ? `<button class="link" data-act="ful" data-v="${o.id}">Fulfil</button> <button class="link" data-act="can" data-v="${o.id}">Cancel</button>` : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}
const tabs = {
  dash() {
    const live = db.orders.filter(o => o.status !== "Cancelled"), sales = live.reduce((s, o) => s + o.total, 0);
    const low = db.products.filter(p => p.stock <= 5);
    const days = Array.from({length: 7}, (_, k) => { const d = new Date(Date.now() - (6 - k) * 864e5).toISOString().slice(0, 10); return {d: d.slice(5), v: live.filter(o => o.date === d).reduce((s, o) => s + o.total, 0)}; });
    const mx = Math.max(1, ...days.map(x => x.v));
    return `<h2>Dashboard</h2><div class="stats"><div><span>Total sales</span><b>${R(sales)}</b></div><div><span>Orders</span><b>${live.length}</b></div>
    <div><span>To fulfil</span><b>${db.orders.filter(o => o.status === "Unfulfilled").length}</b></div><div><span>Average order</span><b>${live.length ? R(sales / live.length) : "–"}</b></div></div>
    <h3>Sales, last 7 days</h3><div class="chart" role="img" aria-label="Sales per day: ${days.map(x => x.d + " " + R(x.v)).join(", ")}">${days.map(x => `<div><i style="height:${Math.round(x.v / mx * 100)}%"></i><span>${x.d}</span></div>`).join("")}</div>
    <h3>Low stock</h3>${low.length ? `<ul class="list">${low.map(p => `<li>${esc(p.title)} <b>${p.stock} left</b></li>`).join("")}</ul>` : `<p class="muted">All products are well stocked.</p>`}
    <h3>Recent orders</h3>${ordersTable(db.orders.slice(0, 5), false)}`;
  },
  products() {
    return `<h2>Products</h2><form id="pf" class="form" novalidate><input name="title" placeholder="Title" aria-label="Title"><input name="price" type="number" min="0" step="0.01" placeholder="Price" aria-label="Price">
    <input name="stock" type="number" min="0" placeholder="Stock" aria-label="Stock"><input name="collection" placeholder="Collection" aria-label="Collection"><button class="btn">Add product</button><span class="err" id="perr"></span></form>
    <div class="scroll"><table><thead><tr><th>Product</th><th>Collection</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>
    ${db.products.map(p => `<tr><td>${esc(p.title)}</td><td>${esc(p.collection)}</td><td>${R(p.price)}</td>
    <td><input class="n" type="number" min="0" value="${p.stock}" data-chg="stock" data-v="${p.id}" aria-label="Stock for ${esc(p.title)}"></td>
    <td><select data-chg="status" data-v="${p.id}" aria-label="Status for ${esc(p.title)}">${["active", "draft"].map(s => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></td>
    <td><button class="link" data-act="delp" data-v="${p.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
  },
  orders() { return `<h2>Orders</h2><p><button class="btn ghost" data-act="csv">Export CSV</button></p>${ordersTable(db.orders, true)}`; },
  customers() {
    const m = {};
    db.orders.filter(o => o.status !== "Cancelled").forEach(o => { const c = m[o.email] || (m[o.email] = {name: o.name, email: o.email, n: 0, s: 0}); c.n++; c.s += o.total; });
    const l = Object.values(m).sort((a, b) => b.s - a.s);
    return `<h2>Customers</h2>${l.length ? `<div class="scroll"><table><thead><tr><th>Customer</th><th>Orders</th><th>Total spent</th></tr></thead><tbody>${l.map(c => `<tr><td>${esc(c.name)}<br><span class="muted">${esc(c.email)}</span></td><td>${c.n}</td><td>${R(c.s)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No customers yet. They appear when someone places an order.</p>`}`;
  },
  discounts() {
    return `<h2>Discount codes</h2><form id="df" class="form" novalidate><input name="code" placeholder="Code, e.g. SAVE20" aria-label="Code"><input name="pct" type="number" min="1" max="90" placeholder="Percent off" aria-label="Percent off">
    <button class="btn">Add code</button><span class="err" id="derr"></span></form>
    ${db.discounts.length ? `<ul class="list">${db.discounts.map(d => `<li><span><b>${esc(d.code)}</b> · ${d.pct}% off · ${d.active ? "active" : "paused"}</span>
    <span><button class="link" data-act="tog" data-v="${esc(d.code)}">${d.active ? "Pause" : "Activate"}</button> <button class="link" data-act="deld" data-v="${esc(d.code)}">Delete</button></span></li>`).join("")}</ul>` : `<p class="muted">No codes yet. Add one above.</p>`}`;
  }
};
function admin() {
  const t = [["dash", "Dashboard"], ["products", "Products"], ["orders", "Orders"], ["discounts", "Discounts"], ["customers", "Customers"]];
  return `<div class="admin"><nav class="side" aria-label="Admin">${t.map(([k, l]) => `<button class="${ui.tab === k ? "on" : ""}" data-act="tab" data-v="${k}">${l}</button>`).join("")}
  <button class="reset" data-act="reset">Reset demo data</button></nav><section class="main">${tabs[ui.tab]()}</section></div>`;
}

/* ---------- render ---------- */
function render() {
  $("#app").innerHTML = ui.mode === "shop" ? shop() : admin();
  document.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === ui.mode));
  $("#cartbtn").hidden = ui.mode !== "shop";
  $("#cnt").textContent = ui.cart.reduce((s, l) => s + l.q, 0);
  $("#cart").hidden = $("#scrim").hidden = !ui.open;
  if (ui.open) $("#cart").innerHTML = cartHtml();
}

/* ---------- actions ---------- */
const actions = {
  cat: v => { ui.cat = v; render(); },
  tab: v => { ui.tab = v; render(); },
  opencart: () => { ui.open = true; ui.step = "cart"; render(); },
  closecart: () => { ui.open = false; render(); },
  back: () => { ui.step = "cart"; render(); },
  checkout: () => { ui.step = "checkout"; render(); },
  add: v => {
    const p = findP(v), l = ui.cart.find(x => x.id === p.id), q = (l ? l.q : 0) + 1;
    if (q > p.stock) return toast("Only " + p.stock + " in stock");
    if (l) l.q = q; else ui.cart.push({id: p.id, q: 1});
    toast(p.title + " added"); render();
  },
  qty: v => {
    const [i, d] = v.split("|"), l = ui.cart.find(x => x.id == i), p = findP(i);
    l.q = Math.min(p.stock, l.q + +d);
    if (l.q < 1) ui.cart = ui.cart.filter(x => x !== l);
    render();
  },
  rm: v => { ui.cart = ui.cart.filter(x => x.id != v); render(); },
  delp: v => { db.products = db.products.filter(p => p.id != v); ui.cart = ui.cart.filter(x => x.id != v); save(); render(); },
  ful: v => { db.orders.find(o => o.id == v).status = "Fulfilled"; save(); render(); },
  can: v => {
    const o = db.orders.find(x => x.id == v); o.status = "Cancelled";
    o.items.forEach(i => { const p = findP(i.id); if (p) p.stock += i.q; });   // put stock back
    save(); render();
  },
  tog: v => { const d = db.discounts.find(x => x.code === v); d.active = !d.active; save(); render(); },
  deld: v => { db.discounts = db.discounts.filter(x => x.code !== v); save(); render(); },
  csv: () => {
    const rows = [["Order", "Date", "Name", "Email", "Items", "Total", "Status"], ...db.orders.map(o => [o.id, o.date, o.name, o.email, o.items.map(i => i.title + " x" + i.q).join("; "), o.total, o.status])];
    const t = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], {type: "text/csv"})); a.download = "orders.csv"; a.click();
  },
  reset: () => { if (confirm("Reset all products, orders and codes?")) { db = seed(); ui.cart = []; save(); render(); } }
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act],[data-mode]"); if (!b) return;
  if (b.dataset.mode) { ui.mode = b.dataset.mode; ui.open = false; return render(); }
  const f = actions[b.dataset.act]; if (f) f(b.dataset.v);
});
document.addEventListener("change", e => {
  const t = e.target, k = t.dataset.chg; if (!k) return;
  const p = findP(t.dataset.v);
  if (k === "stock") p.stock = Math.max(0, parseInt(t.value) || 0); else p.status = t.value;
  save(); render();
});
document.addEventListener("input", e => {
  if (e.target.id === "q") { ui.q = e.target.value; $("#grid").innerHTML = grid(); }
});
document.addEventListener("change", e => {
  if (e.target.id === "sort") { ui.sort = e.target.value; $("#grid").innerHTML = grid(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.open) actions.closecart(); });

document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, d = Object.fromEntries(new FormData(f));
  if (f.id === "cf") { ui.code = d.code; render(); }

  if (f.id === "pf") {                      // add product
    const price = parseFloat(d.price), stock = parseInt(d.stock);
    if (!d.title.trim() || !(price > 0) || !(stock >= 0)) { $("#perr").textContent = "Enter a title, a price above 0 and a stock number."; return; }
    db.products.unshift({id: db.pid++, title: d.title.trim(), price, stock, collection: d.collection.trim() || "General", status: "active", color: COLORS[db.pid % COLORS.length]});
    save(); render();
  }
  if (f.id === "df") {                      // add discount code
    const code = d.code.trim().toUpperCase(), pct = parseInt(d.pct);
    if (!/^[A-Z0-9]{3,20}$/.test(code) || !(pct >= 1 && pct <= 90)) { $("#derr").textContent = "Use 3 to 20 letters or numbers and a percent from 1 to 90."; return; }
    if (db.discounts.some(x => x.code === code)) { $("#derr").textContent = "That code already exists."; return; }
    db.discounts.push({code, pct, active: true}); save(); render();
  }
  if (f.id === "co") {                      // checkout -> creates an order
    const bad = {};
    if (!/^\S+@\S+\.\S+$/.test(d.email)) bad.email = "Enter a valid email, like name@example.com.";
    if (d.name.trim().length < 2) bad.name = "Enter your full name.";
    f.querySelectorAll("input").forEach(i => i.nextElementSibling.textContent = bad[i.name] || "");
    if (Object.keys(bad).length) return;
    const c = calc();
    const short = c.lines.find(l => l.p.stock < l.q);
    if (short) { $("#cerr").textContent = short.p.title + " only has " + short.p.stock + " left. Go back and lower the quantity."; return; }
    c.lines.forEach(l => l.p.stock -= l.q);  // reduce inventory
    const id = db.oid++;
    db.orders.unshift({id, date: new Date().toISOString().slice(0, 10), email: d.email.trim(), name: d.name.trim(),
      items: c.lines.map(l => ({id: l.id, title: l.p.title, q: l.q})), total: c.total, status: "Unfulfilled"});
    save(); ui.cart = []; ui.code = ""; ui.step = "done"; ui.msg = id; render();
  }
});

render();
