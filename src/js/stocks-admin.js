import { auth, db } from "./firebase-config.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ===== DOM =====
const alertEl = document.getElementById("admin-alert");
const contentEl = document.getElementById("admin-content");

const adminUserChip = document.getElementById("admin-user-chip");
const adminUserName = document.getElementById("admin-user-name");
const btnAdminLogout = document.getElementById("btn-admin-logout");

const form = document.getElementById("stock-form");
const formTitle = document.getElementById("form-title");

const stockIdInput = document.getElementById("stock-id");
const stockSymbolInput = document.getElementById("stock-symbol");
const stockNameInput = document.getElementById("stock-name");
const stockPriceInput = document.getElementById("stock-price");
const stockImageInput = document.getElementById("stock-image");
const stockCategoryInput = document.getElementById("stock-category");
const stockDescriptionInput = document.getElementById("stock-description");
const stockPopularCheckbox = document.getElementById("stock-popular");
const btnSave = document.getElementById("btn-save");
const btnReset = document.getElementById("btn-reset");
const btnRefresh = document.getElementById("btn-refresh");

const tableBody = document.getElementById("stocks-table-body");
const stocksEmptyEl = document.getElementById("stocks-empty");

const adminOrdersTableBody = document.getElementById("admin-orders-table-body");
const adminOrdersEmptyEl = document.getElementById("admin-orders-empty");

// ===== STATE =====
let currentUser = null;
let isAdmin = false;
let stocksCache = [];
let ordersCache = [];

// ===== HELPERS =====
function showAlert(message, type = "warning") {
  if (!alertEl) return;
  alertEl.className = `alert alert-${type}`;
  alertEl.textContent = message;
  alertEl.classList.remove("d-none");
}

function hideAlert() {
  if (!alertEl) return;
  alertEl.classList.add("d-none");
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "0đ";
  return value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

function resetForm() {
  if (!form) return;
  form.reset();
  if (stockIdInput) stockIdInput.value = "";
  if (formTitle) {
    formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square me-1"></i> Thêm mã chứng khoán';
  }
  if (btnSave) btnSave.textContent = "Lưu";
}

function fillForm(stock) {
  if (!stock) return;
  if (stockIdInput) stockIdInput.value = stock.id || "";
  if (stockSymbolInput) stockSymbolInput.value = stock.symbol || "";
  if (stockNameInput) stockNameInput.value = stock.name || "";
  if (stockPriceInput) stockPriceInput.value = stock.price ?? 0;
  if (stockImageInput) stockImageInput.value = stock.image || "";
  if (stockCategoryInput) stockCategoryInput.value = stock.category || "";
  if (stockDescriptionInput) stockDescriptionInput.value = stock.description || "";
  if (stockPopularCheckbox) stockPopularCheckbox.checked = Boolean(stock.isPopular);

  if (formTitle) {
    formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square me-1"></i> Chỉnh sửa mã chứng khoán';
  }
  if (btnSave) btnSave.textContent = "Cập nhật";
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

// ===== AUTH / ROLE CHECK =====
async function checkIsAdmin(user) {
  if (!user) return false;
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    let isAdminUser = false;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.uid === user.uid && Number(data.role_id) === 1) {
        isAdminUser = true;
      }
    });

    return isAdminUser;
  } catch (error) {
    console.error("Lỗi khi kiểm tra quyền admin:", error);
    return false;
  }
}

function updateAdminUI(user, admin) {
  currentUser = user;
  isAdmin = admin;

  if (!user) {
    showAlert("Bạn cần đăng nhập để truy cập trang admin.", "warning");
    setTimeout(() => {
      window.location.href = "./login.html";
    }, 1200);
    return;
  }

  if (!admin) {
    showAlert(
      "Tài khoản của bạn không có quyền admin (role_id != 1).",
      "danger"
    );
    if (contentEl) contentEl.classList.add("d-none");
    return;
  }

  hideAlert();
  if (contentEl) contentEl.classList.remove("d-none");

  if (adminUserChip && adminUserName) {
    adminUserName.textContent = user.displayName || user.email || "Admin";
    adminUserChip.classList.remove("d-none");
  }
}

