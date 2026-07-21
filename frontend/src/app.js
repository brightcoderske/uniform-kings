import "@fortawesome/fontawesome-free/css/all.min.css";
import { request, asset, API } from "./api.js";
import { getCart, saveCart, addCart, countCart, totalCart } from "./store.js";
const SITE_URL = "https://uniformkings.co.ke";
const app = document.querySelector("#app"),
  money = (n) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(+n || 0),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    ),
  toast = (m, type = "success") => {
    const e = document.querySelector("#toast");
    e.textContent = m;
    e.className = type;
    setTimeout(() => (e.className = ""), 3000);
  },
  go = (p) => {
    history.pushState({}, "", p);
    document.body.classList.add("route-loading");
    Promise.resolve(render()).finally(() => document.body.classList.remove("route-loading"));
  };
let cachedConfig = {};
try { cachedConfig = JSON.parse(localStorage.getItem("uk-config-cache") || "{}"); } catch {}
let me = null,
  config = cachedConfig,
  initialHomeRequest = location.pathname === "/" ? request("/catalog/home") : null;
const sessionBootstrap = Promise.all([request("/auth/me"), request("/config")]);
const protectedStartup = location.pathname.startsWith("/admin") || ["/account", "/checkout"].includes(location.pathname);
if (protectedStartup) {
  try { [me, config] = await sessionBootstrap; localStorage.setItem("uk-config-cache", JSON.stringify(config)); } catch {}
} else {
  sessionBootstrap.then(([user, settings]) => {
    me = user; config = settings; localStorage.setItem("uk-config-cache", JSON.stringify(config));
    if (me?.role && me.role !== "customer") return go("/admin");
    const account = document.querySelector(".actions > a:first-child");
    if (account) { account.href = me ? "/account" : "/login"; const label=account.querySelector("small"); if(label) label.textContent=me ? me.name.split(" ")[0] : "Sign in"; }
  }).catch(() => {});
}
const icon = (n) => `<i class="fa-solid fa-${n}"></i>`;
function legacyHeader() {
  return `<header class="top"><div class="mini"><div>Quality uniforms. Confident futures.</div><div><a href="tel:${esc(config.contact_phone || "")}">Help & support</a></div></div><div class="head wrap"><button class="menu" aria-label="Open menu">${icon("bars")}</button><a class="brand" href="/"><img src="/logo.jpeg" alt="Uniform Kings"><span><b>UNIFORM</b><em>KINGS</em></span></a><form class="search" action="/shop"><input name="q" placeholder="Search uniforms, school or product code" aria-label="Search"><button>${icon("magnifying-glass")}<span>Search</span></button></form><nav class="actions"><a href="${me ? (me.role === "customer" ? "/account" : "/admin") : "/login"}">${icon("user")}<small>${me ? esc(me.name.split(" ")[0]) : "Sign in"}</small></a><a href="/cart">${icon("bag-shopping")}<small>Cart</small><b class="cart-count">${countCart()}</b></a></nav></div><nav class="nav"><div class="wrap"><a href="/">Home</a><a href="/shop">Shop all</a><a href="/shop?category=school-uniforms">School uniforms</a><a href="/shop?category=corporate-uniforms">Corporate</a><a href="/shop?category=sportswear">Sportswear</a><a href="/shop?category=shoes">Shoes</a><a href="/shop?category=accessories">Accessories</a><a href="/shop">Offers</a></div></nav></header><aside class="drawer"><button class="drawer-close">${icon("xmark")}</button><a href="/">Home</a><a href="/shop">Shop all</a><a href="/shop">Categories</a><a href="/shop">Find a school</a><a href="${me ? "/account" : "/login"}">My account</a><a href="/cart">My cart</a></aside><div class="scrim"></div>`;
}
function legacyFooter() {
  return `<footer><div class="wrap foot"><div class="foot-brand"><a class="brand" href="/"><img src="/logo.jpeg" alt=""><span><b>UNIFORM</b><em>KINGS</em></span></a><p>Quality schoolwear and professional uniforms, made easier to find and order.</p></div><div><h4>Shop</h4><a href="/shop">School uniforms</a><a href="/shop">Corporate uniforms</a><a href="/shop">Sportswear</a><a href="/shop">Offers</a></div><div><h4>Customer care</h4><a href="/account">My orders</a><a href="/shop">Size guide</a><a href="/">Delivery information</a><a href="/">Returns & exchanges</a></div><div><h4>Uniform Kings</h4><a href="/">About us</a><a href="/">School partnerships</a><a href="/">Bulk orders</a><a href="/">Contact us</a></div></div><div class="copyright wrap"><span>© ${new Date().getFullYear()} Uniform Kings. All rights reserved.</span><span>Secure shopping • Customer privacy protected</span></div></footer><nav class="bottom"><a href="/">${icon("house")}<span>Home</span></a><a href="/shop">${icon("border-all")}<span>Shop</span></a><a href="/shop">${icon("school")}<span>Schools</span></a><a href="/cart">${icon("bag-shopping")}<span>Cart</span><b class="cart-count">${countCart()}</b></a></nav>`;
}
const legacyProductCard = (p) =>
  `<article class="product-card"><a class="product-img" href="/product/${esc(p.slug)}">${p.image_path ? `<img loading="lazy" src="${asset(p.image_path)}" alt="${esc(p.name)}">` : `<span>${icon("shirt")}</span>`}${p.is_new ? '<b class="pill">New</b>' : ""}</a><div class="product-body"><small>${esc(p.school_name || p.category_name || "Uniform Kings")}</small><a class="product-name" href="/product/${esc(p.slug)}">${esc(p.name)}</a><div class="price"><b>${money(p.price)}</b>${p.compare_price ? `<del>${money(p.compare_price)}</del>` : ""}</div><div class="stock ${p.stock > 0 ? "in" : "out"}">${p.stock > 0 ? "In stock" : "Out of stock"}</div><a class="btn add" href="/product/${esc(p.slug)}">Choose options</a></div></article>`;
