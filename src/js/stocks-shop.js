import { auth, db } from "./firebase-config.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ===== DOM =====
const productListEl = document.getElementById("product-list");
const productEmptyEl = document.getElementById("product-empty");
const searchInputEl = document.getElementById("search-input");
const categoryButtonsEl = document.getElementById("category-buttons");
const sortSelectEl = document.getElementById("sort-select");

const cartItemsEl = document.getElementById("cart-items");
const cartSubtotalEl = document.getElementById("cart-subtotal");
const cartTotalEl = document.getElementById("cart-total");
const cartCountBadgeEl = document.getElementById("cart-count-badge");
const checkoutBtn = document.getElementById("btn-checkout");

const loginBtn = document.getElementById("btn-login");
const logoutBtn = document.getElementById("btn-logout");
const userInfoWrapper = document.getElementById("user-info");
const userNameEl = document.getElementById("user-name");

const ordersTableBody = document.getElementById("orders-table-body");
const ordersEmptyEl = document.getElementById("orders-empty");

// Chart modal
const chartModalEl = document.getElementById("chartModal");
const chartModalTitleEl = document.getElementById("chartModalTitle");
const chartErrorEl = document.getElementById("chartError");
const chartCanvasEl = document.getElementById("stockChartCanvas");
let chart = null;
let chartModal = null;

if (chartModalEl && typeof bootstrap !== "undefined") {
  chartModal = new bootstrap.Modal(chartModalEl);
}

// ===== STATE =====
let allStocks = [];
let currentCategory = "all";
let currentSort = "popular";
let currentUser = null;
let cart = {};
let userOrders = [];