// ===== FIRESTORE: LOAD STOCKS =====
async function loadStocks() {
  if (!tableBody || !stocksEmptyEl) return;
  try {
    const stocksRef = collection(db, "stocks");
    const snapshot = await getDocs(stocksRef);
    stocksCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderStocksTable();
  } catch (error) {
    console.error("Lỗi khi tải danh sách stocks:", error);
    showAlert("Không thể tải danh sách mã từ Firestore.", "danger");
  }
}

function renderStocksTable() {
  if (!tableBody || !stocksEmptyEl) return;
  tableBody.innerHTML = "";

  if (!stocksCache.length) {
    stocksEmptyEl.classList.remove("d-none");
    return;
  }
  stocksEmptyEl.classList.add("d-none");

  const fragment = document.createDocumentFragment();

  stocksCache.forEach((stock) => {
    const tr = document.createElement("tr");

    const imgTd = document.createElement("td");
    const img = document.createElement("img");
    img.src =
      stock.image ||
      "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=300&q=80";
    img.alt = stock.name || stock.symbol || "Stock";
    img.style.width = "52px";
    img.style.height = "52px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "8px";
    imgTd.appendChild(img);

    const nameTd = document.createElement("td");
    nameTd.innerHTML = `<strong>${stock.symbol || ""}</strong><br/><small class="text-muted">${stock.name || ""}</small>`;

    const priceTd = document.createElement("td");
    priceTd.textContent = formatCurrency(Number(stock.price) || 0);

    const categoryTd = document.createElement("td");
    categoryTd.textContent = stock.category || "Khác";

    const hotTd = document.createElement("td");
    const hotBadge = document.createElement("span");
    if (stock.isPopular) {
      hotBadge.className = "status-pill badge text-bg-danger";
      hotBadge.innerHTML = '<i class="fa-solid fa-fire me-1"></i>Hot';
    } else {
      hotBadge.className = "status-pill badge text-bg-light text-dark";
      hotBadge.textContent = "Thường";
    }
    hotTd.appendChild(hotBadge);

    const actionTd = document.createElement("td");
    actionTd.className = "text-end";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-sm btn-outline-primary me-1";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.addEventListener("click", () => fillForm({ id: stock.id, ...stock }));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-sm btn-outline-danger";
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.addEventListener("click", () => handleDeleteStock(stock.id));

    actionTd.appendChild(editBtn);
    actionTd.appendChild(deleteBtn);

    tr.appendChild(imgTd);
    tr.appendChild(nameTd);
    tr.appendChild(priceTd);
    tr.appendChild(categoryTd);
    tr.appendChild(hotTd);
    tr.appendChild(actionTd);

    fragment.appendChild(tr);
  });

  tableBody.appendChild(fragment);
}

// ===== CREATE / UPDATE =====
async function handleSaveStock(event) {
  event.preventDefault();
  if (!form) return;

  const id = stockIdInput?.value.trim();
  const symbol = stockSymbolInput?.value.trim().toUpperCase();
  const name = stockNameInput?.value.trim();
  const price = Number(stockPriceInput?.value || 0);
  const image = stockImageInput?.value.trim();
  const category = stockCategoryInput?.value.trim() || "";
  const description = stockDescriptionInput?.value.trim();
  const isPopular = Boolean(stockPopularCheckbox?.checked);

  if (!symbol || !name || !Number.isFinite(price)) {
    alert("Vui lòng nhập đủ Symbol, Tên công ty và Giá.");
    return;
  }

  const data = {
    symbol,
    name,
    price,
    image,
    category,
    description,
    isPopular,
    updatedAt: serverTimestamp(),
  };

  try {
    const stocksRef = collection(db, "stocks");
    if (id) {
      const stockRef = doc(db, "stocks", id);
      await updateDoc(stockRef, data);
      alert("Cập nhật mã chứng khoán thành công.");
    } else {
      await addDoc(stocksRef, { ...data, createdAt: serverTimestamp() });
      alert("Thêm mã chứng khoán thành công.");
    }

    resetForm();
    await loadStocks();
  } catch (error) {
    console.error("Lỗi khi lưu stock:", error);
    alert("Không thể lưu mã chứng khoán. Vui lòng thử lại.");
  }
}