async function legacyHome() {
  const d = await request("/catalog/home");
  return `${header()}<main><section class="hero"><div class="wrap hero-grid"><div><span class="eyebrow">Uniforms made simple</span><h1>Dress smart.<br><i>Learn confidently.</i></h1><p>Find quality school, corporate and institutional uniforms in the correct colours, sizes and designs.</p><div class="hero-buttons"><a class="btn primary" href="/shop">Shop uniforms ${icon("arrow-right")}</a><a class="btn ghost" href="/shop">Find your school</a></div><div class="trust"><span>${icon("shield-halved")} Quality checked</span><span>${icon("truck-fast")} Countrywide delivery</span><span>${icon("rotate-left")} Easy exchanges</span></div></div><div class="hero-art"><div class="crest"><img src="/logo.jpeg" alt="Uniform Kings"></div><div class="hero-note"><b>Everything they need.</b><span>One reliable shop.</span></div></div></div></section><section class="school-finder wrap"><div><span class="eyebrow">Quick school finder</span><h2>Find the right uniform, faster.</h2></div><form action="/shop"><div>${icon("school")}<input name="q" placeholder="Type a school name"></div><button class="btn primary">Find uniforms</button></form></section><section class="section wrap"><div class="section-head"><div><span class="eyebrow">Browse the range</span><h2>Shop by category</h2></div><a href="/shop">View all ${icon("arrow-right")}</a></div><div class="categories">${d.categories.length ? d.categories.map((c, i) => `<a href="/shop?category=${esc(c.slug)}"><span>${["shirt", "person-running", "shoe-prints", "bag-shopping", "user-tie", "mitten"][i % 6].split("").length ? icon(["shirt", "person-running", "shoe-prints", "bag-shopping", "user-tie", "mitten"][i % 6]) : ""}</span><b>${esc(c.name)}</b><small>${esc(c.description || "Shop collection")}</small></a>`).join("") : `<div class="empty wide">Categories will appear here as soon as the store team publishes them.</div>`}</div></section><section class="section products-section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Selected for you</span><h2>Featured products</h2></div><a href="/shop">Shop all ${icon("arrow-right")}</a></div><div class="products">${d.products.length ? d.products.map(productCard).join("") : `<div class="empty wide">No products have been published yet. The catalogue is ready for the store team to add real stock.</div>`}</div></div></section><section class="promise wrap"><div><span>${icon("gem")}</span><b>Quality materials</b><p>Made for busy school days and professional teams.</p></div><div><span>${icon("ruler")}</span><b>Clear size choices</b><p>Simple options help you order with confidence.</p></div><div><span>${icon("shield")}</span><b>Secure checkout</b><p>Only payment methods approved by the store are shown.</p></div><div><span>${icon("headset")}</span><b>Real support</b><p>Get help before and after your purchase.</p></div></section></main>${footer()}`;
}
async function shop() {
  const sp = new URLSearchParams(location.search),
    [catalog, filters] = await Promise.all([
      request("/products?" + new URLSearchParams([...sp, ["paged","1"], ["per_page","25"]])),
      request("/filters"),
    ]);
  const products=catalog.items || [], page=catalog.page || 1;
  const pageLink=(next)=>{const params=new URLSearchParams(sp);params.set("page",next);return `/shop?${params}`;};
  const pagination=catalog.pages>1 ? `<nav class="catalog-pagination" aria-label="Product pages"><span>Showing ${(page-1)*catalog.per_page+1}–${Math.min(page*catalog.per_page,catalog.total)} of ${catalog.total}</span><div>${page>1?`<a href="${pageLink(page-1)}">${icon("arrow-left")} Previous</a>`:""}<b>Page ${page} of ${catalog.pages}</b>${page<catalog.pages?`<a href="${pageLink(page+1)}">Next ${icon("arrow-right")}</a>`:""}</div></nav>` : `<div class="catalog-count">Showing ${catalog.total} product${catalog.total===1?"":"s"}</div>`;
  window.__catalogPage={ total:catalog.total, html:pagination };
  const offersOnly = sp.get("offer") === "1";
  const selectedCategory = filters.categories.find((item) => item.slug === sp.get("category"));
  const shopHeading = offersOnly ? "Uniform Offers in Kenya" : selectedCategory ? `${selectedCategory.name} in Kenya` : "School Uniforms, Shoes & Workwear in Kenya";
  setSeo({ title:`${shopHeading} | Uniform Kings`, description:`Shop ${selectedCategory?.name || "school uniforms, school shoes, sweaters, shirts, trousers, sportswear and corporate uniforms"} online from Uniform Kings with convenient ordering and delivery in Kenya.`, path:location.pathname + location.search });
  return `${header()}<main class="wrap shop-page"><div class="crumb">Home / ${offersOnly ? "Offers" : "Shop"}</div><div class="shop-title"><div><span class="eyebrow">Uniform Kings catalogue</span><h1>${offersOnly ? "Current offers" : "Shop uniforms"}</h1><p>${products.length} product${products.length === 1 ? "" : "s"} available</p></div><button class="filter-toggle">${icon("sliders")} Filters</button></div><div class="shop-grid"><aside class="filters"><h3>Filter products</h3><form action="/shop">${offersOnly ? '<input type="hidden" name="offer" value="1">' : ""}<label>Search<input name="q" value="${esc(sp.get("q") || "")}" placeholder="Product or school"></label><label>Category<select name="category"><option value="">All categories</option>${filters.categories.map((x) => `<option value="${x.slug}" ${sp.get("category") === x.slug ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>School<select name="school"><option value="">All schools</option>${filters.schools.map((x) => `<option value="${x.slug}" ${sp.get("school") === x.slug ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><button class="btn primary">Apply filters</button><a href="${offersOnly ? "/shop?offer=1" : "/shop"}">Clear filters</a></form></aside><div class="products">${products.length ? products.map(productCard).join("") : `<div class="empty wide">${offersOnly ? "No offers are active right now." : "No published products match these filters."}</div>`}</div></div></main>${footer()}`;
}
async function legacyProduct(slug) {
  const p = await request("/products/" + slug);
  window.__product = p;
  return `${header()}<main class="wrap product-page"><div class="crumb">Home / Shop / ${esc(p.name)}</div><div class="product-grid"><div class="gallery"><div class="main-photo">${p.images.length ? `<img src="${asset(p.images[0].image_path)}" alt="${esc(p.images[0].alt_text || p.name)}">` : `<span>${icon("shirt")}</span>`}</div><div class="thumbs">${p.images.map((x) => `<button><img src="${asset(x.image_path)}" alt="${esc(x.alt_text || p.name)}"></button>`).join("")}</div></div><section class="details"><span class="eyebrow">${esc(p.school_name || p.category_name || "Uniform Kings")}</span><h1>${esc(p.name)}</h1><div class="sku">Product code: ${esc(p.sku)}</div><div class="detail-price">${money(p.price)} ${p.compare_price ? `<del>${money(p.compare_price)}</del>` : ""}</div><p>${esc(p.short_description || "A quality uniform item from Uniform Kings.")}</p><form id="add-form"><label>Choose size and colour<select name="variant" required><option value="">Select an available option</option>${p.variants.map((v) => `<option value="${v.id}" ${v.stock < 1 ? "disabled" : ""}>${esc([v.size, v.colour].filter(Boolean).join(" • ") || "Standard")} — ${v.stock > 0 ? `${v.stock} available` : "Out of stock"}</option>`).join("")}</select></label><div class="buy-row"><input name="quantity" type="number" min="1" max="50" value="1"><button class="btn primary" ${p.variants.some((v) => v.stock > 0) ? "" : "disabled"}>${icon("bag-shopping")} Add to cart</button></div></form><div class="share"><b>Share this product</b><button data-share>${icon("share-nodes")} Share link</button></div><div class="assurances"><div>${icon("truck")}<span><b>Flexible delivery</b><small>Choose an available delivery or pickup method at checkout.</small></span></div><div>${icon("rotate-left")}<span><b>Exchange support</b><small>Contact our team promptly if the size is not right.</small></span></div></div></section></div><section class="description"><h2>Product details</h2><p>${esc(p.description || p.short_description || "More product information will be provided by the store team.")}</p></section></main>${footer()}`;
}

async function account() {
  if (!me) return authPage("login");
  const d = await request("/catalog/home");
  return `${header()}<main class="wrap account"><aside><div class="avatar">${esc(me.name[0])}</div><h3>${esc(me.name)}</h3><span>${esc(me.email)}</span><a class="active" href="/shop">${icon("bag-shopping")} Keep shopping</a><a href="/account?section=orders">${icon("box")} My orders</a><a href="/forgot-password">${icon("key")} Change password</a><button id="logout">${icon("right-from-bracket")} Sign out</button></aside><section><span class="eyebrow">Welcome back</span><h1>Find their next uniform</h1><p class="account-lead">Your saved account makes checkout faster. Explore new products and school essentials.</p><div class="products account-products">${d.products.length ? d.products.map(productCard).join("") : '<div class="empty wide">New products will appear here as the store publishes them.</div>'}</div></section></main>${footer()}${chatWidget()}`;
}

async function checkout() {
  const c = getCart(); if (!c.length) { go("/cart"); return ""; }
  const methods = await request("/checkout/methods");
  const selected = methods.find((m) => m.is_default) || methods[0];
  return `${header()}<main class="wrap checkout"><div class="crumb">Cart / Checkout</div><div class="checkout-head"><span>${icon("lock")} Secure checkout</span><h1>Complete your order</h1></div>${methods.length ? `<form id="real-checkout-form"><section><h2><b>1</b> Contact information</h2><div class="form-grid"><label>Full name<input name="name" required value="${esc(me?.name || "")}"></label><label>Email address<input name="email" type="email" required value="${esc(me?.email || "")}"></label><label>Phone number<input name="phone" required placeholder="e.g. 0712 345 678"></label></div><h2><b>2</b> Delivery information</h2><div class="form-grid"><label>Delivery method<select name="delivery_method" required><option value="">Choose one</option><option>Home delivery</option><option>Shop pickup</option><option>School delivery</option><option>Pickup point</option></select></label><label class="full">Delivery address or pickup details<textarea name="address" required></textarea></label></div><h2><b>3</b> Choose checkout option</h2><div class="methods">${methods.map((m) => `<label><input type="radio" name="checkout_method" value="${m.code}" data-method-name="${esc(m.name)}" ${m.code === selected.code ? "checked" : ""}><span>${icon(m.code === "whatsapp" ? "comment-dots" : "wallet")}<b>${esc(m.name)}${m.is_default ? " <small>(recommended)</small>" : ""}</b><small>${esc(m.instructions || "")}</small></span></label>`).join("")}</div></section><aside class="summary"><h2>Your order</h2>${c.map((i) => `<div><span>${esc(i.name)} ${i.size ? `(${esc(i.size)}${i.colour ? `, ${esc(i.colour)}` : ""})` : ""} × ${i.quantity}</span><b>${money(i.price * i.quantity)}</b></div>`).join("")}<hr><div class="total"><span>Total</span><b>${money(totalCart())}</b></div><button class="btn primary" id="checkout-start">Continue with ${esc(selected.name)}</button><small>The button opens the checkout method selected above.</small></aside></form>` : '<div class="empty wide">Checkout is temporarily unavailable because the store has not enabled a payment or ordering method yet.</div>'}</main>${footer()}${chatWidget()}`;
}

async function adminCategories() {
  const data = await request("/admin/categories");
  window.__adminCategories=data;
  return `<div class="admin-shell">${adminSide("categories")}<main>${adminTop("Categories")}<div class="admin-content"><div class="admin-heading"><div><h1>Categories</h1><p>Create, organise and edit the collections customers browse.</p></div></div><form class="data-card category-editor category-add" data-admin-form="category"><div class="form-grid"><label>Category name<input name="name" required></label><label>Display order<input name="sort_order" type="number" value="0"></label><label class="full">Description<textarea name="description"></textarea></label></div><button class="btn primary">${icon("plus")} Add category</button></form><section class="data-card"><div class="data-head"><div><h3>Shop categories</h3><small>${data.length} categor${data.length===1?"y":"ies"}</small></div></div><div class="table-wrap"><table><thead><tr><th>Category</th><th>Description</th><th>Order</th><th>Visibility</th><th></th></tr></thead><tbody>${data.length?data.map((c)=>`<tr><td><b>${esc(c.name)}</b><small>/${esc(c.slug)}</small></td><td>${esc(c.description || "—")}</td><td>${c.sort_order || 0}</td><td><span class="status ${c.is_active?"active":""}">${c.is_active?"Visible":"Hidden"}</span></td><td><button class="table-edit" type="button" data-edit-category="${c.id}">${icon("pen")} Edit</button></td></tr>`).join(""):'<tr><td colspan="5"><div class="empty">No categories yet.</div></td></tr>'}</tbody></table></div></section><div class="catalog-modal" data-category-modal hidden><button type="button" class="modal-backdrop" data-close-category aria-label="Close"></button><form class="data-card category-editor" data-category-edit=""><div class="category-editor-head"><b>Edit category</b><button type="button" data-close-category aria-label="Close">${icon("xmark")}</button></div><div class="form-grid"><label>Name<input name="name" required></label><label>URL slug<input name="slug"></label><label>Display order<input name="sort_order" type="number"></label><label><input name="is_active" type="checkbox"> Visible in shop</label><label class="full">Description<textarea name="description"></textarea></label><label class="full">SEO title<input name="seo_title" maxlength="190"></label><label class="full">SEO description<textarea name="seo_description" maxlength="300"></textarea></label></div><button class="btn primary">Save category</button></form></div></div></main></div>`;
}

function productMetadataFields(product = {}) {
  const selected = (value, expected) => String(value || "").toLowerCase() === expected ? "selected" : "";
  return `<label>Brand<input name="brand" value="${esc(product.brand || "Uniform Kings")}" maxlength="120"></label><label>Product type<input name="product_type" value="${esc(product.product_type || "")}" placeholder="e.g. School shoes"></label><label>Gender<select name="gender"><option value="">Not specified</option><option ${selected(product.gender,"unisex")}>Unisex</option><option ${selected(product.gender,"boys")}>Boys</option><option ${selected(product.gender,"girls")}>Girls</option><option ${selected(product.gender,"men")}>Men</option><option ${selected(product.gender,"women")}>Women</option></select></label><label>Age group<select name="age_group"><option value="">Not specified</option><option ${selected(product.age_group,"kids")}>Kids</option><option ${selected(product.age_group,"teen")}>Teen</option><option ${selected(product.age_group,"adult")}>Adult</option><option ${selected(product.age_group,"all ages")}>All ages</option></select></label><label>Material<input name="material" value="${esc(product.material || "")}" placeholder="e.g. Cotton blend"></label><label>Google product category<input name="google_product_category" value="${esc(product.google_product_category || "")}" placeholder="e.g. Apparel & Accessories > Clothing"></label><label class="full">Research/source URL <small>Internal reference only</small><input name="source_url" type="url" value="${esc(product.source_url || "")}"></label>`;
}

async function adminSchools() {
  const data = await request("/admin/schools");
  return `<div class="admin-shell">${adminSide("schools")}<main>${adminTop("Schools")}<div class="admin-content"><div class="admin-heading"><div><h1>Schools</h1><p>Schools are catalogue groupings managed by the store, not customer accounts.</p></div></div><form class="quick-form" data-admin-form="school"><input name="name" placeholder="School name" required><input name="location" placeholder="Location"><select name="school_type"><option value="">School type</option><option>Primary</option><option>Secondary</option><option>College</option></select><button class="btn primary">${icon("plus")} Add school</button></form><section class="data-card"><div class="data-head"><div><h3>Partner schools</h3><small>${data.length} record${data.length === 1 ? "" : "s"}</small></div></div><div class="table-wrap"><table><thead><tr><th>School</th><th>Location</th><th>Type</th><th>Visibility</th></tr></thead><tbody>${data.length ? data.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.location || "—")}</td><td>${esc(s.school_type || "—")}</td><td><span class="status ${s.is_active ? "active" : ""}">${s.is_active ? "Active" : "Hidden"}</span></td></tr>`).join("") : '<tr><td colspan="4"><div class="empty">No schools added yet.</div></td></tr>'}</tbody></table></div></section></div></main></div>`;
}

async function adminProductNew() {
  window.__editingProduct = null;
  const filters = await request("/filters");
  return `<div class="admin-shell">${adminSide("products")}<main>${adminTop("Add product")}<div class="admin-content"><div class="admin-heading"><div><h1>Add product</h1><p>Use comma-separated sizes and colours. Stock is shared by the whole product.</p></div><a class="btn ghost" href="/admin/products">Cancel</a></div><form id="better-product-form" class="data-card product-form"><div class="form-grid"><label>Product name<input name="name" required maxlength="190"></label><label>Category<select name="category_id"><option value="">General catalogue</option>${filters.categories.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>School (optional)<select name="school_id"><option value="">Not school-specific</option>${filters.schools.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>Price (KES)<input name="price" type="number" min="0" step="0.01" required></label><label>Previous price (optional)<input name="compare_price" type="number" min="0" step="0.01"></label><label>Sizes <small>Separate with commas</small><input name="sizes" placeholder="e.g. 38, 39, 40, 41"></label><label>Colours <small>Separate with commas</small><input name="colours" placeholder="e.g. Black, Brown, Navy"></label><label>Total product stock<input name="stock" type="number" min="0" value="0" required></label><label>Product images <small>Select up to 16 images</small><input name="images" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif"></label><label class="full">Short description<textarea name="short_description" maxlength="300"></textarea></label><label class="full">Full description<textarea name="description"></textarea></label><label>Status<select name="status"><option value="active">Active</option><option value="draft">Draft</option></select></label><label><input name="is_featured" type="checkbox"> Feature on homepage</label><label><input name="is_new" type="checkbox"> Mark as new</label></div><div class="form-actions"><button class="btn primary">Save product and options</button></div></form></div></main></div>`;
}

async function adminCheckout() {
  const data = await request("/admin/checkout");
  return `<div class="admin-shell">${adminSide("checkout")}<main>${adminTop("Checkout options")}<div class="admin-content"><div class="admin-heading"><div><h1>Checkout options</h1><p>Turn methods on or off. Only one enabled method can be the default.</p></div></div><div class="checkout-admin">${data.map((m) => { let cfg={};try{cfg=typeof m.config_json === "string" ? JSON.parse(m.config_json) : m.config_json || {}}catch{} return `<form data-method="${m.id}"><div class="method-icon">${icon(m.code === "whatsapp" ? "comment-dots" : "credit-card")}</div><div class="method-fields"><label class="switch"><input type="checkbox" name="is_enabled" ${m.is_enabled ? "checked" : ""}><span></span><b>Enabled</b></label><label class="default-choice"><input type="radio" name="default-checkout" ${m.is_default ? "checked" : ""} ${m.is_enabled ? "" : "disabled"}><b>Use as default checkout</b></label><label>Display name<input name="name" value="${esc(m.name)}" required></label><label>Customer instructions<textarea name="instructions">${esc(m.instructions || "")}</textarea></label>${m.code === "whatsapp" ? `<label>WhatsApp number<input name="whatsapp_number" value="${esc(cfg.whatsapp_number || "")}" placeholder="2547…"></label>` : ""}</div><button class="btn primary">Save changes</button></form>`; }).join("")}</div></div></main></div>`;
}

function adminSide(active) {
  const link = (key, href, symbol, label) => `<a class="${active === key ? "active" : ""}" href="${href}">${icon(symbol)} ${label}</a>`;
  return `<aside class="admin-side"><a class="admin-brand" href="/admin"><img src="/logo.jpeg"><span><b>Uniform Kings</b><small>Administration</small></span></a><small>OVERVIEW</small>${link("dashboard", "/admin", "chart-pie", "Dashboard")}<small>CATALOGUE</small>${link("products", "/admin/products", "shirt", "Products")}${link("categories", "/admin/categories", "border-all", "Categories")}${link("schools", "/admin/schools", "school", "Schools")}${link("offers", "/admin/offers", "tags", "Offers")}${link("hero", "/admin/hero-images", "images", "Hero images")}${link("orders", "/admin/orders", "box", "Orders")}${link("walkins", "/admin/walkins", "cash-register", "Walk-in sale")}${link("inventory", "/admin/inventory", "warehouse", "Inventory")}<small>CONFIGURATION</small>${link("checkout", "/admin/checkout", "credit-card", "Checkout options")}${link("settings", "/admin/settings", "gear", "Settings")}</aside>`;
}

async function adminOffers() {
  const products = await request("/admin/products");
  const offers = products.filter((p) => +p.compare_price > +p.price);
  return `<div class="admin-shell">${adminSide("offers")}<main>${adminTop("Offers")}<div class="admin-content"><div class="admin-heading"><div><h1>Offers</h1><p>An offer is active when Previous price is higher than the current Price.</p></div><a class="btn primary" href="/admin/products">Manage products</a></div><section class="data-card"><div class="data-head"><div><h3>Active offers</h3><small>${offers.length} discounted product${offers.length === 1 ? "" : "s"}</small></div></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>Previous price</th><th>Offer price</th><th>Saving</th><th></th></tr></thead><tbody>${offers.length ? offers.map((p) => `<tr><td><b>${esc(p.name)}</b><small>${esc(p.category_name || "General catalogue")}</small></td><td>${money(p.compare_price)}</td><td><b>${money(p.price)}</b></td><td><span class="status active">Save ${Math.round((1 - +p.price / +p.compare_price) * 100)}%</span></td><td><a class="table-edit" href="/admin/products/${p.id}/edit">${icon("pen")} Edit offer</a></td></tr>`).join("") : '<tr><td colspan="5"><div class="empty">No offers yet. Edit a product and enter a Previous price above its current Price.</div></td></tr>'}</tbody></table></div></section></div></main></div>`;
}

async function adminHeroImages() {
  const images = await request("/admin/hero-images");
  return `<div class="admin-shell">${adminSide("hero")}<main>${adminTop("Hero images")}<div class="admin-content"><div class="admin-heading"><div><h1>Homepage hero images</h1><p>Use dedicated, high-quality banner images. Product photos are no longer used for the hero.</p></div></div><form id="hero-image-form" class="data-card product-form"><div class="hero-size-guide"><b>Recommended sizes</b><span>Desktop: 1920 × 760 px</span><span>Mobile: 900 × 1200 px</span><small>Use JPG, WebP, PNG or AVIF under 5 MB. Keep the subject near the centre; the image will crop, never stretch.</small></div><div class="form-grid"><label>Desktop image<input name="desktop_image" type="file" required accept="image/jpeg,image/png,image/webp,image/avif"></label><label>Mobile image <small>Optional but recommended</small><input name="mobile_image" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label><label>Image description<input name="alt_text" maxlength="190" placeholder="e.g. Students wearing school uniforms"></label><label>Display order<input name="sort_order" type="number" min="0" value="0"></label></div><div class="form-actions"><button class="btn primary">${icon("upload")} Upload hero image</button></div></form><section class="data-card"><div class="data-head"><div><h3>Hero gallery</h3><small>${images.length} image${images.length === 1 ? "" : "s"}</small></div></div><div class="hero-admin-grid">${images.length ? images.map((image) => `<article><img src="${asset(image.image_path)}" alt="${esc(image.alt_text || "Homepage hero")}"><div><b>${esc(image.alt_text || "Homepage banner")}</b><small>Order ${image.sort_order} · ${image.is_active ? "Visible" : "Hidden"}</small><span><button class="btn ghost" data-hero-toggle="${image.id}" data-active="${image.is_active ? 0 : 1}">${image.is_active ? "Hide" : "Show"}</button><button class="btn danger" data-hero-delete="${image.id}">Delete</button></span></div></article>`).join("") : '<div class="empty wide">No hero images uploaded yet.</div>'}</div></section></div></main></div>`;
}

async function adminInventory() {
  const products = await request("/admin/products");
  return `<div class="admin-shell">${adminSide("inventory")}<main>${adminTop("Inventory")}<div class="admin-content"><div class="admin-heading"><div><h1>Inventory</h1><p>Live stock across every product option.</p></div><a class="btn primary" href="/admin/products/new">${icon("plus")} Add product</a></div><section class="data-card"><div class="data-head"><div><h3>Stock levels</h3><small>${products.length} product${products.length === 1 ? "" : "s"}</small></div></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Available stock</th><th>Stock state</th><th></th></tr></thead><tbody>${products.length ? products.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.category_name || "General")}</td><td><b>${p.stock}</b></td><td><span class="status ${+p.stock > 5 ? "active" : "pending"}">${+p.stock > 5 ? "In stock" : +p.stock ? "Low stock" : "Out of stock"}</span></td><td><a class="table-edit" href="/admin/products/${p.id}/edit">Edit</a></td></tr>`).join("") : '<tr><td colspan="5"><div class="empty">No inventory yet.</div></td></tr>'}</tbody></table></div></section></div></main></div>`;
}

async function adminSettings() {
  const data = await request("/admin/settings");
  return `<div class="admin-shell">${adminSide("settings")}<main>${adminTop("Store settings")}<div class="admin-content"><div class="admin-heading"><div><h1>Store settings</h1><p>Update the public contact details shown across the shop.</p></div></div><form id="store-settings-form" class="data-card product-form"><div class="form-grid"><label>Store name<input name="site_name" value="${esc(data.site_name || "Uniform Kings")}" required></label><label>Contact phone<input name="contact_phone" value="${esc(data.contact_phone || "")}" inputmode="tel"></label><label>Contact email<input name="contact_email" value="${esc(data.contact_email || "")}" type="email"></label><label>WhatsApp number<input name="whatsapp_number" value="${esc(data.whatsapp_number || "")}" inputmode="tel"></label></div><div class="form-actions"><button class="btn primary">Save settings</button></div></form></div></main></div>`;
}

function recoveryPage(reset = false) {
  return `${header()}<main class="auth-page"><section><a class="brand" href="/"><img src="/logo.jpeg"><span><b>UNIFORM KINGS</b><em>QUALITY UNIFORMS · PROUD FUTURES</em></span></a><span class="eyebrow">Account security</span><h1>${reset ? "Choose a new password" : "Reset your password"}</h1><p>${reset ? "Enter a strong new password to continue shopping." : "Enter your email and we will send a secure reset link."}</p><form id="${reset ? "reset-password-form" : "forgot-password-form"}">${reset ? "" : '<label>Email address<input type="email" name="email" required autocomplete="email"></label>'}${reset ? '<label>New password<input type="password" name="password" minlength="8" required autocomplete="new-password"></label>' : ""}<button class="btn primary">${reset ? "Save new password" : "Send reset link"}</button></form><small><a href="/login">Back to sign in</a></small></section><aside><img src="/logo.jpeg" alt=""><h2>Shop with confidence.</h2></aside></main>${footer()}`;
}

async function render() {
  window.scrollTo(0, 0);
  let path = location.pathname;
  if (me && me.role !== "customer" && !path.startsWith("/admin")) { history.replaceState({}, "", "/admin"); path = "/admin"; }
  const privatePage = path.startsWith("/admin") || ["/account", "/cart", "/checkout", "/login", "/register", "/forgot-password", "/reset-password"].includes(path);
  setSeo({ title:"Uniform Kings Kenya | Quality Uniforms", description:"Shop school uniforms, school shoes, sportswear and professional uniforms from Uniform Kings Kenya.", path, robots:privatePage ? "noindex,nofollow" : undefined });
  try {
    if (path === "/") app.innerHTML = await managedHome();
    else if (path === "/shop") app.innerHTML = await shop();
    else if (path.startsWith("/product/")) app.innerHTML = await product(decodeURIComponent(path.split("/").pop()));
    else if (path === "/cart") app.innerHTML = cartPage();
    else if (path === "/checkout") app.innerHTML = await checkout();
    else if (path === "/login") app.innerHTML = authPage("login");
    else if (path === "/register") app.innerHTML = authPage("register");
    else if (path === "/forgot-password") app.innerHTML = recoveryPage();
    else if (path === "/reset-password") app.innerHTML = recoveryPage(true);
    else if (["/about", "/delivery", "/returns", "/privacy"].includes(path)) app.innerHTML = informationPage(path.slice(1));
    else if (path === "/account") app.innerHTML = await account();
    else if (path === "/admin") app.innerHTML = await adminDashboard();
    else if (path === "/admin/products") app.innerHTML = await adminProducts();
    else if (/^\/admin\/products\/\d+\/edit$/.test(path)) app.innerHTML = await adminProductEdit(path.split("/")[3]);
    else if (path === "/admin/products/new") app.innerHTML = await adminProductNew();
    else if (path === "/admin/categories") app.innerHTML = await adminCategories();
    else if (path === "/admin/schools") app.innerHTML = await adminSchools();
    else if (path === "/admin/offers") app.innerHTML = await adminOffers();
    else if (path === "/admin/hero-images") app.innerHTML = await adminHeroImages();
    else if (path === "/admin/orders") app.innerHTML = await betterAdminOrders();
    else if (path === "/admin/walkins") app.innerHTML = await adminWalkins();
    else if (path === "/admin/inventory") app.innerHTML = await adminInventory();
    else if (path === "/admin/settings") app.innerHTML = await adminSettings();
    else if (path.startsWith("/admin/receipt/")) app.innerHTML = await orderDetailPage(path.split("/").pop());
    else if (path === "/admin/checkout") app.innerHTML = await adminCheckout();
    else app.innerHTML = `${header()}<main class="not-found"><h1>404</h1><p>We could not find that page.</p><a class="btn primary" href="/">Go home</a></main>${footer()}`;
    if (!path.startsWith("/admin") && !document.querySelector("#product-helper"))
      app.insertAdjacentHTML("beforeend", chatWidget());
    bind();
    enhanceInputs();
    if (location.hash) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior:"smooth", block:"start" }));
    if (path === "/") startHeroSlides();
    if (path === "/admin" && document.querySelector("#sales-chart")) {
      const d = window.__dashboard;
      const { Chart } = await import("chart.js/auto");
      new Chart(document.querySelector("#sales-chart"), { type: "line", data: { labels: d.sales.map((x) => new Date(x.day).toLocaleDateString("en-KE", { month: "short", day: "numeric" })), datasets: [{ data: d.sales.map((x) => x.total), borderColor: "#c9972d", backgroundColor: "rgba(201,151,45,.12)", fill: true, tension: .35 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }, responsive: true, maintainAspectRatio: false } });
    }
  } catch (e) { if (path.startsWith("/admin") && app.querySelector(".admin-shell")) toast("Store data is taking longer to load. Please try again shortly.", "error"); else app.innerHTML = `${header()}<main class="not-found"><h1>We are still loading this page</h1><p>The connection is taking longer than expected.</p><button class="btn primary" onclick="location.reload()">Try again</button></main>${footer()}`; }
  if(location.pathname==="/admin/walkins"&&window.__walkinProducts){const list=document.querySelector(".pos-product-list");if(list&&!document.querySelector("[data-pos-search]")){list.insertAdjacentHTML("beforebegin",`<label class="pos-search">${icon("magnifying-glass")}<input data-pos-search placeholder="Search product, category or school" autocomplete="off"><small data-pos-count>${window.__walkinProducts.length} available products</small></label>`);list.querySelectorAll("[data-pos-product]").forEach((button,index)=>{const product=window.__walkinProducts[index];button.dataset.searchText=[product.name,product.category_name,product.school_name].filter(Boolean).join(" ").toLowerCase();button.insertAdjacentHTML("afterbegin",product.image_path?`<img src="${asset(product.image_path)}" alt="${esc(product.name)}">`:`<span class="pos-product-placeholder">${icon("shirt")}</span>`);});}}
}

document.addEventListener("click", async (event) => {
  const adminMenu = event.target.closest(".admin-menu");
  if (adminMenu) {
    document.body.classList.toggle("admin-menu-open");
    let scrim = document.querySelector(".admin-scrim");
    if (!scrim) {
      scrim = document.createElement("button");
      scrim.className = "admin-scrim";
      scrim.setAttribute("aria-label", "Close navigation");
      document.body.append(scrim);
    }
    return;
  }
  if (event.target.closest(".admin-scrim")) {
    document.body.classList.remove("admin-menu-open");
    event.target.closest(".admin-scrim").remove();
    return;
  }
  const link = event.target.closest('a[href^="/"]');
  if (link && !event.ctrlKey && !event.metaKey) { event.preventDefault(); document.body.classList.remove("menu-open", "admin-menu-open"); document.querySelector(".admin-scrim")?.remove(); go(link.getAttribute("href")); return; }
  const imageButton = event.target.closest("[data-product-image]");
  if (imageButton) { document.querySelector("#main-product-image").src = imageButton.dataset.productImage; return; }
  const option = event.target.closest(".option-box");
  if (option) { option.classList.toggle("selected"); updateSelectedOptions(); return; }
  const helper = event.target.closest(".helper-toggle");
  if (helper) { document.querySelector("#product-helper").classList.toggle("open"); return; }
  const helperQuestion = event.target.closest("[data-helper-question]");
  if (helperQuestion) { const form=document.querySelector("#helper-search"); form.q.value=helperQuestion.dataset.helperQuestion; form.requestSubmit(); return; }
  if (event.target.closest("[data-close-helper]")) { document.querySelector("#product-helper")?.classList.remove("open"); return; }
});

function updateSelectedOptions() {
  const sizes = [...document.querySelectorAll(".option-box.selected[data-size]")].map((b) => b.dataset.size);
  const colours = [...document.querySelectorAll(".option-box.selected[data-colour]")].map((b) => b.dataset.colour);
  const count = Math.max(1, sizes.length || 1) * Math.max(1, colours.length || 1);
  const status = document.querySelector(".selected-options");
  if (status) status.textContent = (sizes.length || colours.length) ? `${count} option${count === 1 ? "" : "s"} selected — each will appear separately in your cart.` : "Choose options to add them as separate cart items.";
}

document.addEventListener("submit", async (event) => {
  if (event.target.id === "store-settings-form") {
    event.preventDefault();
    const button = event.target.querySelector("button"); button.disabled = true; button.textContent = "Saving…";
    try { await request("/admin/settings", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); config = await request("/config"); button.textContent = "Saved"; toast("Store settings saved."); }
    catch (error) { toast(error.message, "error"); button.disabled = false; button.textContent = "Save settings"; }
    return;
  }
  const form = event.target;
  if (form.id === "variant-add-form") {
    event.preventDefault(); const p = window.__product; const sizes = [...form.querySelectorAll("[data-size].selected")].map((b) => b.dataset.size) || []; const colours = [...form.querySelectorAll("[data-colour].selected")].map((b) => b.dataset.colour) || []; const qty = Math.max(1, +form.querySelector("[name=quantity-visible]").value || 1); const wantedSizes = sizes.length ? sizes : [""]; const wantedColours = colours.length ? colours : [""]; let added = 0;
    for (const size of wantedSizes) for (const colour of wantedColours) { const variant = p.variants.find((v) => (v.size || "") === size && (v.colour || "") === colour && v.stock > 0); if (variant) { addCart(p, variant, qty); added++; } }
    if (!added) return toast("Choose an available size and colour combination.", "error"); toast(`${added} option${added === 1 ? "" : "s"} added as separate cart items.`); go("/cart");
  }
  if (form.id === "real-checkout-form") {
    event.preventDefault(); const button = form.querySelector("#checkout-start"); button.disabled = true; const b = Object.fromEntries(new FormData(form)); b.items = getCart().map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }));
    try { const r = await request("/orders", { method: "POST", body: JSON.stringify(b) }); saveCart([]); let cfg = r.checkout_method.config_json; try { cfg = typeof cfg === "string" ? JSON.parse(cfg) : cfg || {}; } catch {} if (r.checkout_method.code === "whatsapp" && cfg.whatsapp_number) { location.href = `https://wa.me/${cfg.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello Uniform Kings, I have placed order ${r.order_number}.`)}`; } else { app.innerHTML = `${header()}<main class="success-page">${icon("circle-check")}<h1>Order received</h1><p>Your order number is <b>${esc(r.order_number)}</b>.</p><p>${esc(r.checkout_method.instructions || "Follow the selected checkout instructions to complete payment.")}</p><a class="btn primary" href="/account">Continue shopping</a></main>${footer()}`; } } catch (x) { toast(x.message, "error"); button.disabled = false; }
  }
  if (form.id === "helper-search") { event.preventDefault(); const q = new FormData(form).get("q"); const result = await request(`/products?q=${encodeURIComponent(q)}`); const target = form.closest(".helper-panel").querySelector(".helper-results"); target.innerHTML = result.length ? result.slice(0, 5).map((p) => `<a href="/product/${p.slug}">${p.image_path ? `<img src="${asset(p.image_path)}" alt="">` : ""}<span>${esc(p.name)}<small>${money(p.price)}</small></span></a>`).join("") : "<small>No matching products yet.</small>"; }
  if (form.id === "forgot-password-form") { event.preventDefault(); await request("/auth/forgot-password", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); toast("If the account exists, the reset link has been sent."); }
  if (form.id === "reset-password-form") { event.preventDefault(); const token = new URLSearchParams(location.search).get("token"); try { await request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: new FormData(form).get("password") }) }); toast("Password updated. Please sign in."); go("/login"); } catch (x) { toast(x.message, "error"); } }
  if (form.dataset.adminForm === "category" || form.dataset.adminForm === "school") { event.preventDefault(); const type = form.dataset.adminForm; try { await request(`/admin/${type === "category" ? "categories" : "schools"}`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); toast(`${type === "category" ? "Category" : "School"} added.`); render(); } catch (x) { toast(x.message, "error"); } }
  if (form.id === "better-product-form") { event.preventDefault(); const fd = new FormData(form), button = form.querySelector("button"); button.disabled = true; try { const product = await request("/admin/products", { method: "POST", body: JSON.stringify({ name:fd.get("name"), category_id:fd.get("category_id"), school_id:fd.get("school_id"), price:fd.get("price"), compare_price:fd.get("compare_price"), stock:fd.get("stock"), short_description:fd.get("short_description"), description:fd.get("description"), status:fd.get("status"), is_featured:fd.has("is_featured"), is_new:fd.has("is_new") }) }); const sizes = String(fd.get("sizes") || "").split(",").map((x)=>x.trim()).filter(Boolean); const colours = String(fd.get("colours") || "").split(",").map((x)=>x.trim()).filter(Boolean); const variants = (sizes.length ? sizes : [""]).flatMap((size) => (colours.length ? colours : [""]).map((colour) => ({size,colour}))); await request(`/admin/products/${product.id}/variants`, {method:"POST",body:JSON.stringify({variants})}); const images = new FormData(); [...fd.getAll("images")].filter((f)=>f.size).forEach((f)=>images.append("images",f)); images.append("alt_text",fd.get("name")); if ([...images.keys()].filter((k)=>k==="images").length) await request(`/admin/products/${product.id}/images`,{method:"POST",body:images}); toast("Product and options created.");go("/admin/products"); } catch(x){toast(x.message,"error");button.disabled=false;} }
});