// ===== HELPERS =====
function formatCurrency(value) {
  if (!Number.isFinite(value)) return "0đ";
  return value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

function getFilteredStocks() {
  let result = [...allStocks];

  if (currentCategory !== "all") {
    result = result.filter((item) => item.category === currentCategory);
  }

  const keyword = searchInputEl?.value.trim().toLowerCase() || "";
  if (keyword) {
    result = result.filter((item) => {
      const text = `${item.symbol} ${item.name || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }

  // Sorting
  switch (currentSort) {
    case "popular":
      result.sort(
        (a, b) =>
          Number(Boolean(b.isPopular)) - Number(Boolean(a.isPopular)) ||
          (a.symbol || "").localeCompare(b.symbol || "")
      );
      break;
    case "price-asc":
      result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      break;
    case "price-desc":
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
      break;
    case "symbol-asc":
      result.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));
      break;
    default:
      break;
  }

  return result;
}

function getAlphaVantageKey() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("YGKIL06O3DLJJT7J ") ||
    localStorage.getItem("YGKIL06O3DLJJT7J ") ||
    "YGKIL06O3DLJJT7J"
  );
}

function showChartError(message) {
  if (!chartErrorEl) return;
  chartErrorEl.textContent = message;
  chartErrorEl.classList.remove("d-none");
}

function hideChartError() {
  if (!chartErrorEl) return;
  chartErrorEl.classList.add("d-none");
  chartErrorEl.textContent = "";
}

async function drawDailyChart(symbol) {
  if (!chartCanvasEl) return;

  const apiKey = getAlphaVantageKey();
  if (!apiKey) {
    showChartError(
      "Thiếu AlphaVantage API key. Hãy thêm `?apikey=...` hoặc lưu localStorage theo key `alphavantage_apikey`."
    );
    return;
  }

  hideChartError();

  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
        symbol
      )}&apikey=${apiKey}`
    );
    const data = await res.json();
    const daily = data && data["Time Series (Daily)"];
    if (!daily) {
      showChartError("Không lấy được dữ liệu biểu đồ cho mã này.");
      return;
    }

    const dates = Object.keys(daily).slice(0, 30).reverse();
    const prices = dates.map((d) => Number(daily[d]["4. close"]));

    if (chart) chart.destroy();

    chart = new Chart(chartCanvasEl, {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: `${symbol} (30 ngày)`,
            data: prices,
            borderColor: "#24b36b",
            borderWidth: 2,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
      },
    });
  } catch (err) {
    console.error("Chart error:", err);
    showChartError("Lỗi khi tải dữ liệu biểu đồ.");
  }
}

function openStockChart(symbol) {
  if (chartModalTitleEl) chartModalTitleEl.textContent = `Biểu đồ ${symbol}`;
  if (chartModal) chartModal.show();
  // Delay slightly to ensure canvas is mounted/sized
  setTimeout(() => drawDailyChart(symbol), 50);
}

// ===== CATEGORIES =====
function renderCategoryButtons() {
  if (!categoryButtonsEl) return;

  const categories = Array.from(
    new Set(allStocks.map((s) => (s.category || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const buttons = [
    { value: "all", label: "Tất cả" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  categoryButtonsEl.innerHTML = "";

  buttons.forEach((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `category-pill ${b.value === currentCategory ? "active" : ""}`;
    btn.textContent = b.label;
    btn.dataset.category = b.value;
    btn.addEventListener("click", () => {
      currentCategory = b.value;
      renderCategoryButtons();
      renderProducts();
    });
    categoryButtonsEl.appendChild(btn);
  });
}

// ===== RENDER PRODUCTS =====
function renderProducts() {
  if (!productListEl) return;

  const filtered = getFilteredStocks();

  productListEl.innerHTML = "";

  if (!filtered.length) {
    if (productEmptyEl) productEmptyEl.classList.remove("d-none");
    return;
  }

  if (productEmptyEl) productEmptyEl.classList.add("d-none");

  const fragment = document.createDocumentFragment();

  filtered.forEach((item) => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-md-6 col-lg-6";

    const card = document.createElement("div");
    card.className = "product-card h-100";

    const imgWrapper = document.createElement("div");
    imgWrapper.className = "product-img-wrapper";

    const img = document.createElement("img");
    img.src =
      item.image ||
      "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=600&q=80";
    img.alt = item.name || item.symbol || "Stock";
    imgWrapper.appendChild(img);

    if (item.isPopular) {
      const badge = document.createElement("span");
      badge.className = "product-badge";
      badge.textContent = "Phổ biến";
      imgWrapper.appendChild(badge);
    }

    const body = document.createElement("div");
    body.className = "p-3";

    const titleRow = document.createElement("div");
    titleRow.className =
      "d-flex justify-content-between align-items-start mb-1 gap-2";

    const title = document.createElement("div");
    const symbolEl = document.createElement("div");
    symbolEl.innerHTML = `<strong>${item.symbol}</strong>`;
    const nameEl = document.createElement("small");
    nameEl.className = "text-muted d-block";
    nameEl.textContent = item.name || "";
    title.appendChild(symbolEl);
    title.appendChild(nameEl);

    const priceEl = document.createElement("div");
    priceEl.className = "fw-bold text-success";
    priceEl.textContent = formatCurrency(Number(item.price) || 0);

    titleRow.appendChild(title);
    titleRow.appendChild(priceEl);

    const meta = document.createElement("div");
    meta.className = "text-muted small mb-2";
    meta.textContent = item.description || "—";

    const footerRow = document.createElement("div");
    footerRow.className = "d-flex justify-content-between align-items-center gap-2";

    const categoryChip = document.createElement("span");
    categoryChip.className = "badge bg-light text-dark";
    categoryChip.textContent = item.category || "Khác";

    const actions = document.createElement("div");
    actions.className = "d-flex gap-2";

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-sm btn-primary";
    addBtn.innerHTML = '<i class="fa-solid fa-plus me-1"></i>Giỏ';
    addBtn.addEventListener("click", () => addToCart(item));

    const chartBtn = document.createElement("button");
    chartBtn.className = "btn btn-sm btn-outline-success";
    chartBtn.innerHTML = '<i class="fa-solid fa-chart-line me-1"></i>Chart';
    chartBtn.addEventListener("click", () => openStockChart(item.symbol));

    actions.appendChild(addBtn);
    actions.appendChild(chartBtn);

    footerRow.appendChild(categoryChip);
    footerRow.appendChild(actions);

    body.appendChild(titleRow);
    body.appendChild(meta);
    body.appendChild(footerRow);

    card.appendChild(imgWrapper);
    card.appendChild(body);
    col.appendChild(card);

    fragment.appendChild(col);
  });

  productListEl.appendChild(fragment);
}

// ===== CART LOGIC =====
function getCartItemsArray() {
  return Object.values(cart);
}

function addToCart(stock) {
  if (!stock || !stock.id) return;
  const id = stock.id;

  if (!cart[id]) {
    cart[id] = {
      id,
      stockId: stock.id,
      symbol: stock.symbol,
      name: stock.name,
      price: Number(stock.price) || 0,
      image: stock.image,
      quantity: 1,
    };
  } else {
    cart[id].quantity += 1;
  }

  renderCart();
}

function updateCartItemQuantity(id, quantity) {
  if (!cart[id]) return;
  const qty = Math.max(1, Number(quantity) || 1);
  cart[id].quantity = qty;
  renderCart();
}

function removeFromCart(id) {
  if (!cart[id]) return;
  delete cart[id];
  renderCart();
}

function getCartSummary() {
  const items = getCartItemsArray();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal;
  return { subtotal, total, count: items.length };
}

function renderCart() {
  if (!cartItemsEl) return;

  const items = getCartItemsArray();
  cartItemsEl.innerHTML = "";

  if (!items.length) {
    cartItemsEl.innerHTML =
      '<div class="empty-cart">Chưa có mã nào trong giỏ.<br/>Hãy chọn ở danh sách bên trái.</div>';
  } else {
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";

      const img = document.createElement("img");
      img.src =
        item.image ||
        "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=600&q=80";
      img.alt = item.name || item.symbol || "Stock";

      const info = document.createElement("div");
      info.className = "flex-grow-1";

      const nameEl = document.createElement("div");
      nameEl.className = "fw-semibold small";
      nameEl.textContent = `${item.symbol} - ${item.name}`;

      const priceEl = document.createElement("div");
      priceEl.className = "text-muted small";
      priceEl.textContent = formatCurrency(item.price);

      info.appendChild(nameEl);
      info.appendChild(priceEl);

      const qtyWrapper = document.createElement("div");
      qtyWrapper.className = "cart-qty d-flex align-items-center gap-1";

      const minusBtn = document.createElement("button");
      minusBtn.className = "btn btn-sm btn-outline-secondary";
      minusBtn.type = "button";
      minusBtn.innerHTML = '<i class="fa-solid fa-minus"></i>';
      minusBtn.addEventListener("click", () =>
        updateCartItemQuantity(item.id, item.quantity - 1)
      );

      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.className = "form-control form-control-sm";
      qtyInput.value = item.quantity;
      qtyInput.min = "1";
      qtyInput.addEventListener("change", (e) => {
        const newQty = parseInt(e.target.value, 10) || 1;
        updateCartItemQuantity(item.id, newQty);
      });

      const plusBtn = document.createElement("button");
      plusBtn.className = "btn btn-sm btn-outline-secondary";
      plusBtn.type = "button";
      plusBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      plusBtn.addEventListener("click", () =>
        updateCartItemQuantity(item.id, item.quantity + 1)
      );

      qtyWrapper.appendChild(minusBtn);
      qtyWrapper.appendChild(qtyInput);
      qtyWrapper.appendChild(plusBtn);

      const removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-sm btn-link text-danger";
      removeBtn.type = "button";
      removeBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      removeBtn.addEventListener("click", () => removeFromCart(item.id));

      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(qtyWrapper);
      row.appendChild(removeBtn);

      fragment.appendChild(row);
    });

    cartItemsEl.appendChild(fragment);
  }

  const { subtotal, total, count } = getCartSummary();
  if (cartSubtotalEl) cartSubtotalEl.textContent = formatCurrency(subtotal);
  if (cartTotalEl) cartTotalEl.textContent = formatCurrency(total);
  if (cartCountBadgeEl) cartCountBadgeEl.textContent = `${count} cổ phiếu`;
}

// ===== FIRESTORE: LOAD STOCKS =====
async function loadStocks() {
  try {
    const stocksRef = collection(db, "stocks");
    const snapshot = await getDocs(stocksRef);
    allStocks = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        symbol: (data.symbol || "").toString().toUpperCase(),
        name: data.name || "",
        price: Number(data.price) || 0,
        image: data.image || "",
        category: data.category || "",
        description: data.description || "",
        isPopular: Boolean(data.isPopular),
      };
    });

    renderCategoryButtons();
    renderProducts();
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu stocks:", error);
    alert("Không thể tải danh sách mã chứng khoán từ Firestore.");
  }
}

// ===== FIRESTORE: CHECKOUT / CREATE ORDER =====
async function handleCheckout() {
  const items = getCartItemsArray();
  if (!items.length) {
    alert("Giỏ hàng đang trống. Hãy chọn ít nhất 1 mã.");
    return;
  }

  if (!currentUser) {
    const ok = confirm("Bạn cần đăng nhập để mua chứng khoán. Đi tới trang đăng nhập?");
    if (ok) window.location.href = "./login.html";
    return;
  }

  const { subtotal, total } = getCartSummary();
  const buyerName = currentUser.displayName || currentUser.email || "";
  const email = currentUser.email || null;

  try {
    const orderData = {
      uid: currentUser.uid,
      email,
      buyerName,
      items: items.map((it) => ({
        stockId: it.stockId,
        symbol: it.symbol,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
      })),
      subtotal,
      total,
      status: "pending",
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "orders"), orderData);

    cart = {};
    renderCart();
    await loadOrdersForUser(currentUser);

    alert("Mua thành công! Đơn mua đã được lưu.");
  } catch (error) {
    console.error("Lỗi khi tạo đơn mua:", error);
    alert("Không thể tạo đơn mua. Vui lòng thử lại.");
  }
}

