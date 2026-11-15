const state = {
  cart: JSON.parse(localStorage.getItem("northstar-cart") || "[]"),
  user: null,
  products: [],
};
const $ = (selector) => document.querySelector(selector);
const money = (value) => `$${Number(value).toFixed(2)}`;
const saveCart = () => {
  localStorage.setItem("northstar-cart", JSON.stringify(state.cart));
  updateCartCount();
};
const toast = (message) => {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
};
const updateCartCount = () => {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const el = $("#cartCount");
  if (el) el.textContent = count;
};
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function openLayer(id) {
  $(`#${id}`)?.classList.add("visible");
}
function closeLayers() {
  document
    .querySelectorAll(".visible")
    .forEach((el) => el.classList.remove("visible"));
}
function renderCart() {
  const container = $("#cartItems");
  if (!container) return;
  updateCartCount();
  if (!state.cart.length) {
    container.innerHTML =
      '<div class="empty">Your cart is waiting for something good.</div>';
    $("#cartTotal").textContent = money(0);
    return;
  }
  container.innerHTML = state.cart
    .map(
      (item) =>
        `<div class="cart-item"><img src="${item.image}" alt="${item.name}"><div class="cart-item-info"><small>${item.category}</small><strong>${item.name}</strong><div class="quantity"><button data-quantity="${item.id}" data-change="-1">−</button><span>${item.quantity}</span><button data-quantity="${item.id}" data-change="1">+</button><button class="remove-item" data-remove="${item.id}">Remove</button></div></div><span>${money(item.price * item.quantity)}</span></div>`,
    )
    .join("");
  $("#cartTotal").textContent = money(
    state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
  );
}
function addToCart(product, quantity = 1) {
  const existing = state.cart.find((item) => item.id === product.id);
  if (existing) existing.quantity += quantity;
  else state.cart.push({ ...product, quantity });
  saveCart();
  renderCart();
  toast(`${product.name} added to your cart.`);
}
function renderProducts(products) {
  const grid = $("#productGrid");
  if (!grid) return;
  grid.innerHTML = products
    .map(
      (p) =>
        `<article class="product-card"><a class="product-image" href="/product/${p.id}"><img src="${p.image}" alt="${p.name}"></a><div class="product-meta"><div><a class="product-name" href="/product/${p.id}">${p.name}</a><div class="product-category">${p.category}</div></div><span class="product-price">${money(p.price)}</span></div></article>`,
    )
    .join("");
}
async function loadProducts(category = "All") {
  try {
    state.products = await api(
      `/api/products${category === "All" ? "" : `?category=${encodeURIComponent(category)}`}`,
    );
    renderProducts(state.products);
  } catch (error) {
    $("#productGrid").innerHTML = `<p class="error">${error.message}</p>`;
  }
}