function enhanceInputs() {
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.parentElement?.classList.contains("password-field")) return;
    const wrap = document.createElement("div"); wrap.className = "password-field";
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    const button = document.createElement("button"); button.type = "button"; button.className = "password-toggle"; button.setAttribute("aria-label", "Show password"); button.innerHTML = icon("eye"); wrap.appendChild(button);
  });
  document.querySelectorAll("#better-product-form .form-grid, #edit-product-form .form-grid").forEach((grid) => {
    if (grid.querySelector('[name="gender"]')) return;
    const anchor = grid.querySelector('[name="school_id"]')?.closest("label");
    if (!anchor) return;
    anchor.insertAdjacentHTML("afterend", productMetadataFields(window.__editingProduct || {}));
  });
  if (document.querySelector(".shop-page") && window.__catalogPage) {
    const count=document.querySelector(".shop-title p"); if(count)count.textContent=`${window.__catalogPage.total} product${window.__catalogPage.total===1?"":"s"} available`;
    const grid=document.querySelector(".shop-grid"); if(grid&&!grid.nextElementSibling?.matches(".catalog-pagination,.catalog-count"))grid.insertAdjacentHTML("afterend",window.__catalogPage.html);
  }
  const gallery=document.querySelector(".product-page .gallery");
  if(gallery&&window.__product?.images?.some((image)=>image.license_name||image.credit_text)){
    gallery.insertAdjacentHTML("beforeend",`<details class="image-credits"><summary>Image credits</summary>${window.__product.images.filter((image)=>image.license_name||image.credit_text).map((image)=>`<p>${esc(image.credit_text||"Image contributor")} · ${esc(image.license_name||"Licensed image")}${image.source_url?` · <a href="${esc(image.source_url)}" target="_blank" rel="noopener">Source</a>`:""}</p>`).join("")}</details>`);
  }
  const categoryButtons=[...document.querySelectorAll("[data-edit-category]")];
  categoryButtons.forEach((button)=>{const row=button.closest("tr");row.draggable=true;row.dataset.categoryRow=button.dataset.editCategory;row.title="Drag to change display order";});
  if(categoryButtons.length){const guide=categoryButtons[0].closest(".data-card")?.querySelector(".data-head small");if(guide)guide.textContent+=window.matchMedia("(pointer: coarse)").matches?" · Edit the order number to reorder":" · Drag rows to reorder";}
  if(location.pathname==="/admin/products"&&window.__adminProducts){document.querySelectorAll(".admin-content tbody tr").forEach((row,index)=>{const product=window.__adminProducts[index],cell=row.querySelector("td");if(!product||!cell||cell.querySelector(".admin-product-thumb"))return;cell.insertAdjacentHTML("afterbegin",product.image_path?`<img class="admin-product-thumb" src="${asset(product.image_path)}" alt="${esc(product.name)}">`:`<span class="admin-product-thumb empty-thumb">${icon("shirt")}</span>`);});}
  if(location.pathname==="/admin/products"&&window.__adminProductPage){const {catalog,filters,sp}=window.__adminProductPage,section=document.querySelector(".admin-content .data-card"),small=section?.querySelector(".data-head small");if(small)small.textContent=`${catalog.total} product${catalog.total===1?"":"s"} · showing ${catalog.items.length}`;section?.querySelector(".data-head>label")?.remove();if(section&&!document.querySelector("[data-admin-product-filter]")){section.insertAdjacentHTML("beforebegin",`<form class="admin-product-filters" data-admin-product-filter><label>${icon("magnifying-glass")}<input name="q" value="${esc(sp.get("q")||"")}" placeholder="Search product, category or school"></label><select name="category"><option value="">All categories</option>${filters.categories.map((category)=>`<option value="${esc(category.slug)}" ${sp.get("category")===category.slug?"selected":""}>${esc(category.name)}</option>`).join("")}</select><select name="status"><option value="">All statuses</option>${["active","draft","archived"].map((status)=>`<option value="${status}" ${sp.get("status")===status?"selected":""}>${status[0].toUpperCase()+status.slice(1)}</option>`).join("")}</select><button class="btn primary">Filter</button><a href="/admin/products">Clear</a></form>`);const link=(page)=>{const params=new URLSearchParams(sp);params.set("page",page);return `/admin/products?${params}`;};section.insertAdjacentHTML("afterend",`<nav class="catalog-pagination"><span>Showing ${catalog.total?((catalog.page-1)*catalog.per_page)+1:0}–${Math.min(catalog.page*catalog.per_page,catalog.total)} of ${catalog.total}</span><div>${catalog.page>1?`<a href="${link(catalog.page-1)}">${icon("arrow-left")} Previous</a>`:""}<b>Page ${catalog.page} of ${catalog.pages}</b>${catalog.page<catalog.pages?`<a href="${link(catalog.page+1)}">Next ${icon("arrow-right")}</a>`:""}</div></nav>`);}}
}