// ===== DELETE =====
async function handleDeleteStock(id) {
  if (!id) return;
  const confirmDelete = confirm("Bạn có chắc chắn muốn xóa mã này không?");
  if (!confirmDelete) return;

  try {
    const stockRef = doc(db, "stocks", id);
    const snap = await getDoc(stockRef);
    if (!snap.exists()) {
      alert("Mã không tồn tại hoặc đã bị xóa.");
      await loadStocks();
      return;
    }

    await deleteDoc(stockRef);
    alert("Đã xóa mã chứng khoán.");
    await loadStocks();
  } catch (error) {
    console.error("Lỗi khi xóa stock:", error);
    alert("Không thể xóa mã. Vui lòng thử lại.");
  }
}

// ===== FIRESTORE: LOAD ORDERS =====
async function loadOrders() {
  if (!adminOrdersTableBody || !adminOrdersEmptyEl) return;

  try {
    const ordersRef = collection(db, "orders");
    const ordersQuery = query(ordersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(ordersQuery);
    ordersCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderOrdersTable();
  } catch (error) {
    console.error("Lỗi khi tải danh sách orders:", error);
  }
}

function renderOrdersTable() {
  if (!adminOrdersTableBody || !adminOrdersEmptyEl) return;

  adminOrdersTableBody.innerHTML = "";

  if (!ordersCache.length) {
    adminOrdersEmptyEl.classList.remove("d-none");
    return;
  }
  adminOrdersEmptyEl.classList.add("d-none");

  const fragment = document.createDocumentFragment();

  ordersCache.forEach((order) => {
    const tr = document.createElement("tr");

    const idTd = document.createElement("td");
    idTd.textContent = order.id.slice(-6);

    const customerTd = document.createElement("td");
    customerTd.innerHTML = `<small>${order.buyerName || ""}</small><br/><small class="text-muted">${order.email || ""}</small>`;

    const totalTd = document.createElement("td");
    totalTd.textContent = formatCurrency(order.total || 0);

    const statusTd = document.createElement("td");
    const select = document.createElement("select");
    select.className = "form-select form-select-sm";

    const statuses = ["pending", "processing", "completed", "cancelled"];
    statuses.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = mapStatus(s).label;
      if (order.status === s) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", async (e) => {
      const newStatus = e.target.value;
      try {
        const orderRef = doc(db, "orders", order.id);
        await updateDoc(orderRef, {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Lỗi khi cập nhật trạng thái đơn:", error);
        alert("Không thể cập nhật trạng thái đơn hàng.");
      }
    });

    statusTd.appendChild(select);

    tr.appendChild(idTd);
    tr.appendChild(customerTd);
    tr.appendChild(totalTd);
    tr.appendChild(statusTd);

    fragment.appendChild(tr);
  });

  adminOrdersTableBody.appendChild(fragment);
}

// ===== EVENTS =====
if (form) {
  form.addEventListener("submit", handleSaveStock);
}
if (btnReset) {
  btnReset.addEventListener("click", resetForm);
}
if (btnRefresh) {
  btnRefresh.addEventListener("click", () => {
    loadStocks();
    loadOrders();
  });
}
if (btnAdminLogout) {
  btnAdminLogout.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "./login.html";
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    }
  });
}

// ===== AUTH LISTENER =====
onAuthStateChanged(auth, async (user) => {
  const admin = await checkIsAdmin(user);
  updateAdminUI(user, admin);

  if (admin) {
    await loadStocks();
    await loadOrders();
  }
});