// ===== FIRESTORE: LOAD USER ORDERS =====
async function loadOrdersForUser(user) {
  if (!ordersTableBody || !ordersEmptyEl) return;

  if (!user) {
    userOrders = [];
    renderUserOrders();
    return;
  }

  try {
    const ordersRef = collection(db, "orders");
    const ordersQuery = query(
      ordersRef,
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(ordersQuery);
    userOrders = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    renderUserOrders();
  } catch (error) {
    console.error("Lỗi khi tải đơn mua:", error);
  }
}

function mapStatus(status) {
  switch (status) {
    case "pending":
      return { label: "Chờ xử lý", cls: "badge text-bg-warning text-dark" };
    case "processing":
      return { label: "Đang xử lý", cls: "badge text-bg-primary" };
    case "completed":
      return { label: "Hoàn tất", cls: "badge text-bg-success" };
    case "cancelled":
      return { label: "Đã hủy", cls: "badge text-bg-secondary" };
    default:
      return { label: "Không xác định", cls: "badge text-bg-light text-dark" };
  }
}

function renderUserOrders() {
  ordersTableBody.innerHTML = "";

  if (!userOrders.length) {
    ordersEmptyEl.classList.remove("d-none");
    return;
  }
  ordersEmptyEl.classList.add("d-none");

  const fragment = document.createDocumentFragment();

  userOrders.forEach((order) => {
    const tr = document.createElement("tr");

    const idTd = document.createElement("td");
    idTd.textContent = order.id.slice(-6);

    const timeTd = document.createElement("td");
    let timeText = "-";
    if (order.createdAt?.toDate) {
      const d = order.createdAt.toDate();
      timeText = d.toLocaleString("vi-VN");
    }
    timeTd.textContent = timeText;

    const totalTd = document.createElement("td");
    totalTd.textContent = formatCurrency(order.total || 0);

    const statusTd = document.createElement("td");
    const s = mapStatus(order.status);
    const badge = document.createElement("span");
    badge.className = s.cls;
    badge.textContent = s.label;
    statusTd.appendChild(badge);

    tr.appendChild(idTd);
    tr.appendChild(timeTd);
    tr.appendChild(totalTd);
    tr.appendChild(statusTd);

    fragment.appendChild(tr);
  });

  ordersTableBody.appendChild(fragment);
}

// ===== AUTH UI =====
function updateAuthUI(user) {
  currentUser = user || null;

  if (userInfoWrapper && userNameEl) {
    if (user) {
      userNameEl.textContent = user.displayName || user.email || "Người dùng";
      userInfoWrapper.classList.remove("d-none");
    } else {
      userInfoWrapper.classList.add("d-none");
      userNameEl.textContent = "";
    }
  }

  if (loginBtn) loginBtn.classList.toggle("d-none", Boolean(user));
  if (logoutBtn) logoutBtn.classList.toggle("d-none", !user);
}

// ===== EVENTS =====
if (searchInputEl) {
  searchInputEl.addEventListener("input", () => renderProducts());
}

if (sortSelectEl) {
  sortSelectEl.addEventListener("change", () => {
    currentSort = sortSelectEl.value || "popular";
    renderProducts();
  });
}

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", handleCheckout);
}

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    window.location.href = "./login.html";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  updateAuthUI(user);
  loadOrdersForUser(user);
});

// ===== INIT =====
loadStocks();
renderCart();