document.addEventListener("click", async (event) => {
  const toggle = event.target.closest(".password-toggle");
  if (toggle) { const input=toggle.parentElement.querySelector("input"); const hidden=input.type === "password"; input.type=hidden ? "text" : "password"; toggle.innerHTML=icon(hidden ? "eye-slash" : "eye"); toggle.setAttribute("aria-label", hidden ? "Hide password" : "Show password"); return; }
  const accountLink = event.target.closest(".actions > a:first-child");
  if (accountLink && me) { event.preventDefault(); event.stopImmediatePropagation(); document.querySelector(".quick-account-menu")?.remove(); const box=document.createElement("div"); box.className="quick-account-menu"; const rect=accountLink.getBoundingClientRect(); box.style.top=`${rect.bottom+10}px`; box.style.left=`${Math.max(10,rect.right-210)}px`; box.innerHTML=`<a href="/account">${icon("user")} My account</a><a href="/account?section=orders">${icon("box")} My orders</a><a href="/forgot-password">${icon("key")} Change password</a><button data-quick-logout>${icon("right-from-bracket")} Sign out</button>`; document.body.append(box); return; }
  if (event.target.closest("[data-quick-logout]")) { await request("/auth/logout",{method:"POST"}); me=null; go("/"); }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "helper-search") return;
  event.preventDefault(); event.stopImmediatePropagation();
  const query=String(new FormData(event.target).get("q")||"").trim(), lower=query.toLowerCase(), target=event.target.closest(".helper-panel").querySelector(".helper-results");
  const answers = lower.includes("deliver") ? "Available delivery, school delivery, pickup and collection choices appear at checkout. The available choice can depend on your destination." : lower.includes("return") || lower.includes("exchange") ? "Contact Uniform Kings promptly with your order number. Keep the item unused, clean and in its original condition while the exchange request is reviewed." : lower.includes("size") ? "Open a product and tap its available size and colour boxes. You can select several combinations and each enters the cart separately." : lower.includes("school") ? "Type the school name in the main search. If its uniforms are active, the matching products will be displayed." : lower.includes("pay") || lower.includes("mpesa") ? "Checkout displays only the payment and ordering methods currently enabled by Uniform Kings. Select a method to begin that process." : lower.includes("order") ? "Sign in and open My orders to review your online orders. For further help, contact customer care with the order number." : lower.includes("contact") || lower.includes("phone") || lower.includes("whatsapp") ? `You can contact Uniform Kings through the Contact us link in the footer${config.whatsapp_number ? ` or WhatsApp ${config.whatsapp_number}` : ""}.` : lower.includes("quality") ? "Uniform Kings focuses on practical, clearly described uniform products with real size, colour and stock choices managed by the store." : "";
  if (answers) { target.innerHTML=`<div class="helper-answer">${esc(answers)}</div>`; return; }
  try { const result=await request(`/products?q=${encodeURIComponent(query)}`); target.innerHTML=result.length ? result.slice(0,5).map((p)=>`<a href="/product/${p.slug}">${p.image_path?`<img src="${asset(p.image_path)}" alt="">`:""}<span>${esc(p.name)}<small>${money(p.price)}</small></span></a>`).join("") : '<small>Try asking about delivery, sizes, exchanges, schools or a product name.</small>'; } catch(error){ target.innerHTML='<small>I could not reach the catalogue just now.</small>'; }
});

function productCard(product) {
  const images = String(product.image_paths || product.image_path || "").split("|").filter(Boolean);
  const discount = +product.compare_price > +product.price ? Math.round((1 - +product.price / +product.compare_price) * 100) : 0;
  const saving = discount ? +product.compare_price - +product.price : 0;
  return `<article class="product-card storefront-card"><a class="product-img" href="/product/${esc(product.slug)}"><div class="card-image-track">${images.length ? images.map((src) => `<img loading="lazy" src="${asset(src)}" alt="${esc(product.name)}">`).join("") : `<span>${icon("shirt")}</span>`}</div>${discount ? `<b class="pill offer-pill">Save ${money(saving)}</b>` : product.is_new ? '<b class="pill">NEW</b>' : ""}</a><div class="product-body"><a class="product-name" href="/product/${esc(product.slug)}">${esc(product.name)}</a><div class="price"><span class="price-values">${discount ? `<del>${money(product.compare_price)}</del>` : ""}<b>${money(product.price)}</b></span><a class="card-cart" href="/product/${esc(product.slug)}" aria-label="Choose options for ${esc(product.name)}" title="Choose size and colour">${icon("cart-plus")}</a></div></div></article>`;
}

async function adminProducts() {
  const sp=new URLSearchParams(location.search);
  const [catalog,filters]=await Promise.all([request("/admin/products?"+new URLSearchParams([...sp,["paged","1"]])),request("/filters")]);
  const products=catalog.items || [];
  window.__adminProducts=products;
  window.__adminProductPage={catalog,filters,sp};
  return `<div class="admin-shell">${adminSide("products")}<main>${adminTop("Products")}<div class="admin-content"><div class="admin-heading"><div><h1>Products</h1><p>Manage products, images, prices, categories and stock options.</p></div><a class="btn primary" href="/admin/products/new">${icon("plus")} Add product</a></div><section class="data-card"><div class="data-head"><div><h3>Product catalogue</h3><small>${products.length} product${products.length === 1 ? "" : "s"}</small></div><label>${icon("magnifying-glass")}<input data-table-search placeholder="Search products"></label></div><div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>${products.length ? products.map((p) => `<tr><td><b>${esc(p.name)}</b><small>${esc(p.school_name || "General catalogue")}</small></td><td>${esc(p.category_name || "—")}</td><td>${money(p.price)}</td><td><b>${p.stock}</b></td><td><span class="status ${p.status}">${esc(p.status)}</span></td><td><a class="table-edit" href="/admin/products/${p.id}/edit">${icon("pen")} Edit</a></td></tr>`).join("") : '<tr><td colspan="6"><div class="empty">No products yet.</div></td></tr>'}</tbody></table></div></section></div></main></div>`;
}

async function adminProductEdit(id) {
  const [products, filters] = await Promise.all([request("/admin/products"), request("/filters")]);
  const p = products.find((product) => +product.id === +id);
  if (!p) throw new Error("Product not found.");
  const detail = await request(`/admin/products/${p.id}`);
  window.__editingProduct = detail;
  const sizes = [...new Set(detail.variants.map((v) => v.size).filter(Boolean))].join(", ");
  const colours = [...new Set(detail.variants.map((v) => v.colour).filter(Boolean))].join(", ");
  const images = detail.images.map((image) => `<img src="${asset(image.image_path)}" alt="${esc(image.alt_text || p.name)}">`).join("");
  return `<div class="admin-shell">${adminSide("products")}<main>${adminTop("Edit product")}<div class="admin-content"><div class="admin-heading"><div><h1>Edit product</h1><p>Edit every product detail, option, image and shared stock quantity.</p></div><a class="btn ghost" href="/admin/products">Back to products</a></div><form id="edit-product-form" data-product-id="${p.id}" class="data-card product-form"><div class="form-grid"><label>Product name<input name="name" value="${esc(p.name)}" required></label><label>Category<select name="category_id"><option value="">General catalogue</option>${filters.categories.map((x) => `<option value="${x.id}" ${+p.category_id === +x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>School<select name="school_id"><option value="">Not school-specific</option>${filters.schools.map((x) => `<option value="${x.id}" ${+p.school_id === +x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>Price (KES)<input name="price" type="number" min="0" step="0.01" value="${p.price}" required></label><label>Previous price<input name="compare_price" type="number" min="0" step="0.01" value="${p.compare_price || ""}"></label><label>Total product stock <small>Shared across all options</small><input name="stock" type="number" min="0" value="${p.stock}" required></label><label>Sizes <small>Separate with commas</small><input name="sizes" value="${esc(sizes)}"></label><label>Colours <small>Separate with commas</small><input name="colours" value="${esc(colours)}"></label><label>Status<select name="status"><option value="active" ${p.status === "active" ? "selected" : ""}>Active</option><option value="draft" ${p.status === "draft" ? "selected" : ""}>Draft</option><option value="archived" ${p.status === "archived" ? "selected" : ""}>Archived</option></select></label><label>Upload more images <small>Select up to 16</small><input name="images" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif"></label>${images ? `<div class="full edit-product-images">${images}</div>` : ""}<label class="full">Short description<textarea name="short_description" maxlength="300">${esc(p.short_description || "")}</textarea></label><label class="full">Full description<textarea name="description">${esc(p.description || "")}</textarea></label><label class="full">SEO title<input name="seo_title" value="${esc(p.seo_title || "")}" maxlength="190"></label><label class="full">SEO description<textarea name="seo_description" maxlength="300">${esc(p.seo_description || "")}</textarea></label><label><input name="is_featured" type="checkbox" ${p.is_featured ? "checked" : ""}> Feature on homepage</label><label><input name="is_new" type="checkbox" ${p.is_new ? "checked" : ""}> Mark as new</label></div><div class="form-actions"><button class="btn primary">Save all changes</button></div></form></div></main></div>`;
}

async function home() {
  const d = await request("/catalog/home");
  const slides = d.heroImages || [];
  return `${header()}<main><section class="landing-hero"><div class="hero-slides">${slides.length ? slides.map((slide, index) => `<a href="/product/${esc(slide.slug)}" class="hero-slide ${index === 0 ? "show" : ""}" style="background-image:linear-gradient(90deg,rgba(4,18,44,.78),rgba(4,18,44,.30)),url('${asset(slide.image_path)}')"></a>`).join("") : '<div class="hero-slide show hero-empty"></div>'}</div><div class="landing-overlay wrap"><div class="landing-brand"><img src="/logo.jpeg" alt="Uniform Kings"><div><b>UNIFORM KINGS</b><span>QUALITY UNIFORMS · PROUD FUTURES</span></div></div><h1>Everything they need.<br><i>One reliable uniform shop.</i></h1><p>Shop schoolwear, shoes, sportswear and professional uniforms with easy size and colour choices.</p><div class="hero-buttons"><a class="btn primary" href="/shop">Shop uniforms ${icon("arrow-right")}</a><a class="btn hero-outline" href="/shop">Find your school ${icon("school")}</a></div></div><div class="hero-dots">${slides.slice(0,5).map((_, index) => `<button aria-label="Show image ${index + 1}" class="${index === 0 ? "active" : ""}" data-hero-dot="${index}"></button>`).join("")}</div></section><section class="mobile-trust wrap"><span>${icon("shield-halved")} Quality</span><span>${icon("truck-fast")} Delivery</span><span>${icon("rotate-left")} Exchanges</span></section><section class="landing-categories wrap"><div class="section-head"><div><span class="eyebrow">Browse by need</span><h2>Shop categories</h2></div><a href="/shop">All products ${icon("arrow-right")}</a></div><div class="category-strip">${d.categories.length ? d.categories.map((c, index) => `<a href="/shop?category=${esc(c.slug)}"><span>${icon(["shirt","shoe-prints","bag-shopping","person-running","user-tie","mitten"][index % 6])}</span><b>${esc(c.name)}</b></a>`).join("") : '<div class="empty wide">Publish a category with active products and it will appear here.</div>'}</div></section><section class="landing-products wrap"><div class="section-head"><div><span class="eyebrow">Top deals & new arrivals</span><h2>Popular products</h2></div><a href="/shop">Shop all ${icon("arrow-right")}</a></div><div class="products product-showcase">${d.products.length ? d.products.map(productCard).join("") : '<div class="empty wide">Products will appear here when the store publishes active stock.</div>'}</div></section></main>${footer()}`;
}

async function polishedHome() {
  const d = await request("/catalog/home"), slides = d.heroImages || [];
  return `${header()}<main><section class="landing-hero"><div class="hero-slides">${slides.length ? slides.map((slide, index) => `<a href="/product/${esc(slide.slug)}" class="hero-slide ${index === 0 ? "show" : ""}" style="background-image:linear-gradient(rgba(4,18,44,.62),rgba(4,18,44,.62)),url('${asset(slide.image_path)}')"></a>`).join("") : '<div class="hero-slide show hero-empty"></div>'}</div><div class="landing-overlay wrap hero-centred"><div class="landing-brand hero-logo-only"><img src="/logo.jpeg" alt="Uniform Kings"></div><h1><i>One reliable uniform shop.</i></h1><p>Shop schoolwear, shoes, sportswear and professional uniforms with easy size and colour choices.</p><div class="hero-buttons"><a class="btn primary" href="/shop">Shop uniforms ${icon("arrow-right")}</a><a class="btn hero-outline" href="/shop">Find your school ${icon("school")}</a></div></div><div class="hero-dots">${slides.slice(0,5).map((_, index) => `<button aria-label="Show image ${index + 1}" class="${index === 0 ? "active" : ""}" data-hero-dot="${index}"></button>`).join("")}</div></section><section class="mobile-trust wrap"><span>${icon("shield-halved")} Quality</span><span>${icon("truck-fast")} Delivery</span><span>${icon("rotate-left")} Exchanges</span></section><section class="landing-products wrap"><div class="section-head"><div><span class="eyebrow">Top deals & new arrivals</span><h2>Popular products</h2></div><a href="/shop">Shop all ${icon("arrow-right")}</a></div><div class="products product-showcase">${d.products.length ? d.products.map(productCard).join("") : '<div class="empty wide">Products will appear here when the store publishes active stock.</div>'}</div></section></main>${footer()}`;
}

async function managedHome() {
  const homeRequest = initialHomeRequest;
  initialHomeRequest = null;
  let cachedHome = null;
  try { const cached=JSON.parse(localStorage.getItem("uk-home-cache") || "null"); if (cached && Date.now()-cached.savedAt < 300000) cachedHome=cached.data; } catch {}
  const freshRequest = homeRequest || request("/catalog/home");
  const d = cachedHome || await freshRequest;
  if (cachedHome) freshRequest.then((data) => localStorage.setItem("uk-home-cache", JSON.stringify({ savedAt:Date.now(), data }))).catch(() => {});
  else { try { localStorage.setItem("uk-home-cache", JSON.stringify({ savedAt:Date.now(), data:d })); } catch {} }
  const slides = d.heroImages || [];
  setSeo({
    title: "Uniform Kings Kenya | School Uniforms, Shoes & Workwear",
    description: "Shop quality school uniforms, school shoes, sweaters, shirts, trousers, tracksuits, sportswear and corporate uniforms with delivery in Kenya.",
    path: "/",
    image: slides[0]?.image_path ? asset(slides[0].image_path) : "/logo.jpeg",
    schema: { "@context":"https://schema.org", "@graph":[
      { "@type":"Organization", "@id":`${SITE_URL}/#organization`, name:"Uniform Kings", url:SITE_URL, logo:`${SITE_URL}/logo.jpeg`, contactPoint:numberForSchema() },
      { "@type":"WebSite", "@id":`${SITE_URL}/#website`, url:SITE_URL, name:"Uniform Kings", potentialAction:{ "@type":"SearchAction", target:`${SITE_URL}/shop?q={search_term_string}`, "query-input":"required name=search_term_string" } }
    ] },
  });
  const heroSlides = slides.length ? slides.map((slide, index) => `<div class="hero-slide ${index === 0 ? "show" : ""}"><picture>${slide.mobile_image_path ? `<source media="(max-width: 760px)" srcset="${asset(slide.mobile_image_path)}">` : ""}<img ${index ? 'loading="lazy"' : 'fetchpriority="high"'} src="${asset(slide.image_path)}" alt="${esc(slide.alt_text || "Uniform Kings")}"></picture></div>`).join("") : '<div class="hero-slide show hero-empty"></div>';
  const categorySections = d.categories.map((category) => ({ ...category, products:d.products.filter((product) => +product.category_id === +category.id) })).filter((category) => category.products.length).map((category) => `<section class="home-category"><div class="wrap"><div class="category-row-head"><h2>${esc(category.name)}</h2><a href="/shop?category=${esc(category.slug)}">Shop ${esc(category.name)} ${icon("arrow-right")}</a></div><div class="category-product-grid">${category.products.slice(0,50).map(productCard).join("")}</div></div></section>`).join("");
  return `${header()}<main><section class="landing-hero managed-hero"><div class="hero-slides">${heroSlides}</div><div class="landing-overlay wrap hero-centred"><div class="landing-brand hero-logo-only"><img src="/logo.jpeg" alt="Uniform Kings"></div><h1><i>One reliable uniform shop.</i></h1><p>Quality schoolwear, shoes, sportswear and professional uniforms—easy to find, size and order.</p><div class="hero-buttons"><a class="btn primary" href="/shop">Shop uniforms ${icon("arrow-right")}</a><a class="btn hero-outline" href="/shop">Find your school ${icon("school")}</a></div></div><div class="hero-dots">${slides.slice(0, 5).map((_, index) => `<button aria-label="Show image ${index + 1}" class="${index === 0 ? "active" : ""}" data-hero-dot="${index}"></button>`).join("")}</div></section><section class="mobile-trust wrap"><span>${icon("shield-halved")} Quality</span><span>${icon("truck-fast")} Delivery</span><span>${icon("rotate-left")} Exchanges</span></section><section class="shop-intro wrap"><div><span class="eyebrow">Explore the catalogue</span><h2>Shop every collection</h2><p>Browse our active uniform ranges below. Scroll across each collection to see more.</p></div><a class="btn ghost" href="/shop">View all products</a></section>${categorySections || '<section class="wrap"><div class="empty wide">Products will appear here when active categories are stocked.</div></section>'}</main>${footer()}`;
}

let heroTimer;
function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll(".hero-slide")], dots = [...document.querySelectorAll("[data-hero-dot]")];
  if (slides.length < 2) return;
  let current = 0; const show = (next) => { slides[current]?.classList.remove("show"); dots[current]?.classList.remove("active"); current = next % slides.length; slides[current]?.classList.add("show"); dots[current]?.classList.add("active"); };
  dots.forEach((dot) => dot.addEventListener("click", () => { show(+dot.dataset.heroDot); clearInterval(heroTimer); }));
  heroTimer = setInterval(() => show(current + 1), 5200);
}

document.addEventListener("change", (event) => {
  if (event.target.name === "default-checkout" && event.target.checked)
    document.querySelectorAll('[name="default-checkout"]').forEach((input) => { if (input !== event.target) input.checked = false; });
  if (event.target.name === "checkout_method") { const b=document.querySelector("#checkout-start"); if(b)b.textContent=`Continue with ${event.target.dataset.methodName}`; }
  if (event.target.name === "is_enabled") { const f=event.target.closest("form[data-method]"); const d=f.querySelector('[name="default-checkout"]'); d.disabled=!event.target.checked; if(!event.target.checked)d.checked=false; }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.matches("form[data-method]")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const button = form.querySelector(".btn.primary");
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
  const data = Object.fromEntries(new FormData(form));
  data.is_enabled = form.querySelector('[name="is_enabled"]').checked;
  data.is_default = form.querySelector('[name="default-checkout"]').checked;
  data.config = { whatsapp_number: data.whatsapp_number || "" };
  try {
    await request(`/admin/checkout/${form.dataset.method}`, { method: "PATCH", body: JSON.stringify(data) });
    button.innerHTML = `${icon("circle-check")} Saved`;
    toast("Checkout option saved.");
    setTimeout(render, 650);
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
    button.innerHTML = original;
  }
}, true);

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "hero-image-form") return;
  event.preventDefault(); event.stopImmediatePropagation();
  const button = event.target.querySelector("button");
  button.disabled = true; button.innerHTML = `${icon("spinner")} Uploading…`;
  try { await request("/admin/hero-images", { method: "POST", body: new FormData(event.target) }); toast("Hero image uploaded."); render(); }
  catch (error) { toast(error.message, "error"); button.disabled = false; button.innerHTML = `${icon("upload")} Upload hero image`; }
}, true);