function accountForm(mode = "login", error = "") {
  const register = mode === "register";
  $("#accountContent").innerHTML =
    `<h2>${register ? "Create your account" : "Welcome back"}</h2><p>${register ? "Save your details for a faster checkout." : "Log in to see your orders and check out faster."}</p>${error ? `<p class="error">${error}</p>` : ""}<form class="form-stack" id="accountForm">${register ? '<label>NAME<input name="name" required autocomplete="name"></label>' : ""}<label>EMAIL<input name="email" type="email" required autocomplete="email"></label><label>PASSWORD<input name="password" type="password" minlength="6" required autocomplete="${register ? "new-password" : "current-password"}"></label><button class="button button-dark">${register ? "Create account" : "Log in"} <span>↗</span></button></form><p class="form-switch">${register ? "Already have an account?" : "New to Northstar?"} <button id="switchAccount">${register ? "Log in" : "Create one"}</button></p>`;
  $("#switchAccount").onclick = () =>
    accountForm(register ? "login" : "register");
  $("#accountForm").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    try {
      const result = await api(`/api/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      state.user = result.user;
      closeLayers();
      toast(`Welcome, ${state.user.name.split(" ")[0]}!`);
    } catch (err) {
      accountForm(mode, err.message);
    }
  };
}
function showAccount() {
  if (state.user) {
    $("#accountContent").innerHTML =
      `<h2>Hi, ${state.user.name.split(" ")[0]}.</h2><p>${state.user.email}</p><div id="orders"><p>Loading your orders...</p></div><button class="button button-dark" id="logoutButton">Log out <span>↗</span></button>`;
    api("/api/orders").then((orders) => {
      $("#orders").innerHTML = orders.length
        ? `<h3>Order history</h3>${orders.map((order) => `<p><strong>Order #${order.id}</strong> · ${money(order.total)} · ${order.status}</p>`).join("")}`
        : "<p>No orders yet.</p>";
    });
    $("#logoutButton").onclick = async () => {
      await api("/api/logout", { method: "POST" });
      state.user = null;
      closeLayers();
      toast("You have been logged out.");
    };
  } else accountForm();
  openLayer("accountModal");
}
function checkout() {
  if (!state.cart.length) return toast("Add something to your cart first.");
  if (!state.user) {
    closeLayers();
    showAccount();
    toast("Log in to complete your order.");
    return;
  }
  $("#checkoutContent").innerHTML =
    `<h2>Almost yours.</h2><p>Where should we send your order?</p><form class="form-stack" id="checkoutForm"><label>SHIPPING ADDRESS<textarea name="shippingAddress" rows="3" required placeholder="Street, city, state, postal code"></textarea></label><button class="button button-dark">Place order · ${money(state.cart.reduce((sum, i) => sum + i.price * i.quantity, 0))} <span>↗</span></button></form>`;
  $("#checkoutForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(event.target));
      const result = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          items: state.cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });
      state.cart = [];
      saveCart();
      renderCart();
      closeLayers();
      $("#cartDrawer")?.classList.remove("visible");
      toast(`Order #${result.orderId} placed. Thank you!`);
    } catch (err) {
      toast(err.message);
    }
  };
  openLayer("checkoutModal");
}

async function init() {
  updateCartCount();
  renderCart();
  try {
    state.user = (await api("/api/me")).user;
  } catch (_) {
    /* anonymous visitors are expected */
  }
  $("#cartButton")?.addEventListener("click", () => {
    renderCart();
    openLayer("drawerBackdrop");
    $("#cartDrawer").classList.add("visible");
  });
  $("#accountButton")?.addEventListener("click", showAccount);
  $("#checkoutButton")?.addEventListener("click", checkout);
  document
    .querySelectorAll("[data-close]")
    .forEach((button) => button.addEventListener("click", closeLayers));
  $("#drawerBackdrop")?.addEventListener("click", closeLayers);
  document.querySelectorAll(".category").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelector(".category.active")?.classList.remove("active");
      button.classList.add("active");
      loadProducts(button.dataset.category);
    }),
  );
  $("#newsletterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    event.target.innerHTML = "<p>Thank you — you are on the list.</p>";
  });
  $("#cartItems")?.addEventListener("click", (event) => {
    const quantityId = event.target.dataset.quantity;
    const removeId = event.target.dataset.remove;
    if (quantityId) {
      const item = state.cart.find((i) => i.id === Number(quantityId));
      item.quantity += Number(event.target.dataset.change);
      if (item.quantity <= 0)
        state.cart = state.cart.filter((i) => i.id !== item.id);
      saveCart();
      renderCart();
    }
    if (removeId) {
      state.cart = state.cart.filter((i) => i.id !== Number(removeId));
      saveCart();
      renderCart();
    }
  });
  if ($("#productGrid")) loadProducts();
  const detail = $("#productDetail");
  if (detail) {
    const id = location.pathname.split("/").pop();
    try {
      const product = await api(`/api/products/${id}`);
      document.title = `${product.name} — Northstar Market`;
      detail.innerHTML = `<div class="product-detail-image"><img src="${product.image}" alt="${product.name}"></div><div class="product-detail-copy"><p class="eyebrow">${product.category}</p><h1>${product.name}</h1><p class="description">${product.description}</p><div class="detail-price">${money(product.price)}</div><div class="add-row"><input id="detailQuantity" type="number" min="1" max="20" value="1"><button class="button button-dark" id="addDetail">Add to cart <span>↗</span></button></div></div>`;
      $("#addDetail").onclick = () =>
        addToCart(product, Number($("#detailQuantity").value) || 1);
    } catch (error) {
      detail.innerHTML = `<p class="error">${error.message}</p>`;
    }
  }
}
init();