document.addEventListener("click", async (event) => {
  const heroToggle = event.target.closest("[data-hero-toggle]");
  if (heroToggle) { event.preventDefault(); event.stopImmediatePropagation(); await request(`/admin/hero-images/${heroToggle.dataset.heroToggle}`, { method: "PATCH", body: JSON.stringify({ is_active: +heroToggle.dataset.active }) }); toast("Hero visibility updated."); render(); return; }
  const heroDelete = event.target.closest("[data-hero-delete]");
  if (heroDelete) { event.preventDefault(); event.stopImmediatePropagation(); if (!confirm("Delete this hero image?")) return; await request(`/admin/hero-images/${heroDelete.dataset.heroDelete}`, { method: "DELETE" }); toast("Hero image deleted."); render(); }
}, true);

document.addEventListener("click", async (event) => {
  const account = event.target.closest(".actions > a:first-child");
  if (!account || !me) return;
  event.preventDefault(); event.stopImmediatePropagation();
  document.querySelector(".quick-account-menu")?.remove();
  const rect = account.getBoundingClientRect(), menu = document.createElement("div");
  menu.className = "quick-account-menu"; menu.style.top = `${rect.bottom + 10}px`; menu.style.left = `${Math.max(10, rect.right - 210)}px`;
  menu.innerHTML = `<a href="/account">${icon("user")} My account</a><a href="/account?section=orders">${icon("box")} My orders</a><a href="/forgot-password">${icon("key")} Change password</a><button data-quick-logout>${icon("right-from-bracket")} Sign out</button>`;
  document.body.append(menu);
}, true);

document.addEventListener("click", (event) => {
  const menu = document.querySelector(".quick-account-menu");
  if (!menu) return;
  if (menu.contains(event.target) || event.target.closest(".actions > a:first-child")) return;
  menu.remove();
}, true);

document.addEventListener("click", async (event) => {
  const share = event.target.closest("[data-share]");
  if (!share) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    if (navigator.share) await navigator.share({ title: document.title, url: location.href });
    else { await navigator.clipboard.writeText(location.href); toast("Product link copied."); }
  } catch (error) {
    if (error.name !== "AbortError") toast("Unable to share this product.", "error");
  }
}, true);
function cartPage() {
  const c = getCart();
  return `${header()}<main class="wrap cart-page"><div class="crumb">Home / Cart</div><h1>Your shopping cart</h1>${c.length ? `<div class="cart-grid"><div class="cart-items">${c.map((i) => `<article><div class="cart-img">${i.image ? `<img src="${asset(i.image)}" alt="${esc(i.name)}">` : icon("shirt")}</div><div><a href="/product/${i.slug}"><b>${esc(i.name)}</b></a><small>${esc([i.size, i.colour].filter(Boolean).join(" • "))}</small><span>${money(i.price)}</span></div><div class="qty"><button data-qty="-1" data-id="${i.variant_id}">−</button><b>${i.quantity}</b><button data-qty="1" data-id="${i.variant_id}">+</button></div><button class="remove" data-remove="${i.variant_id}" aria-label="Remove">${icon("trash")}</button></article>`).join("")}</div><aside class="summary"><h2>Order summary</h2><div><span>Subtotal</span><b>${money(totalCart())}</b></div><div><span>Delivery</span><span>Calculated at checkout</span></div><hr><div class="total"><span>Total</span><b>${money(totalCart())}</b></div><a class="btn primary" href="/checkout">Continue to checkout ${icon("arrow-right")}</a><a href="/shop">Continue shopping</a></aside></div>` : `<div class="empty-cart">${icon("bag-shopping")}<h2>Your cart is empty</h2><p>Browse the catalogue to find uniforms and accessories.</p><a class="btn primary" href="/shop">Start shopping</a></div>`}</main>${footer()}`;
}
async function legacyCheckout() {
  const c = getCart();
  if (!c.length) {
    go("/cart");
    return "";
  }
  const methods = await request("/checkout/methods");
  return `${header()}<main class="wrap checkout"><div class="crumb">Cart / Checkout</div><div class="checkout-head"><span>${icon("lock")} Secure checkout</span><h1>Complete your order</h1></div>${methods.length ? `<form id="checkout-form"><section><h2><b>1</b> Contact information</h2><div class="form-grid"><label>Full name<input name="name" required value="${esc(me?.name || "")}"></label><label>Email address<input name="email" type="email" required value="${esc(me?.email || "")}"></label><label>Phone number<input name="phone" required placeholder="e.g. 0712 345 678"></label></div><h2><b>2</b> Delivery information</h2><div class="form-grid"><label>Delivery method<select name="delivery_method" required><option value="">Choose one</option><option>Home delivery</option><option>Shop pickup</option><option>School delivery</option><option>Pickup point</option></select></label><label class="full">Delivery address or pickup details<textarea name="address" required></textarea></label></div><h2><b>3</b> Checkout option</h2><div class="methods">${methods.map((m, i) => `<label><input type="radio" name="checkout_method" value="${m.code}" ${i === 0 ? "checked" : ""}><span>${icon(m.code === "whatsapp" ? "comment-dots" : "wallet")}<b>${esc(m.name)}</b><small>${esc(m.instructions || "")}</small></span></label>`).join("")}</div></section><aside class="summary"><h2>Your order</h2>${c.map((i) => `<div><span>${esc(i.name)} × ${i.quantity}</span><b>${money(i.price * i.quantity)}</b></div>`).join("")}<hr><div class="total"><span>Total</span><b>${money(totalCart())}</b></div><button class="btn primary">Place order securely</button><small>By placing your order, you agree to our terms and privacy policy.</small></aside></form>` : `<div class="empty wide">Checkout is temporarily unavailable because the store has not enabled a payment or ordering method yet.</div>`}</main>${footer()}`;
}
function authPage(mode) {
  const reg = mode === "register";
  return `${header()}<main class="auth-page"><section><a class="brand" href="/"><img src="/logo.jpeg"><span><b>UNIFORM</b><em>KINGS</em></span></a><span class="eyebrow">${reg ? "Join Uniform Kings" : "Welcome back"}</span><h1>${reg ? "Create your account" : "Sign in to your account"}</h1><p>${reg ? "Save time at checkout and keep your orders in one place." : "View orders and enjoy a faster checkout."}</p><form id="auth-form">${reg ? '<label>Full name<input name="name" required autocomplete="name"></label>' : ""}<label>Email address<input type="email" name="email" required autocomplete="email"></label><label>Password<input type="password" name="password" minlength="8" required autocomplete="current-password"></label><button class="btn primary">${reg ? "Create account" : "Sign in"} <i class="fa-solid fa-arrow-right"></i></button></form><small>${reg ? 'Already have an account? <a href="/login">Sign in</a>' : 'New to Uniform Kings? <a href="/register">Create an account</a>'}</small></section><aside><img src="/logo.jpeg" alt=""><h2>Quality uniforms.<br>Simple ordering.</h2></aside></main>${footer()}`;
}
async function legacyAccount() {
  if (!me) return authPage("login");
  const orders = await request("/account/orders");
  return `${header()}<main class="wrap account"><aside><div class="avatar">${esc(me.name[0])}</div><h3>${esc(me.name)}</h3><span>${esc(me.email)}</span><a class="active">${icon("box")} My orders</a><button id="logout">${icon("right-from-bracket")} Sign out</button></aside><section><span class="eyebrow">Customer account</span><h1>My orders</h1>${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>${orders.map((o) => `<tr><td><b>${esc(o.order_number)}</b></td><td>${new Date(o.created_at).toLocaleDateString()}</td><td><span class="status">${esc(o.status.replaceAll("_", " "))}</span></td><td>${money(o.total)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">You have not placed an order yet.</div>'}</section></main>${footer()}`;
}
const legacyAdminSide = (active) =>
  `<aside class="admin-side"><a class="admin-brand" href="/admin"><img src="/logo.jpeg"><span><b>Uniform Kings</b><small>Administration</small></span></a><small>OVERVIEW</small><a class="${active === "dashboard" ? "active" : ""}" href="/admin">${icon("chart-pie")} Dashboard</a><small>COMMERCE</small><a class="${active === "products" ? "active" : ""}" href="/admin/products">${icon("shirt")} Products</a><a class="${active === "orders" ? "active" : ""}" href="/admin/orders">${icon("box")} Orders</a><a href="/admin">${icon("warehouse")} Inventory</a><a href="/admin">${icon("users")} Customers</a><a href="/admin">${icon("school")} Schools</a><small>CONFIGURATION</small><a class="${active === "checkout" ? "active" : ""}" href="/admin/checkout">${icon("credit-card")} Checkout options</a><a href="/admin">${icon("gear")} Settings</a></aside>`;
const adminTop = (title) =>
  `<header class="admin-top"><button class="admin-menu">${icon("bars")}</button><div><small>Uniform Kings /</small><b>${title}</b></div><div><button>${icon("bell")}</button><span class="avatar">A</span><span><b>Administration</b><small>Store management</small></span><button id="logout" class="admin-signout" title="Sign out">${icon("right-from-bracket")}</button></div></header>`;
async function adminDashboard() {
  if (!me || me.role === "customer") return authPage("login");
  const d = await request("/admin/dashboard"); window.__dashboard = d;
  return `<div class="admin-shell">${adminSide("dashboard")}<main>${adminTop("Dashboard")}<div class="admin-content"><div class="admin-heading"><div><h1>Business overview</h1><p>Live store performance and operations.</p></div><span>${icon("calendar")} ${new Date().toLocaleDateString("en-KE", { dateStyle: "long" })}</span></div><div class="stat-grid"><article><span>${icon("sack-dollar")}</span><small>Total sales</small><b>${money(d.stats.total_sales)}</b></article><article><span>${icon("cart-shopping")}</span><small>Total orders</small><b>${d.stats.total_orders}</b></article><article><span>${icon("clock")}</span><small>Pending orders</small><b>${d.stats.pending_orders}</b></article><article><span>${icon("triangle-exclamation")}</span><small>Low stock</small><b>${d.stats.low_stock}</b></article></div><div class="admin-panels"><section class="chart-card"><div><h3>Sales trend</h3><small>Paid orders over the last 14 days</small></div><canvas id="sales-chart"></canvas></section><section class="quick"><h3>Store snapshot</h3><div><span>${icon("users")} Customers</span><b>${d.stats.customers}</b></div><div><span>${icon("shirt")} Active products</span><b>${d.stats.products}</b></div><div><span>${icon("coins")} Today's sales</span><b>${money(d.stats.today_sales)}</b></div></section></div>${adminTable("Recent orders", d.recent, "orders")}</div></main></div>`;
}
function adminTable(title, data, type) {
  const product = type === "products";
  return `<section class="data-card"><div class="data-head"><div><h3>${title}</h3><small>${data.length} record${data.length === 1 ? "" : "s"}</small></div><label>${icon("magnifying-glass")}<input data-table-search placeholder="Search records"></label></div><div class="table-wrap"><table><thead><tr>${product ? "<th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th>" : "<th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th>"}</tr></thead><tbody>${data.map((x) => (product ? `<tr><td><b>${esc(x.name)}</b><small>${esc(x.school_name || "General catalogue")}</small></td><td>${esc(x.sku)}</td><td>${esc(x.category_name || "—")}</td><td>${money(x.price)}</td><td><b>${x.stock}</b></td><td><span class="status ${x.status}">${esc(x.status)}</span></td></tr>` : `<tr><td><b>${esc(x.order_number)}</b></td><td>${esc(x.customer_name)}<small>${esc(x.phone)}</small></td><td>${new Date(x.created_at).toLocaleDateString()}</td><td>${money(x.total)}</td><td><span class="status ${x.payment_status}">${esc(x.payment_status)}</span></td><td><span class="status">${esc(x.status.replaceAll("_", " "))}</span></td></tr>`)).join("") || `<tr><td colspan="6"><div class="empty">No records yet.</div></td></tr>`}</tbody></table></div></section>`;
}
async function legacyAdminProducts() {
  const data = await request("/admin/products");
  return `<div class="admin-shell">${adminSide("products")}<main>${adminTop("Products")}<div class="admin-content"><div class="admin-heading"><div><h1>Products</h1><p>Manage catalogue items, prices and stock.</p></div><button class="btn primary" id="new-product">${icon("plus")} Add product</button></div>${adminTable("Product catalogue", data, "products")}</div></main></div>`;
}
async function legacyAdminProductNew() {
  const filters = await request("/filters");
  return `<div class="admin-shell">${adminSide("products")}<main>${adminTop("Add product")}<div class="admin-content"><div class="admin-heading"><div><h1>Add product</h1><p>Create a product, its first stock option and image.</p></div><a class="btn ghost" href="/admin/products">Cancel</a></div><form id="product-form" class="data-card product-form"><div class="form-grid"><label>Product name<input name="name" required maxlength="190"></label><label>Product code / base SKU<input name="sku" required maxlength="80"></label><label>Category<select name="category_id"><option value="">General catalogue</option>${filters.categories.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>School (optional)<select name="school_id"><option value="">Not school-specific</option>${filters.schools.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>Price (KES)<input name="price" type="number" min="0" step="0.01" required></label><label>Previous price (optional)<input name="compare_price" type="number" min="0" step="0.01"></label><label class="full">Short description<textarea name="short_description" maxlength="300"></textarea></label><label class="full">Full description<textarea name="description"></textarea></label><label>First size<input name="size" placeholder="e.g. Age 9-10"></label><label>First colour<input name="colour" placeholder="e.g. Navy"></label><label>Variant SKU<input name="variant_sku" required maxlength="100"></label><label>Opening stock<input name="stock" type="number" min="0" value="0" required></label><label>Product image<input name="images" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label><label>Status<select name="status"><option value="active">Active</option><option value="draft">Draft</option></select></label><label><input name="is_featured" type="checkbox"> Feature on homepage</label><label><input name="is_new" type="checkbox"> Mark as new</label></div><div class="form-actions"><button class="btn primary">Save product</button></div></form></div></main></div>`;
}
async function adminOrders() {
  const data = await request("/admin/orders");
  return `<div class="admin-shell">${adminSide("orders")}<main>${adminTop("Orders")}<div class="admin-content"><div class="admin-heading"><div><h1>Orders</h1><p>Track payment and fulfilment from one place.</p></div></div>${adminTable("All orders", data, "orders")}</div></main></div>`;
}

async function betterAdminOrders() {
  const data = await request("/admin/orders");
  const rowsHtml = data.map((order) => `<tr><td><b>${esc(order.order_number)}</b><small>${esc(order.customer_name)}</small></td><td><a class="order-customer-link" href="/admin/receipt/${order.id}">${esc(order.customer_name)} ${icon("arrow-up-right-from-square")}</a><small>${esc(order.phone || "No phone")}</small></td><td>${new Date(order.created_at).toLocaleDateString("en-KE")}</td><td>${money(order.total)}</td><td><span class="status ${order.payment_status}">${esc(order.payment_status)}</span></td><td><span class="status">${esc(order.status.replaceAll("_", " "))}</span></td></tr>`).join("");
  return `<div class="admin-shell">${adminSide("orders")}<main>${adminTop("Orders")}<div class="admin-content"><div class="admin-heading"><div><h1>Orders</h1><p>Search customers, review details, update open orders, print and download documents.</p></div></div><section class="data-card"><div class="data-head"><div><h3>All orders</h3><small>${data.length} order${data.length === 1 ? "" : "s"}</small></div><label>${icon("magnifying-glass")}<input data-table-search placeholder="Customer, phone or order number"></label></div><div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6"><div class="empty">No orders yet.</div></td></tr>'}</tbody></table></div></section></div></main></div>`;
}
async function legacyAdminCheckout() {
  const data = await request("/admin/checkout");
  return `<div class="admin-shell">${adminSide("checkout")}<main>${adminTop("Checkout options")}<div class="admin-content"><div class="admin-heading"><div><h1>Checkout options</h1><p>Only enabled methods are offered to customers.</p></div></div><div class="checkout-admin">${data
    .map((m) => {
      let cfg = {};
      try {
        cfg =
          typeof m.config_json === "string"
            ? JSON.parse(m.config_json)
            : m.config_json || {};
      } catch {}
      return `<form data-method="${m.id}"><div class="method-icon">${icon(m.code === "whatsapp" ? "comment-dots" : "credit-card")}</div><div class="method-fields"><label class="switch"><input type="checkbox" name="is_enabled" ${m.is_enabled ? "checked" : ""}><span></span><b>${m.is_enabled ? "Enabled" : "Disabled"}</b></label><label>Display name<input name="name" value="${esc(m.name)}" required></label><label>Customer instructions<textarea name="instructions">${esc(m.instructions || "")}</textarea></label>${m.code === "whatsapp" ? `<label>WhatsApp number<input name="whatsapp_number" value="${esc(cfg.whatsapp_number || "")}" placeholder="2547…"></label>` : ""}</div><button class="btn primary">Save changes</button></form>`;
    })
    .join("")}</div></div></main></div>`;
}
async function legacyRender() {
  window.scrollTo(0, 0);
  const path = location.pathname;
  try {
    if (path === "/") app.innerHTML = await home();
    else if (path === "/shop") app.innerHTML = await shop();
    else if (path.startsWith("/product/"))
      app.innerHTML = await product(decodeURIComponent(path.split("/").pop()));
    else if (path === "/cart") app.innerHTML = cartPage();
    else if (path === "/checkout") app.innerHTML = await checkout();
    else if (path === "/login") app.innerHTML = authPage("login");
    else if (path === "/register") app.innerHTML = authPage("register");
    else if (path === "/account") app.innerHTML = await account();
    else if (path === "/admin") app.innerHTML = await adminDashboard();
    else if (path === "/admin/products") app.innerHTML = await adminProducts();
    else if (path === "/admin/products/new")
      app.innerHTML = await adminProductNew();
    else if (path === "/admin/orders") app.innerHTML = await adminOrders();
    else if (path === "/admin/checkout") app.innerHTML = await adminCheckout();
    else
      app.innerHTML = `${header()}<main class="not-found"><h1>404</h1><p>We could not find that page.</p><a class="btn primary" href="/">Go home</a></main>${footer()}`;
    bind();
    if (path === "/admin" && document.querySelector("#sales-chart")) {
      const d = window.__dashboard;
      new Chart(document.querySelector("#sales-chart"), {
        type: "line",
        data: {
          labels: d.sales.map((x) =>
            new Date(x.day).toLocaleDateString("en-KE", {
              month: "short",
              day: "numeric",
            }),
          ),
          datasets: [
            {
              data: d.sales.map((x) => x.total),
              borderColor: "#c9972d",
              backgroundColor: "rgba(201,151,45,.12)",
              fill: true,
              tension: 0.35,
            },
          ],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: "#edf0f5" } },
            x: { grid: { display: false } },
          },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }
  } catch (e) {
    app.innerHTML = `${header()}<main class="not-found"><h1>This page could not load</h1><p>Please check your connection and try again.</p><button class="btn primary" onclick="location.reload()">Try again</button></main>${footer()}`;
  }
}
function bind() {
  const collectionLabel = document.querySelector(".shop-intro .eyebrow");
  if (collectionLabel) collectionLabel.textContent = "Explore the collection";
  const collectionLink = document.querySelector(".shop-intro > a");
  if (collectionLink) collectionLink.innerHTML = `View all collections ${icon("arrow-right")}`;
  const trustTargets = ["/about#quality", "/delivery", "/returns"];
  document.querySelectorAll(".mobile-trust > span").forEach((item, index) => {
    const link = document.createElement("a"); link.href = trustTargets[index]; link.innerHTML = item.innerHTML; item.replaceWith(link);
  });
  document.querySelectorAll('a[href^="/"]').forEach(
    (a) =>
      (a.onclick = (e) => {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          go(a.getAttribute("href"));
        }
      }),
  );
  document
    .querySelector(".menu")
    ?.addEventListener("click", () => document.body.classList.add("menu-open"));
  document
    .querySelector(".drawer-close")
    ?.addEventListener("click", () =>
      document.body.classList.remove("menu-open"),
    );
  document
    .querySelector(".scrim")
    ?.addEventListener("click", () =>
      document.body.classList.remove("menu-open"),
    );
  document.querySelector("#add-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = +new FormData(e.target).get("variant"),
      qty = +new FormData(e.target).get("quantity"),
      p = window.__product;
    if (!id) return toast("Please select a size and colour.", "error");
    const variant = p.variants.find((v) => v.id === id);
    addCart(p, variant, Math.max(1, qty));
    toast("Added to your cart.");
    go("/cart");
  });
  document.querySelectorAll("[data-qty]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = getCart(),
          i = c.find((x) => x.variant_id === +b.dataset.id);
        i.quantity = Math.max(
          1,
          Math.min(i.stock, i.quantity + +b.dataset.qty),
        );
        saveCart(c);
        render();
      }),
  );
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        saveCart(getCart().filter((x) => x.variant_id !== +b.dataset.remove));
        render();
      }),
  );
  document
    .querySelector("[data-share]")
    ?.addEventListener("click", async () => {
      try {
        await navigator.share({ title: document.title, url: location.href });
      } catch {
        await navigator.clipboard.writeText(location.href);
        toast("Product link copied.");
      }
    });
  document
    .querySelector("#auth-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      const original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon("spinner")} ${location.pathname === "/register" ? "Creating account…" : "Signing in…"}`;
      const b = Object.fromEntries(new FormData(e.target));
      try {
        me = await request(
          location.pathname === "/register" ? "/auth/register" : "/auth/login",
          { method: "POST", body: JSON.stringify(b) },
        );
        go(me.role === "customer" ? "/account" : "/admin");
      } catch (x) {
        toast(x.message, "error");
        button.disabled = false;
        button.innerHTML = original;
      }
    });
  document.querySelector("#logout")?.addEventListener("click", async () => {
    await request("/auth/logout", { method: "POST" });
    me = null;
    go("/");
  });
  document.querySelector("#new-product")?.addEventListener("click", () =>
    go("/admin/products/new"),
  );
  document
    .querySelector("#product-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target,
        fd = new FormData(form),
        button = form.querySelector("button");
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      try {
        const product = await request("/admin/products", {
          method: "POST",
          body: JSON.stringify({
            name: fd.get("name"),
            sku: fd.get("sku"),
            category_id: fd.get("category_id"),
            school_id: fd.get("school_id"),
            price: fd.get("price"),
            compare_price: fd.get("compare_price"),
            short_description: fd.get("short_description"),
            description: fd.get("description"),
            status: fd.get("status"),
            is_featured: fd.has("is_featured"),
            is_new: fd.has("is_new"),
          }),
        });
        await request(`/admin/products/${product.id}/variants`, {
          method: "POST",
          body: JSON.stringify({
            size: fd.get("size"), colour: fd.get("colour"),
            sku: fd.get("variant_sku"), stock: fd.get("stock"),
          }),
        });
        const file = fd.get("images");
        if (file?.size) {
          const images = new FormData();
          images.append("images", file);
          images.append("alt_text", fd.get("name"));
          await request(`/admin/products/${product.id}/images`, {
            method: "POST", body: images,
          });
        }
        toast("Product created successfully.");
        go("/admin/products");
      } catch (x) {
        toast(x.message, "error");
        button.disabled = false;
        button.textContent = "Save product";
      }
    });
  document
    .querySelector("#checkout-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector(
        'button[type="submit"],button:not([type])',
      );
      btn.disabled = true;
      btn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Placing order…';
      try {
        const b = Object.fromEntries(new FormData(e.target));
        b.items = getCart().map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
        }));
        const r = await request("/orders", {
          method: "POST",
          body: JSON.stringify(b),
        });
        saveCart([]);
        if (r.checkout_method.code === "whatsapp") {
          let cfg = r.checkout_method.config_json;
          try {
            cfg = typeof cfg === "string" ? JSON.parse(cfg) : cfg || {};
          } catch {}
          const n = cfg.whatsapp_number || config.whatsapp_number;
          if (n)
            location.href = `https://wa.me/${n.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello Uniform Kings, I have placed order ${r.order_number}.`)}`;
        } else {
          app.innerHTML = `${header()}<main class="success-page">${icon("circle-check")}<h1>Order received</h1><p>Your order number is <b>${esc(r.order_number)}</b>.</p><a class="btn primary" href="/account">View my orders</a></main>${footer()}`;
        }
      } catch (x) {
        toast(x.message, "error");
        btn.disabled = false;
        btn.textContent = "Place order securely";
      }
    });
  document.querySelectorAll("[data-method]").forEach(
    (f) =>
      (f.onsubmit = async (e) => {
        e.preventDefault();
        const b = Object.fromEntries(new FormData(f));
        b.is_enabled = !!f.querySelector("[name=is_enabled]").checked;
        b.config = { whatsapp_number: b.whatsapp_number || "" };
        try {
          await request("/admin/checkout/" + f.dataset.method, {
            method: "PATCH",
            body: JSON.stringify(b),
          });
          toast("Checkout option saved.");
          render();
        } catch (x) {
          toast(x.message, "error");
        }
      }),
  );
  document
    .querySelector("[data-table-search]")
    ?.addEventListener("input", (e) =>
      document
        .querySelectorAll("tbody tr")
        .forEach(
          (r) =>
            (r.hidden = !r.textContent
              .toLowerCase()
              .includes(e.target.value.toLowerCase())),
        ),
    );
  window.addEventListener(
    "cartchange",
    () =>
      document
        .querySelectorAll(".cart-count")
        .forEach((x) => (x.textContent = countCart())),
    { once: true },
  );
}
window.addEventListener("popstate", render);
render();

/* Selling-flow upgrades */
function hardcodedHeader() {
  const accountLink = me ? (me.role === "customer" ? "/account" : "/admin") : "/login";
  return `<header class="top"><div class="mini"><div>Quality uniforms. Confident futures.</div><div><a href="tel:${esc(config.contact_phone || "")}">Help & support</a></div></div><div class="head wrap"><button class="menu" aria-label="Open menu">${icon("bars")}</button><a class="brand" href="/"><img src="/logo.jpeg" alt="Uniform Kings"><span><b>UNIFORM KINGS</b><em>QUALITY UNIFORMS · PROUD FUTURES</em></span></a><form class="search" action="/shop"><input name="q" placeholder="Search uniforms or school" aria-label="Search"><button>${icon("magnifying-glass")}<span>Search</span></button></form><nav class="actions"><a href="${accountLink}">${icon("user")}<small>${me ? esc(me.name.split(" ")[0]) : "Sign in"}</small></a><a href="/cart">${icon("bag-shopping")}<small>Cart</small><b class="cart-count">${countCart()}</b></a></nav></div><nav class="nav"><div class="wrap"><a href="/">Home</a><a href="/shop">Shop all</a><a href="/shop?category=school-uniforms">School uniforms</a><a href="/shop?category=corporate-uniforms">Corporate</a><a href="/shop?category=sportswear">Sportswear</a><a href="/shop?category=shoes">Shoes</a><a href="/shop?category=accessories">Accessories</a><a href="/shop">Offers</a></div></nav></header><aside class="drawer"><button class="drawer-close">${icon("xmark")}</button><a href="/">Home</a><a href="/shop">Shop all uniforms</a><a href="/shop">Find a school</a>${me ? `<a href="${accountLink}">My account</a><a href="/account?section=orders">My orders</a><form id="drawer-logout"><button>Sign out</button></form>` : `<a href="/login">Sign in</a><a href="/register">Create account</a>`}<a href="/cart">My cart (${countCart()})</a></aside><div class="scrim"></div>`;
}

function header() {
  const accountLink = me ? (me.role === "customer" ? "/account" : "/admin") : "/login";
  const categoryLinks = (config.categories || []).map((category) => `<a href="/shop?category=${esc(category.slug)}">${esc(category.name)}</a>`).join("");
  return `<header class="top"><div class="mini"><div>Quality uniforms. Confident futures.</div><div><a href="tel:${esc(config.contact_phone || "")}">Help & support</a></div></div><div class="head wrap"><button class="menu" aria-label="Open menu">${icon("bars")}</button><a class="brand" href="/"><img src="/logo.jpeg" alt="Uniform Kings"><span><b>UNIFORM KINGS</b><em>QUALITY UNIFORMS · PROUD FUTURES</em></span></a><form class="search" action="/shop"><input name="q" placeholder="Search uniforms or school" aria-label="Search"><button>${icon("magnifying-glass")}<span>Search</span></button></form><nav class="actions"><a href="${accountLink}">${icon("user")}<small>${me ? esc(me.name.split(" ")[0]) : "Sign in"}</small></a><a href="/cart">${icon("bag-shopping")}<small>Cart</small><b class="cart-count">${countCart()}</b></a></nav></div><nav class="nav"><div class="wrap"><a href="/">Home</a><a href="/shop">Shop all</a>${categoryLinks}<a href="/shop?offer=1">Offers</a></div></nav></header><aside class="drawer"><button class="drawer-close">${icon("xmark")}</button><a href="/">Home</a><a href="/shop">Shop all uniforms</a>${categoryLinks}<a href="/shop?offer=1">Offers</a><a href="/shop">Find a school</a>${me ? `<a href="${accountLink}">My account</a><a href="/account?section=orders">My orders</a><form id="drawer-logout"><button>Sign out</button></form>` : `<a href="/login">Sign in</a><a href="/register">Create account</a>`}<a href="/cart">My cart (${countCart()})</a></aside><div class="scrim"></div>`;
}

function numberForSchema() {
  const telephone = String(config.contact_phone || config.whatsapp_number || "").trim();
  return telephone ? { "@type":"ContactPoint", telephone, contactType:"customer service", areaServed:"KE", availableLanguage:["English","Swahili"] } : undefined;
}
function setSeo({ title, description, path = location.pathname + location.search, image = "/logo.jpeg", type = "website", schema = null, robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" }) {
  document.title = title;
  const absoluteImage = image.startsWith("http") ? image : `${SITE_URL}${image}`;
  const canonicalUrl = `${SITE_URL}${path}`;
  const meta = (selector, attribute, name, content) => {
    let element = document.head.querySelector(selector);
    if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, name); document.head.append(element); }
    element.content = content;
  };
  meta('meta[name="description"]', "name", "description", description);
  meta('meta[name="robots"]', "name", "robots", robots);
  [["og:title",title],["og:description",description],["og:url",canonicalUrl],["og:image",absoluteImage],["og:type",type],["og:site_name","Uniform Kings"],["og:locale","en_KE"],["twitter:card","summary_large_image"],["twitter:title",title],["twitter:description",description],["twitter:image",absoluteImage]].forEach(([name,content]) => meta(`meta[property="${name}"],meta[name="${name}"]`, name.startsWith("twitter:") ? "name" : "property", name, content));
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
  canonical.href = canonicalUrl;
  document.querySelector("#page-schema")?.remove();
  if (schema) { const script=document.createElement("script"); script.id="page-schema"; script.type="application/ld+json"; script.textContent=JSON.stringify(schema); document.head.append(script); }
}

function footer() {
  const number = String(config.whatsapp_number || config.contact_phone || "").replace(/\D/g, "");
  const whatsapp = number ? `https://wa.me/${number}?text=${encodeURIComponent("Hello Uniform Kings, I need assistance.")}` : "/about#contact";
  return `<footer><div class="wrap foot"><div class="foot-brand"><a class="brand" href="/"><img src="/logo.jpeg" alt="Uniform Kings logo"><span><b>UNIFORM KINGS</b><em>QUALITY UNIFORMS · PROUD FUTURES</em></span></a><p>Quality schoolwear, shoes, sportswear and professional uniforms, delivered across Kenya.</p></div><div><h4>Shop</h4><a href="/shop">All uniforms</a><a href="/shop?category=school-uniforms">School uniforms</a><a href="/shop?category=shoes">School shoes</a><a href="/shop?offer=1">Current offers</a></div><div><h4>Customer care</h4><a href="/delivery">Delivery information</a><a href="/returns">Returns & exchanges</a><a href="/privacy">Privacy policy</a><a href="${whatsapp}" ${number ? 'target="_blank" rel="noopener"' : ""}>Contact us</a></div><div><h4>Uniform Kings</h4><a href="/about">About us</a><a href="/about#why-us">Why choose us</a><a href="/about#quality">Our quality</a><a href="/about#contact">Customer support</a></div></div><div class="copyright wrap"><span>© ${new Date().getFullYear()} Uniform Kings. All rights reserved.</span><span>Secure shopping · Customer privacy protected</span></div></footer><nav class="bottom"><a href="/">${icon("house")}<span>Home</span></a><a href="/shop">${icon("border-all")}<span>Shop</span></a><a href="/shop">${icon("school")}<span>Schools</span></a><a href="/cart">${icon("bag-shopping")}<span>Cart</span><b class="cart-count">${countCart()}</b></a></nav>`;
}

function informationPage(page) {
  const number = String(config.whatsapp_number || config.contact_phone || "").replace(/\D/g, "");
  const contact = number ? `https://wa.me/${number}?text=${encodeURIComponent("Hello Uniform Kings, I need assistance.")}` : `mailto:${config.contact_email || "admin@uniformkings.co.ke"}`;
  const pages = {
    about: ["About Uniform Kings", "Quality uniforms for schools, teams and workplaces in Kenya.", `<section id="why-us"><h2>Why choose us</h2><p>We make it easier to find the right uniform, select available sizes and colours, and order using approved checkout options.</p></section><section id="quality"><h2>Quality you can rely on</h2><p>Our catalogue is managed around real products, clear options and practical uniform needs for school and professional life.</p></section><section id="contact"><h2>Customer care</h2><p>Need product, size, delivery or order assistance? Talk directly to the Uniform Kings team.</p><a class="btn primary" href="${contact}" target="_blank" rel="noopener">Chat with us ${icon("comment-dots")}</a></section>`],
    delivery: ["Delivery information", "Uniform delivery and collection information for Uniform Kings customers across Kenya.", `<h2>Delivery and collection</h2><p>Available delivery, school delivery, pickup and collection choices are displayed during checkout. Availability can depend on the destination and the selected products.</p><h2>Before placing an order</h2><p>Confirm the customer phone number, delivery location, product sizes and colours. Our team may contact you when clarification is required.</p><a class="btn primary" href="${contact}" target="_blank" rel="noopener">Ask about delivery</a>`],
    returns: ["Returns and exchanges", "Uniform Kings returns and size exchange guidance for uniforms, shoes and accessories.", `<h2>Returns and exchanges</h2><p>Contact our team promptly if an item is unsuitable or the selected size is not right. Keep products unused, clean and in their original condition while your request is reviewed.</p><h2>Personalised products</h2><p>Items that have been branded, embroidered, altered or otherwise personalised may not qualify for an ordinary exchange unless they have a confirmed fault.</p><a class="btn primary" href="${contact}" target="_blank" rel="noopener">Request assistance</a>`],
    privacy: ["Privacy policy", "How Uniform Kings handles account, order, delivery and payment information.", `<h2>Information we use</h2><p>We use the information customers provide to operate accounts, prepare orders, arrange delivery, process enabled checkout methods and provide customer support.</p><h2>Security and sharing</h2><p>We limit access to operational information and do not sell customer information. Payment services may process the information required to complete a selected transaction.</p><h2>Your choices</h2><p>Contact us to ask about your account information or request appropriate corrections.</p><a class="btn primary" href="${contact}" target="_blank" rel="noopener">Contact customer care</a>`],
  };
  const [title,description,content] = pages[page];
  setSeo({ title:`${title} | Uniform Kings Kenya`, description, path:`/${page}` });
  return `${header()}<main class="wrap information-page"><div class="crumb">Home / ${title}</div><header><span class="eyebrow">Uniform Kings customer care</span><h1>${title}</h1><p>${description}</p></header><article>${content}</article></main>${footer()}${chatWidget()}`;
}

async function legacyNewHome() {
  const d = await request("/catalog/home");
  const hero = d.products.find((p) => p.image_path) || null;
  const heroStyle = hero ? `style="--hero-image:url('${asset(hero.image_path)}')"` : "";
  return `${header()}<main><section class="hero hero-photo" ${heroStyle}><div class="wrap hero-grid"><div class="hero-copy"><span class="eyebrow">Uniforms made simple</span><h1>Dress smart.<br><i>Learn confidently.</i></h1><p>Quality school, corporate and institutional uniforms in the correct colours, sizes and designs.</p><div class="hero-buttons"><a class="btn primary" href="/shop">Shop uniforms ${icon("arrow-right")}</a><a class="btn ghost" href="/shop">Find your school</a></div><div class="trust"><span>${icon("shield-halved")} Quality checked</span><span>${icon("truck-fast")} Countrywide delivery</span><span>${icon("rotate-left")} Easy exchanges</span></div></div><div class="hero-art"><div class="crest"><img src="/logo.jpeg" alt="Uniform Kings"></div>${hero ? `<a class="hero-product-promo" href="/product/${esc(hero.slug)}"><img src="${asset(hero.image_path)}" alt="${esc(hero.name)}"><span>Shop ${esc(hero.name)} ${icon("arrow-right")}</span></a>` : ""}</div></div></section><section class="school-finder wrap"><div><span class="eyebrow">Quick school finder</span><h2>Find the right uniform, faster.</h2></div><form action="/shop"><div>${icon("school")}<input name="q" placeholder="Type a school name"></div><button class="btn primary">Find uniforms</button></form></section><section class="section wrap"><div class="section-head"><div><span class="eyebrow">Browse the range</span><h2>Shop by category</h2></div><a href="/shop">View all ${icon("arrow-right")}</a></div><div class="categories">${d.categories.length ? d.categories.map((c, i) => `<a href="/shop?category=${esc(c.slug)}"><span>${icon(["shirt", "person-running", "shoe-prints", "bag-shopping", "user-tie", "mitten"][i % 6])}</span><b>${esc(c.name)}</b><small>${esc(c.description || "Shop collection")}</small></a>`).join("") : '<div class="empty wide">Categories will appear here as soon as the store team publishes them.</div>'}</div></section><section class="section products-section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Selected for you</span><h2>Popular right now</h2></div><a href="/shop">Shop all ${icon("arrow-right")}</a></div><div class="products">${d.products.length ? d.products.map(productCard).join("") : '<div class="empty wide">No products have been published yet. The catalogue is ready for the store team to add real stock.</div>'}</div></div></section><section class="marketing-band"><div class="wrap"><div><span class="eyebrow">Easy ordering</span><h2>One shop. Every school day.</h2><p>Search by school, choose colours and sizes, then order the exact uniform you need.</p></div><a class="btn primary" href="/shop">Explore the catalogue</a></div></section></main>${footer()}${chatWidget()}`;
}

function chatWidget() { return `<aside class="product-helper" id="product-helper"><button class="helper-toggle" aria-label="Open shopping helper">${icon("comment-dots")}</button><div class="helper-panel"><div><b>Uniform Kings assistant</b><button data-close-helper>${icon("xmark")}</button></div><p>Hello! Ask me about products, sizes, delivery, exchanges, payments or your order.</p><div class="helper-prompts"><button data-helper-question="How does delivery work?">Delivery</button><button data-helper-question="How do exchanges work?">Exchanges</button><button data-helper-question="How can I pay?">Payments</button></div><form id="helper-search"><input name="q" placeholder="Type your question"><button aria-label="Send question">${icon("paper-plane")}</button></form><div class="helper-results" aria-live="polite"></div></div></aside>`; }

async function product(slug) {
  const p = await request("/products/" + slug); window.__product = p;
  const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean))];
  const colours = [...new Set(p.variants.map((v) => v.colour).filter(Boolean))];
  const description = p.seo_description || p.short_description || `${p.name} from Uniform Kings. Choose available sizes and colours and order online in Kenya.`;
  const primaryImage = p.images[0]?.image_path ? asset(p.images[0].image_path) : "/logo.jpeg";
  setSeo({
    title: `${p.seo_title || `${p.name}${p.school_name ? ` – ${p.school_name}` : ""}`} | Uniform Kings Kenya`,
    description,
    path:`/product/${p.slug}`,
    image:primaryImage,
    type:"product",
    schema:{ "@context":"https://schema.org", "@type":"Product", name:p.name, description, image:p.images.map((image) => asset(image.image_path)), sku:p.sku, brand:{"@type":"Brand",name:p.brand || "Uniform Kings"}, category:p.product_type || p.category_name, material:p.material || undefined, audience:(p.gender || p.age_group) ? {"@type":"PeopleAudience",suggestedGender:p.gender || undefined,suggestedMinAge:p.age_group === "adult" ? 18 : undefined} : undefined, color:colours.join(", ") || undefined, size:sizes.join(", ") || undefined, offers:{"@type":"Offer",url:`${SITE_URL}/product/${p.slug}`,priceCurrency:"KES",price:Number(p.price),availability:+p.stock>0?"https://schema.org/InStock":"https://schema.org/OutOfStock",itemCondition:"https://schema.org/NewCondition",seller:{"@type":"Organization",name:"Uniform Kings"}} },
  });
  return `${header()}<main class="wrap product-page"><div class="crumb">Home / Shop / ${esc(p.name)}</div><div class="product-grid"><div class="gallery"><div class="main-photo">${p.images.length ? `<img id="main-product-image" src="${asset(p.images[0].image_path)}" alt="${esc(p.images[0].alt_text || p.name)}">` : `<span>${icon("shirt")}</span>`}</div><div class="thumbs">${p.images.map((x) => `<button type="button" data-product-image="${asset(x.image_path)}"><img src="${asset(x.image_path)}" alt="${esc(x.alt_text || p.name)}"></button>`).join("")}</div></div><section class="details"><span class="eyebrow">${esc(p.school_name || p.category_name || "Uniform Kings")}</span><h1>${esc(p.name)}</h1><div class="detail-price">${money(p.price)} ${p.compare_price ? `<del>${money(p.compare_price)}</del>` : ""}</div><p>${esc(p.short_description || "A quality uniform item from Uniform Kings.")}</p><form id="variant-add-form"><input name="quantity" type="hidden" value="1">${colours.length ? `<fieldset><legend>Colour <small>Choose one or more</small></legend><div class="option-boxes">${colours.map((colour) => `<button type="button" class="option-box" data-colour="${esc(colour)}">${esc(colour)}</button>`).join("")}</div></fieldset>` : ""}${sizes.length ? `<fieldset><legend>Size <small>Choose one or more</small></legend><div class="option-boxes">${sizes.map((size) => `<button type="button" class="option-box" data-size="${esc(size)}">${esc(size)}</button>`).join("")}</div></fieldset>` : ""}<div class="selected-options">Choose options to add them as separate cart items.</div><div class="buy-row"><input class="quantity-visible" name="quantity-visible" type="number" min="1" max="50" value="1"><button class="btn primary" ${p.variants.some((v) => v.stock > 0) ? "" : "disabled"}>${icon("bag-shopping")} Add selected options</button></div></form><div class="share"><b>Share this product</b><button data-share>${icon("share-nodes")} Share link</button></div><div class="assurances"><div>${icon("truck")}<span><b>Flexible delivery</b><small>Choose an available delivery or pickup method at checkout.</small></span></div><div>${icon("rotate-left")}<span><b>Exchange support</b><small>Contact our team promptly if the size is not right.</small></span></div></div></section></div><section class="description"><h2>Product details</h2><p>${esc(p.description || p.short_description || "More product information will be provided by the store team.")}</p></section></main>${footer()}${chatWidget()}`;
}

async function adminWalkins() {
  const products = await request("/admin/products");
  const available = products.filter((p) => +p.stock > 0);
  window.__walkinProducts=available;
  window.__posCart = [];
  return `<div class="admin-shell">${adminSide("walkins")}<main>${adminTop("Walk-in sale")}<div class="admin-content"><div class="admin-heading"><div><h1>Walk-in sale</h1><p>Create an in-store sale and print a professional receipt immediately.</p></div><a class="btn ghost" href="/admin/orders">View orders</a></div><div class="pos-layout"><section class="data-card pos-products"><div class="data-head"><div><h3>Sell from live stock</h3><small>Select an item, then select its size and colour.</small></div></div><div class="pos-product-list">${available.length ? available.map((p) => `<button type="button" class="pos-product" data-pos-product="${p.id}" data-pos-slug="${esc(p.slug)}"><b>${esc(p.name)}</b><span>${money(p.price)} · ${p.stock} in stock</span></button>`).join("") : '<div class="empty">No active stock available.</div>'}</div></section><section class="data-card pos-cart"><div class="data-head"><div><h3>Current sale</h3><small>Items are deducted only when you complete the sale.</small></div></div><form id="walkin-form"><div id="walkin-items" class="walkin-items"><div class="empty">Choose a product from the left.</div></div><div class="form-grid"><label>Customer name <small>Optional</small><input name="customer_name" placeholder="Walk-in customer"></label><label>Phone <small>Optional</small><input name="phone" placeholder="0712 345 678"></label><label>Payment method<select name="payment_method"><option>Cash</option><option>M-Pesa</option><option>Card</option><option>Bank transfer</option></select></label></div><div class="pos-total"><span>Total</span><b id="walkin-total">${money(0)}</b></div><button class="btn primary" id="complete-walkin" disabled>Complete sale & print receipt</button></form></section></div></div></main></div>`;
}

async function receiptPage(id) {
  const order = await request(`/admin/orders/${id}`);
  window.__receiptOrder = order;
  const lines = order.items.map((i) => `<tr><td><b>${esc(i.product_name)}</b><small>${esc([i.size,i.colour].filter(Boolean).join(" / "))}</small></td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`).join("");
  return `<main class="print-page"><div class="print-actions"><a class="btn ghost" href="/admin/orders">${icon("arrow-left")} Back to orders</a><button class="btn primary" data-print="invoice">${icon("print")} Print A4 invoice</button><button class="btn primary" data-print="thermal">${icon("receipt")} Print thermal receipt</button><button class="btn ghost" data-download="invoice" data-order-id="${order.id}">${icon("download")} Download invoice</button><button class="btn ghost" data-download="thermal" data-order-id="${order.id}">${icon("download")} Download receipt</button></div><article class="invoice" id="print-document"><header><div class="brand"><img src="/logo.jpeg" alt=""><span><b>UNIFORM KINGS</b><em>QUALITY UNIFORMS · PROUD FUTURES</em></span></div><div><h1>INVOICE</h1><b>${esc(order.order_number)}</b><small>${new Date(order.created_at).toLocaleString("en-KE")}</small></div></header><section class="invoice-meta"><div><b>Billed to</b><span>${esc(order.customer_name)}</span><span>${esc(order.phone || "Walk-in customer")}</span><span>${esc(order.email || "")}</span></div><div><b>Payment</b><span>${esc(order.checkout_method.replaceAll("_", " "))}</span><b>Order status</b><span>${esc(order.status.replaceAll("_", " "))}</span></div></section><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table><section class="invoice-total"><span>Subtotal</span><b>${money(order.subtotal)}</b><span>Delivery</span><b>${money(order.delivery_fee)}</b><strong>Total paid</strong><strong>${money(order.total)}</strong></section><footer>Thank you for choosing Uniform Kings.<br>Keep this receipt as proof of purchase.</footer></article></main>`;
}

async function orderDetailPage(id) {
  const order = await request(`/admin/orders/${id}`);
  const preview = await receiptPage(id);
  const editable = order.status !== "completed";
  const controls = editable ? `<form id="order-edit-form" data-order-id="${order.id}" class="order-edit-card"><div class="order-edit-title"><b>Edit open order</b><small>Customer and fulfilment details can be changed until completion.</small></div><label>Customer<input name="customer_name" value="${esc(order.customer_name)}" required></label><label>Phone<input name="phone" value="${esc(order.phone || "")}"></label><label>Email<input name="email" type="email" value="${esc(order.email || "")}"></label><label>Status<select name="status">${["pending_payment","paid","processing","awaiting_personalisation","ready_dispatch","dispatched","ready_pickup","delivered","completed","cancelled","refunded"].map((status) => `<option value="${status}" ${order.status === status ? "selected" : ""}>${status.replaceAll("_", " ")}</option>`).join("")}</select></label><label>Payment<select name="payment_status">${["pending","paid","failed","refunded"].map((status) => `<option value="${status}" ${order.payment_status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label class="wide-field">Delivery details<input name="delivery_address" value="${esc(order.delivery_address || "")}"></label><button class="btn primary">Save order</button></form>` : `<div class="order-locked">${icon("lock")} This order is complete and locked from editing. Printing and downloads remain available.</div>`;
  return preview.replace("<h1>INVOICE</h1>", '<h1><span class="invoice-label">TAX INVOICE</span><span class="receipt-label">SALES RECEIPT</span></h1>').replace('<b>Payment</b><span>walkin</span>', "").replace('<article class="invoice"', `${controls}<article class="invoice"`);
}

function renderPosCart() {
  const target = document.querySelector("#walkin-items"), items = window.__posCart || [];
  if (!target) return;
  target.innerHTML = items.length ? items.map((item, index) => `<div class="walkin-line"><div><b>${esc(item.name)}</b><small>${esc([item.size,item.colour].filter(Boolean).join(" / ") || "Standard")}</small></div><div class="pos-qty"><button type="button" data-pos-qty="${index}" data-delta="-1">−</button><b>${item.quantity}</b><button type="button" data-pos-qty="${index}" data-delta="1">+</button></div><b>${money(item.price * item.quantity)}</b><button type="button" class="remove" data-pos-remove="${index}">${icon("trash")}</button></div>`).join("") : '<div class="empty">Choose a product from the left.</div>';
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelector("#walkin-total").textContent = money(total);
  document.querySelector("#complete-walkin").disabled = !items.length;
}

document.addEventListener("click", async (event) => {
  const download = event.target.closest("[data-download]");
  if (download) {
    const response = await fetch(`${API}/admin/orders/${download.dataset.orderId}/pdf?format=${download.dataset.download === "thermal" ? "thermal" : "invoice"}`, { credentials: "include" });
    if (!response.ok) return toast("Could not prepare the PDF.", "error");
    const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement("a");
    const buyer = String(window.__receiptOrder?.customer_name || "walk-in-customer").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "walk-in-customer";
    const orderNumber = String(window.__receiptOrder?.order_number || download.dataset.orderId);
    anchor.href = url; anchor.download = `${download.dataset.download === "thermal" ? "receipt" : "invoice"}-${buyer}-${orderNumber}.pdf`; anchor.click(); URL.revokeObjectURL(url); return;
  }
  const print = event.target.closest("[data-print]");
  if (print) { document.body.classList.toggle("thermal-print", print.dataset.print === "thermal"); window.print(); document.body.classList.remove("thermal-print"); return; }
  const productButton = event.target.closest("[data-pos-product]");
  if (productButton) {
    try {
      const product = await request(`/products/${productButton.dataset.posSlug}`);
      const option = product.variants.filter((v) => v.stock > 0);
      if (!option.length) return toast("This product has no available options.", "error");
      document.querySelector(".pos-picker")?.remove();
      const picker = document.createElement("div"); picker.className = "pos-picker";
      picker.innerHTML = `<div class="pos-picker-card"><header><div><span>${icon("cart-plus")}</span><div><small>Add to walk-in sale</small><h2>${esc(product.name)}</h2><p>${money(product.price)} · ${product.stock} total in stock</p></div></div><button type="button" data-close-pos aria-label="Close">${icon("xmark")}</button></header><div class="pos-picker-options">${option.map((variant) => `<button type="button" data-pos-option="${variant.id}"><span>${icon("shirt")}</span><b>${esc([variant.size,variant.colour].filter(Boolean).join(" / ") || "Standard")}</b><small>${variant.stock} available</small><strong>${money(+product.price + +variant.price_adjustment)}</strong></button>`).join("")}</div><footer>Choose the exact size and colour. It will be added to the current sale.</footer></div>`;
      picker.__product = product; document.body.appendChild(picker);
    } catch (error) { toast(error.message, "error"); }
  }
  if (event.target.closest("[data-close-pos]") || event.target.classList.contains("pos-picker")) { document.querySelector(".pos-picker")?.remove(); return; }
  const posOption = event.target.closest("[data-pos-option]");
  if (posOption) {
    const picker = posOption.closest(".pos-picker"), product = picker.__product, selection = product.variants.find((variant) => +variant.id === +posOption.dataset.posOption);
    const existing = window.__posCart.find((item) => item.variant_id === selection.id);
    if (existing) existing.quantity = Math.min(existing.quantity + 1, selection.stock); else window.__posCart.push({ variant_id:selection.id, name:product.name, size:selection.size, colour:selection.colour, stock:selection.stock, price:+product.price + +selection.price_adjustment, quantity:1 });
    picker.remove(); renderPosCart(); toast(`${product.name} added to the sale.`); return;
  }
  const quantity = event.target.closest("[data-pos-qty]");
  if (quantity) { const item=window.__posCart[+quantity.dataset.posQty]; item.quantity=Math.max(1,Math.min(item.stock,item.quantity + +quantity.dataset.delta)); renderPosCart(); }
  const remove = event.target.closest("[data-pos-remove]");
  if (remove) { window.__posCart.splice(+remove.dataset.posRemove,1); renderPosCart(); }
});

let draggedCategoryRow=null;
document.addEventListener("dragstart",(event)=>{const row=event.target.closest("[data-category-row]");if(!row)return;draggedCategoryRow=row;row.classList.add("dragging");event.dataTransfer.effectAllowed="move";});
document.addEventListener("dragover",(event)=>{const row=event.target.closest("[data-category-row]");if(!row||!draggedCategoryRow||row===draggedCategoryRow)return;event.preventDefault();const box=row.getBoundingClientRect();row.parentElement.insertBefore(draggedCategoryRow,event.clientY<box.top+box.height/2?row:row.nextSibling);});
document.addEventListener("dragend",async()=>{
  if(!draggedCategoryRow)return;draggedCategoryRow.classList.remove("dragging");draggedCategoryRow=null;
  const ordered=[...document.querySelectorAll("[data-category-row]")];
  try{await Promise.all(ordered.map((row,index)=>{const category=(window.__adminCategories||[]).find((item)=>+item.id===+row.dataset.categoryRow);if(!category)return Promise.resolve();category.sort_order=(index+1)*10;return request(`/admin/categories/${category.id}`,{method:"PATCH",body:JSON.stringify({...category,is_active:!!category.is_active})});}));toast("Category order saved.");}
  catch(error){toast(error.message,"error");render();}
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "walkin-form") return;
  event.preventDefault(); const form=event.target, button=form.querySelector("#complete-walkin"); button.disabled=true; button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Completing sale…';
  try { const body=Object.fromEntries(new FormData(form)); body.items=window.__posCart.map((item)=>({variant_id:item.variant_id,quantity:item.quantity})); body.notes=`Walk-in payment: ${body.payment_method}`; const order=await request("/admin/walkins",{method:"POST",body:JSON.stringify(body)}); toast("Sale completed. Receipt ready."); go(`/admin/receipt/${order.id}`); } catch(error) { toast(error.message,"error"); button.disabled=false; button.textContent="Complete sale & print receipt"; }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "order-edit-form") return;
  event.preventDefault(); event.stopImmediatePropagation();
  const form = event.target, button = form.querySelector("button"); button.disabled = true; button.innerHTML = `${icon("spinner")} Saving…`;
  try { await request(`/admin/orders/${form.dataset.orderId}`, { method:"PATCH", body:JSON.stringify(Object.fromEntries(new FormData(form))) }); toast("Order details saved."); render(); }
  catch (error) { toast(error.message, "error"); button.disabled = false; button.textContent = "Save order"; }
}, true);

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.id !== "edit-product-form") return;
  event.preventDefault(); const button = form.querySelector("button"); button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
  try {
    const fd = new FormData(form), body = Object.fromEntries(fd); body.is_featured = form.querySelector('[name="is_featured"]').checked; body.is_new = form.querySelector('[name="is_new"]').checked;
    await request(`/admin/products/${form.dataset.productId}`, { method:"PATCH", body:JSON.stringify(body) });
    const sizes = String(fd.get("sizes") || "").split(",").map((x) => x.trim()).filter(Boolean), colours = String(fd.get("colours") || "").split(",").map((x) => x.trim()).filter(Boolean);
    const variants = (sizes.length ? sizes : [""]).flatMap((size) => (colours.length ? colours : [""]).map((colour) => ({ size, colour })));
    await request(`/admin/products/${form.dataset.productId}/variants`, { method:"PUT", body:JSON.stringify({ variants }) });
    const images = new FormData(); [...fd.getAll("images")].filter((file) => file.size).forEach((file) => images.append("images", file)); images.append("alt_text", fd.get("name"));
    if ([...images.keys()].some((key) => key === "images")) await request(`/admin/products/${form.dataset.productId}/images`, { method:"POST", body:images });
    toast("All product details saved."); go("/admin/products");
  } catch (error) { toast(error.message,"error"); button.disabled=false; button.textContent="Save all changes"; }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.matches("form[data-category-edit]")) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const button=form.querySelector("button"), body=Object.fromEntries(new FormData(form));
  body.is_active=form.querySelector('[name="is_active"]').checked; button.disabled=true; button.innerHTML=`${icon("spinner")} Saving…`;
  try { await request(`/admin/categories/${form.dataset.categoryEdit}`,{method:"PATCH",body:JSON.stringify(body)}); toast("Category saved."); render(); }
  catch(error){ toast(error.message,"error"); button.disabled=false; button.textContent="Save category"; }
}, true);

document.addEventListener("click", (event) => {
  const modal=document.querySelector("[data-category-modal]");
  const edit=event.target.closest("[data-edit-category]");
  if(edit&&modal){const category=(window.__adminCategories||[]).find((item)=>+item.id===+edit.dataset.editCategory),form=modal.querySelector("form");if(!category)return;form.dataset.categoryEdit=category.id;["name","slug","sort_order","description","seo_title","seo_description"].forEach((name)=>{form.elements[name].value=category[name]??"";});form.elements.is_active.checked=!!category.is_active;modal.hidden=false;document.body.classList.add("modal-open");return;}
  if(event.target.closest("[data-close-category]")&&modal){modal.hidden=true;document.body.classList.remove("modal-open");}
});

document.addEventListener("submit", async (event) => {
  const form=event.target;
  if(form.id!=="better-product-form")return;
  event.preventDefault(); event.stopImmediatePropagation();
  const fd=new FormData(form), button=form.querySelector("button"); button.disabled=true; button.innerHTML=`${icon("spinner")} Saving…`;
  try {
    const body=Object.fromEntries(fd); body.is_featured=fd.has("is_featured"); body.is_new=fd.has("is_new"); delete body.images; delete body.sizes; delete body.colours;
    const saved=await request("/admin/products",{method:"POST",body:JSON.stringify(body)});
    const values=(name)=>[...new Set(String(fd.get(name)||"").split(",").map((value)=>value.trim()).filter(Boolean))];
    const sizes=values("sizes"), colours=values("colours"), variants=(sizes.length?sizes:[""]).flatMap((size)=>(colours.length?colours:[""]).map((colour)=>({size,colour})));
    await request(`/admin/products/${saved.id}/variants`,{method:"POST",body:JSON.stringify({variants})});
    const images=new FormData(); [...fd.getAll("images")].filter((file)=>file.size).forEach((file)=>images.append("images",file)); images.append("alt_text",fd.get("name"));
    if([...images.keys()].some((key)=>key==="images"))await request(`/admin/products/${saved.id}/images`,{method:"POST",body:images});
    toast("Product and options created."); go("/admin/products");
  } catch(error){toast(error.message,"error");button.disabled=false;button.textContent="Save product and options";}
}, true);

document.addEventListener("submit",(event)=>{const form=event.target;if(!form.matches("[data-admin-product-filter]"))return;event.preventDefault();const params=new URLSearchParams(new FormData(form));for(const [key,value] of [...params])if(!value)params.delete(key);go(`/admin/products${params.size?`?${params}`:""}`);},true);

document.addEventListener("input",(event)=>{if(!event.target.matches("[data-pos-search]"))return;const query=event.target.value.trim().toLowerCase();let visible=0;document.querySelectorAll("[data-pos-product]").forEach((button)=>{const show=!query||button.dataset.searchText.includes(query);button.hidden=!show;if(show)visible++;});const count=document.querySelector("[data-pos-count]");if(count)count.textContent=`${visible} matching product${visible===1?"":"s"}`;});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.id !== "real-checkout-form") return;
  event.preventDefault(); event.stopImmediatePropagation();
  const button = form.querySelector("#checkout-start"); button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting checkout…';
  try {
    const cartSnapshot = getCart(); const body = Object.fromEntries(new FormData(form)); body.items = cartSnapshot.map((item) => ({ variant_id:item.variant_id, quantity:item.quantity }));
    const result = await request("/orders", { method:"POST", body:JSON.stringify(body) }); saveCart([]);
    let cfg = result.checkout_method.config_json; try { cfg=typeof cfg === "string" ? JSON.parse(cfg) : cfg || {}; } catch {}
    if (result.checkout_method.code === "whatsapp" && cfg.whatsapp_number) {
      const lines = cartSnapshot.map((item) => `• ${item.name} (${[item.size,item.colour].filter(Boolean).join(" / ")}) × ${item.quantity}`).join("\n");
      const message = `Hello Uniform Kings,%0A%0AOrder: ${result.order_number}%0ACustomer: ${body.name}%0APhone: ${body.phone}%0AEmail: ${body.email}%0ADelivery: ${body.delivery_method}%0ALocation: ${body.address}%0A%0AItems:%0A${encodeURIComponent(lines)}%0A%0APlease confirm my order and payment steps.`;
      location.href=`https://wa.me/${cfg.whatsapp_number.replace(/\D/g,"")}?text=${message}`;
    } else if (result.checkout_method.code === "mpesa") {
      const payment = await request("/payments/mpesa/initiate", { method:"POST", body:JSON.stringify({ order_number:result.order_number }) });
      app.innerHTML=`${header()}<main class="success-page">${icon("mobile-screen-button")}<h1>Check your phone</h1><p>${esc(payment.message)}</p><p>Order number: <b>${esc(result.order_number)}</b></p><a class="btn primary" href="/account">View my orders</a></main>${footer()}`;
    } else {
      app.innerHTML=`${header()}<main class="success-page">${icon("circle-check")}<h1>Order received</h1><p>Your order number is <b>${esc(result.order_number)}</b>.</p><p>${esc(result.checkout_method.instructions || "Follow the selected payment instructions.")}</p><a class="btn primary" href="/shop">Continue shopping</a></main>${footer()}`;
    }
  } catch (error) { toast(error.message,"error"); button.disabled=false; button.textContent="Continue with selected option"; }
}, true);
