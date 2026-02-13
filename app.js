// Velan Food Court Billing App
// Data model, localStorage, billing, admin CRUD, and reports logic.

const STORAGE_KEYS = {
  menu: "vfc_menu",
  tables: "vfc_tables",
  openBills: "vfc_openBills",
  sales: "vfc_sales",
  settings: "vfc_settings",
};

let state = {
  menuItems: [],
  tables: [],
  openBills: [],
  sales: [],
  settings: {
    billCounterByMonth: {},
  },
  ui: {
    context: null, // { type: 'table'|'takeaway', refId: string }
  },
};

// Utility: simple ID generator
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function loadState() {
  state.menuItems = loadFromStorage(STORAGE_KEYS.menu, []);
  state.tables = loadFromStorage(STORAGE_KEYS.tables, []);
  state.openBills = loadFromStorage(STORAGE_KEYS.openBills, []);
  state.sales = loadFromStorage(STORAGE_KEYS.sales, []);
  state.settings = loadFromStorage(STORAGE_KEYS.settings, {
    billCounterByMonth: {},
  });

  // Seed defaults if first time
  if (!state.menuItems.length) {
    seedDefaultMenu();
  }
  if (!state.tables.length) {
    seedDefaultTables();
  }
}

function persistState() {
  saveToStorage(STORAGE_KEYS.menu, state.menuItems);
  saveToStorage(STORAGE_KEYS.tables, state.tables);
  saveToStorage(STORAGE_KEYS.openBills, state.openBills);
  saveToStorage(STORAGE_KEYS.sales, state.sales);
  saveToStorage(STORAGE_KEYS.settings, state.settings);
}

function seedDefaultMenu() {
  const defaults = [
    {
      name: "Chicken Biryani",
      category: "Biryani",
      price: 150,
      // Download a biryani image from an open-source site (e.g. Pexels/Unsplash)
      // and save it as assets/chicken-biryani.jpg
      imagePath: "assets/chicken-biryani.jpg",
    },
    {
      name: "Chilly Chicken",
      category: "Side",
      price: 130,
      imagePath: "assets/chilly-chicken.jpg",
    },
    {
      name: "Egg Rice",
      category: "Rice",
      price: 90,
      imagePath: "assets/egg-rice.jpg",
    },
    {
      name: "Chicken Rice",
      category: "Rice",
      price: 120,
      imagePath: "assets/chicken-rice.jpg",
    },
    {
      name: "Soda",
      category: "Drink",
      price: 30,
      imagePath: "assets/soda.jpg",
    },
    {
      name: "Empty Biryani",
      category: "Biryani",
      price: 80,
      imagePath: "assets/empty-biryani.jpg",
    },
    {
      name: "Egg Biryani",
      category: "Biryani",
      price: 120,
      imagePath: "assets/egg-biryani.jpg",
    },
    {
      name: "Biryani Combo",
      category: "Combo",
      price: 220,
      imagePath: "assets/biryani-combo.jpg",
    },
  ];

  state.menuItems = defaults.map((item) => ({
    id: generateId("menu"),
    name: item.name,
    category: item.category,
    price: item.price,
    imagePath: item.imagePath || "",
    isActive: true,
  }));
}

function seedDefaultTables() {
  const defaults = ["T1", "T2", "T3", "T4"];
  state.tables = defaults.map((name) => ({
    id: generateId("table"),
    name,
    isActive: true,
  }));
}

function getMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function generateBillNumber(date = new Date()) {
  const monthKey = getMonthKey(date);
  if (!state.settings.billCounterByMonth) {
    state.settings.billCounterByMonth = {};
  }
  const current = state.settings.billCounterByMonth[monthKey] || 0;
  const next = current + 1;
  state.settings.billCounterByMonth[monthKey] = next;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const seq = String(next).padStart(3, "0");
  return `VFC-${y}${m}-${seq}`;
}

// UI helpers

function formatCurrency(value) {
  return `₹${value.toFixed(2)}`;
}

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

// Rendering

function renderTables() {
  const container = $("#tables-list");
  if (!container) return;
  container.innerHTML = "";
  state.tables.forEach((table) => {
    if (!table.isActive) return;
    const btn = document.createElement("button");
    btn.className = "table-chip";
    if (state.ui.context && state.ui.context.type === "table" && state.ui.context.refId === table.id) {
      btn.classList.add("active");
    }
    btn.textContent = table.name;
    btn.addEventListener("click", () => {
      state.ui.context = { type: "table", refId: table.id };
      renderTables();
      renderCart();
    });
    container.appendChild(btn);
  });

  const takeawayBtn = $("#takeaway-btn");
  if (takeawayBtn) {
    takeawayBtn.classList.toggle(
      "active",
      !!state.ui.context && state.ui.context.type === "takeaway"
    );
  }
}

function renderMenu() {
  const grid = $("#menu-grid");
  if (!grid) return;
  grid.innerHTML = "";
  state.menuItems.forEach((item) => {
    if (!item.isActive) return;
    const card = document.createElement("div");
    card.className = "menu-card";
    card.addEventListener("click", () => {
      addItemToCurrentBill(item.id);
    });

    if (item.imagePath) {
      const img = document.createElement("img");
      img.src = item.imagePath;
      img.alt = item.name;
      card.appendChild(img);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "menu-name";
    nameEl.textContent = item.name;
    card.appendChild(nameEl);

    const priceEl = document.createElement("div");
    priceEl.className = "menu-price";
    priceEl.textContent = formatCurrency(item.price);
    card.appendChild(priceEl);

    grid.appendChild(card);
  });
}

function getCurrentBill() {
  const ctx = state.ui.context;
  if (!ctx) return null;
  let bill = state.openBills.find(
    (b) => b.type === ctx.type && b.refId === ctx.refId && b.status === "open"
  );
  if (!bill) {
    bill = {
      id: generateId("bill"),
      type: ctx.type,
      refId: ctx.refId,
      items: [],
      status: "open",
      createdAt: new Date().toISOString(),
    };
    state.openBills.push(bill);
  }
  return bill;
}

function getContextLabel() {
  const ctx = state.ui.context;
  if (!ctx) return "No table selected";
  if (ctx.type === "takeaway") return "Takeaway";
  const table = state.tables.find((t) => t.id === ctx.refId);
  return table ? table.name : "Table";
}

function renderCart() {
  const ctxLabelEl = $("#bill-context-label");
  const billNumberLabelEl = $("#bill-number-label");
  const itemsContainer = $("#cart-items");
  const totalEl = $("#cart-total");

  if (!ctxLabelEl || !billNumberLabelEl || !itemsContainer || !totalEl) return;

  ctxLabelEl.textContent = getContextLabel();
  billNumberLabelEl.textContent = "Bill #: Pending";

  const bill = getCurrentBill();
  itemsContainer.innerHTML = "";

  if (!bill || !bill.items.length) {
    itemsContainer.innerHTML = '<p style="font-size:0.8rem;color:#6b7280;">No items. Click a menu item to add.</p>';
    totalEl.textContent = formatCurrency(0);
    return;
  }

  let total = 0;
  bill.items.forEach((line) => {
    const menuItem = state.menuItems.find((m) => m.id === line.menuItemId);
    const price = line.price ?? (menuItem ? menuItem.price : 0);
    const lineTotal = price * line.qty;
    total += lineTotal;

    const row = document.createElement("div");
    row.className = "cart-item-row";

    const nameEl = document.createElement("div");
    nameEl.className = "cart-item-name";
    nameEl.textContent = line.name;

    const qtyEl = document.createElement("div");
    const qtyControls = document.createElement("div");
    qtyControls.className = "cart-qty-controls";

    const minusBtn = document.createElement("button");
    minusBtn.className = "qty-btn";
    minusBtn.textContent = "-";
    minusBtn.addEventListener("click", () => changeLineQty(bill.id, line.menuItemId, -1));

    const qtyText = document.createElement("span");
    qtyText.textContent = String(line.qty);

    const plusBtn = document.createElement("button");
    plusBtn.className = "qty-btn";
    plusBtn.textContent = "+";
    plusBtn.addEventListener("click", () => changeLineQty(bill.id, line.menuItemId, 1));

    qtyControls.appendChild(minusBtn);
    qtyControls.appendChild(qtyText);
    qtyControls.appendChild(plusBtn);
    qtyEl.appendChild(qtyControls);

    const linePriceEl = document.createElement("div");
    linePriceEl.textContent = formatCurrency(price);

    const lineTotalEl = document.createElement("div");
    lineTotalEl.textContent = formatCurrency(lineTotal);

    row.appendChild(nameEl);
    row.appendChild(qtyEl);
    row.appendChild(linePriceEl);
    row.appendChild(lineTotalEl);

    itemsContainer.appendChild(row);
  });

  totalEl.textContent = formatCurrency(total);
}

// Cart operations

function addItemToCurrentBill(menuItemId) {
  const ctx = state.ui.context;
  if (!ctx) {
    alert("Select a table or Takeaway first.");
    return;
  }
  const bill = getCurrentBill();
  const item = state.menuItems.find((m) => m.id === menuItemId);
  if (!item) return;

  let line = bill.items.find((l) => l.menuItemId === menuItemId);
  if (!line) {
    line = {
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 0,
    };
    bill.items.push(line);
  }
  line.qty += 1;
  persistState();
  renderCart();
}

function changeLineQty(billId, menuItemId, delta) {
  const bill = state.openBills.find((b) => b.id === billId);
  if (!bill) return;
  const line = bill.items.find((l) => l.menuItemId === menuItemId);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) {
    bill.items = bill.items.filter((l) => l.menuItemId !== menuItemId);
  }
  if (!bill.items.length) {
    state.openBills = state.openBills.filter((b) => b.id !== bill.id);
  }
  persistState();
  renderCart();
}

function clearCurrentCart() {
  const bill = getCurrentBill();
  if (!bill || !bill.items.length) return;
  if (!confirm("Clear all items from this bill?")) return;
  state.openBills = state.openBills.filter((b) => b.id !== bill.id);
  persistState();
  renderCart();
}

// Payment & sales

function calculateBillTotal(bill) {
  return bill.items.reduce((sum, line) => sum + line.price * line.qty, 0);
}

function openQrModal() {
  const bill = getCurrentBill();
  if (!bill || !bill.items.length) {
    alert("No items in bill.");
    return;
  }
  const total = calculateBillTotal(bill);
  const modal = $("#qr-modal");
  const totalEl = $("#qr-total");
  if (!modal || !totalEl) return;
  totalEl.textContent = formatCurrency(total);
  modal.classList.remove("hidden");
}

function closeQrModal() {
  const modal = $("#qr-modal");
  if (modal) modal.classList.add("hidden");
}

function markCurrentBillPaid() {
  const bill = getCurrentBill();
  if (!bill || !bill.items.length) {
    alert("No items in bill.");
    return;
  }
  const paymentModeSelect = $("#payment-mode");
  const mode = paymentModeSelect ? paymentModeSelect.value : "cash";

  if (mode !== "cash") {
    // For non-cash, just clear the open bill without recording in reports
    const ok = confirm(
      "Only cash payments are recorded in reports. Clear this bill without saving?"
    );
    if (!ok) return;
    state.openBills = state.openBills.filter((b) => b.id !== bill.id);
    persistState();
    closeQrModal();
    renderCart();
    return;
  }

  const now = new Date();
  const billNumber = generateBillNumber(now);
  const total = calculateBillTotal(bill);

  const ctxLabel = getContextLabel();
  const record = {
    billNumber,
    dateTime: now.toISOString(),
    type: bill.type,
    refName: ctxLabel,
    total,
    items: bill.items.map((l) => ({ ...l })),
  };
  state.sales.push(record);

  // Remove open bill
  state.openBills = state.openBills.filter((b) => b.id !== bill.id);
  persistState();

  closeQrModal();
  alert(`Payment recorded. Bill #${billNumber}`);
  renderCart();
  renderReports(currentReportRange, reportSpecificDate);
  renderBillingGraph();
}

// Print

function preparePrintAreaFromCurrentBill() {
  const bill = getCurrentBill();
  if (!bill || !bill.items.length) {
    alert("No items in bill.");
    return false;
  }
  const total = calculateBillTotal(bill);
  const now = new Date();

  const billNumberText = "Pending (not yet saved)";

  const billNumberEl = $("#print-bill-number");
  const dateEl = $("#print-bill-date");
  const ctxEl = $("#print-bill-context");
  const itemsBody = $("#print-items-body");
  const totalEl = $("#print-total");

  if (!billNumberEl || !dateEl || !ctxEl || !itemsBody || !totalEl) return false;

  billNumberEl.textContent = `Bill #: ${billNumberText}`;
  dateEl.textContent = `Date: ${now.toLocaleString()}`;
  ctxEl.textContent = `Table/Type: ${getContextLabel()}`;

  itemsBody.innerHTML = "";
  bill.items.forEach((line) => {
    const row = document.createElement("tr");
    const itemTd = document.createElement("td");
    itemTd.textContent = line.name;
    const qtyTd = document.createElement("td");
    qtyTd.textContent = String(line.qty);
    const priceTd = document.createElement("td");
    priceTd.textContent = formatCurrency(line.price);
    const totalTd = document.createElement("td");
    totalTd.textContent = formatCurrency(line.price * line.qty);
    row.appendChild(itemTd);
    row.appendChild(qtyTd);
    row.appendChild(priceTd);
    row.appendChild(totalTd);
    itemsBody.appendChild(row);
  });

  totalEl.textContent = formatCurrency(total);
  return true;
}

function printCurrentBill() {
  const ok = preparePrintAreaFromCurrentBill();
  if (!ok) return;
  window.print();
}

// Admin: menu CRUD

let pendingMenuImageDataUrl = null;

function resetMenuForm() {
  $("#menu-id").value = "";
  $("#menu-name").value = "";
  $("#menu-category").value = "";
  $("#menu-price").value = "";
  $("#menu-image").value = "";
  $("#menu-active").checked = true;
  $("#menu-form-title").textContent = "Add Menu Item";
  pendingMenuImageDataUrl = null;
}

function handleMenuImageChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    pendingMenuImageDataUrl = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingMenuImageDataUrl = reader.result;
  };
  reader.readAsDataURL(file);
}

function onMenuFormSubmit(event) {
  event.preventDefault();
  const id = $("#menu-id").value;
  const name = $("#menu-name").value.trim();
  const category = $("#menu-category").value.trim();
  const priceValue = parseFloat($("#menu-price").value);
  const isActive = $("#menu-active").checked;
   const imageUrlRaw = $("#menu-image-url").value.trim();
  const imageUrl = imageUrlRaw || null;

  if (!name || isNaN(priceValue) || priceValue < 0) {
    alert("Please enter a valid name and price.");
    return;
  }

  if (id) {
    const existing = state.menuItems.find((m) => m.id === id);
    if (!existing) return;
    existing.name = name;
    existing.category = category;
    existing.price = priceValue;
    existing.isActive = isActive;
    if (imageUrl) {
      existing.imagePath = imageUrl;
    } else if (pendingMenuImageDataUrl) {
      existing.imagePath = pendingMenuImageDataUrl;
    }
  } else {
    const newItem = {
      id: generateId("menu"),
      name,
      category,
      price: priceValue,
      imagePath: imageUrl || pendingMenuImageDataUrl || "",
      isActive,
    };
    state.menuItems.push(newItem);
  }

  persistState();
  resetMenuForm();
  $("#menu-image-url").value = "";
  renderMenu();
  renderAdminMenu();
}

function editMenuItem(id) {
  const item = state.menuItems.find((m) => m.id === id);
  if (!item) return;
  $("#menu-id").value = item.id;
  $("#menu-name").value = item.name;
  $("#menu-category").value = item.category || "";
  $("#menu-price").value = item.price;
  $("#menu-active").checked = !!item.isActive;
  const imageUrlInput = $("#menu-image-url");
  if (imageUrlInput) {
    const isDataUrl = item.imagePath && item.imagePath.startsWith("data:");
    imageUrlInput.value = isDataUrl ? "" : item.imagePath || "";
  }
  $("#menu-form-title").textContent = "Edit Menu Item";
  pendingMenuImageDataUrl = null;
}

function toggleMenuItemActive(id) {
  const item = state.menuItems.find((m) => m.id === id);
  if (!item) return;
  item.isActive = !item.isActive;
  persistState();
  renderMenu();
  renderAdminMenu();
}

function renderAdminMenu() {
  const body = $("#admin-menu-body");
  if (!body) return;
  body.innerHTML = "";
  state.menuItems.forEach((item) => {
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = item.name;
    const catTd = document.createElement("td");
    catTd.textContent = item.category || "-";
    const priceTd = document.createElement("td");
    priceTd.textContent = formatCurrency(item.price);
    const activeTd = document.createElement("td");
    activeTd.textContent = item.isActive ? "Yes" : "No";
    const actionsTd = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.className = "secondary-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editMenuItem(item.id));

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "secondary-btn";
    toggleBtn.textContent = item.isActive ? "Deactivate" : "Activate";
    toggleBtn.addEventListener("click", () => toggleMenuItemActive(item.id));

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(toggleBtn);

    tr.appendChild(nameTd);
    tr.appendChild(catTd);
    tr.appendChild(priceTd);
    tr.appendChild(activeTd);
    tr.appendChild(actionsTd);
    body.appendChild(tr);
  });
}

// Admin: tables CRUD

function resetTableForm() {
  $("#table-id").value = "";
  $("#table-name").value = "";
  $("#table-active").checked = true;
  $("#table-form-title").textContent = "Add Table";
}

function onTableFormSubmit(event) {
  event.preventDefault();
  const id = $("#table-id").value;
  const name = $("#table-name").value.trim();
  const isActive = $("#table-active").checked;
  if (!name) {
    alert("Enter table name.");
    return;
  }
  if (id) {
    const existing = state.tables.find((t) => t.id === id);
    if (!existing) return;
    existing.name = name;
    existing.isActive = isActive;
  } else {
    const newTable = {
      id: generateId("table"),
      name,
      isActive,
    };
    state.tables.push(newTable);
  }
  persistState();
  resetTableForm();
  renderTables();
  renderAdminTables();
}

function getNextTableIndex() {
  let maxIndex = 0;
  state.tables.forEach((t) => {
    const match = /^T(\d+)$/.exec(t.name.trim());
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxIndex) {
        maxIndex = num;
      }
    }
  });
  return maxIndex + 1;
}

function applyTableCount() {
  const input = $("#table-count");
  if (!input) return;
  const desired = parseInt(input.value, 10);
  if (Number.isNaN(desired) || desired < 0) {
    alert("Enter a valid table count (0 or more).");
    return;
  }

  // Active auto tables T1..Tn
  const autoTables = state.tables.filter((t) => /^T\d+$/.test(t.name.trim()));
  const currentCount = autoTables.length;

  if (desired > currentCount) {
    // Add new tables
    let nextIndex = getNextTableIndex();
    const toAdd = desired - currentCount;
    for (let i = 0; i < toAdd; i += 1) {
      const name = `T${nextIndex}`;
      nextIndex += 1;
      state.tables.push({
        id: generateId("table"),
        name,
        isActive: true,
      });
    }
  } else if (desired < currentCount) {
    // Remove from highest-numbered auto tables without open bills
    const removable = autoTables
      .slice()
      .sort((a, b) => {
        const an = parseInt(a.name.slice(1), 10);
        const bn = parseInt(b.name.slice(1), 10);
        return bn - an;
      });
    let needToRemove = currentCount - desired;
    for (const table of removable) {
      if (needToRemove <= 0) break;
      const hasOpen = state.openBills.some(
        (b) => b.type === "table" && b.refId === table.id
      );
      if (hasOpen) continue;
      state.tables = state.tables.filter((t) => t.id !== table.id);
      if (
        state.ui.context &&
        state.ui.context.type === "table" &&
        state.ui.context.refId === table.id
      ) {
        state.ui.context = null;
      }
      needToRemove -= 1;
    }
  }

  persistState();
  renderTables();
  renderAdminTables();
  renderCart();
}

function editTable(id) {
  const table = state.tables.find((t) => t.id === id);
  if (!table) return;
  $("#table-id").value = table.id;
  $("#table-name").value = table.name;
  $("#table-active").checked = !!table.isActive;
  $("#table-form-title").textContent = "Edit Table";
}

function deleteTable(id) {
  const hasOpen = state.openBills.some((b) => b.type === "table" && b.refId === id);
  if (hasOpen) {
    alert("Cannot delete table with open bill.");
    return;
  }
  if (!confirm("Delete this table?")) return;
  state.tables = state.tables.filter((t) => t.id !== id);
  if (state.ui.context && state.ui.context.type === "table" && state.ui.context.refId === id) {
    state.ui.context = null;
  }
  persistState();
  renderTables();
  renderAdminTables();
  renderCart();
}

function renderAdminTables() {
  const body = $("#admin-tables-body");
  if (!body) return;
  body.innerHTML = "";
  state.tables.forEach((table) => {
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = table.name;
    const activeTd = document.createElement("td");
    activeTd.textContent = table.isActive ? "Yes" : "No";
    const actionsTd = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.className = "secondary-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editTable(table.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "secondary-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteTable(table.id));

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(nameTd);
    tr.appendChild(activeTd);
    tr.appendChild(actionsTd);
    body.appendChild(tr);
  });
}

// Reports

let currentReportRange = "today";
let reportSpecificDate = null;
let lastRenderedReports = [];

function getDateRange(rangeType, specificDate) {
  const now = specificDate ? new Date(specificDate) : new Date();
  if (rangeType === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  if (rangeType === "day") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end };
  }
  if (rangeType === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { start, end };
  }
  // today (default)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

function renderReports(rangeType = "today", specificDate = null) {
  currentReportRange = rangeType;
  if (specificDate) {
    reportSpecificDate = specificDate;
  }
  const { start, end } = getDateRange(rangeType, reportSpecificDate);

  const filtered = state.sales.filter((s) => {
    const d = new Date(s.dateTime);
    return d >= start && d < end;
  });

  lastRenderedReports = filtered.slice();

  const totalAmount = filtered.reduce((sum, s) => sum + s.total, 0);
  const billCount = filtered.length;
  const avgBill = billCount ? totalAmount / billCount : 0;

  const summaryEl = $("#reports-summary");
  if (summaryEl) {
    summaryEl.innerHTML = "";
    const cards = [
      { label: "Total Sales", value: formatCurrency(totalAmount) },
      { label: "Number of Bills", value: String(billCount) },
      { label: "Average Bill", value: formatCurrency(avgBill) },
    ];
    cards.forEach((c) => {
      const card = document.createElement("div");
      card.className = "summary-card";
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = c.label;
      const value = document.createElement("div");
      value.className = "value";
      value.textContent = c.value;
      card.appendChild(label);
      card.appendChild(value);
      summaryEl.appendChild(card);
    });
  }

  const body = $("#reports-body");
  if (body) {
    body.innerHTML = "";
    filtered
      .slice()
      .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
      .forEach((rec) => {
        const tr = document.createElement("tr");
        const billTd = document.createElement("td");
        billTd.textContent = rec.billNumber;
        const dateTd = document.createElement("td");
        dateTd.textContent = new Date(rec.dateTime).toLocaleString();
        const typeTd = document.createElement("td");
        typeTd.textContent = rec.type === "table" ? "Table" : "Takeaway";
        const refTd = document.createElement("td");
        refTd.textContent = rec.refName;
        const totalTd = document.createElement("td");
        totalTd.textContent = formatCurrency(rec.total);
        const actionsTd = document.createElement("td");

        const viewBtn = document.createElement("button");
        viewBtn.className = "secondary-btn";
        viewBtn.textContent = "View";
        viewBtn.addEventListener("click", () =>
          openReportDetailModal(rec.billNumber)
        );

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "secondary-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () =>
          deleteReportRecord(rec.billNumber)
        );

        actionsTd.appendChild(viewBtn);
        actionsTd.appendChild(deleteBtn);
        tr.appendChild(billTd);
        tr.appendChild(dateTd);
        tr.appendChild(typeTd);
        tr.appendChild(refTd);
        tr.appendChild(totalTd);
        tr.appendChild(actionsTd);
        body.appendChild(tr);
      });
  }

  // Highlight active filter button
  $all(".report-filter-btn").forEach((btn) => {
    const range = btn.getAttribute("data-range");
    btn.classList.toggle("active", range === rangeType);
  });

  const dateInput = $("#report-date");
  if (dateInput && rangeType === "day" && reportSpecificDate) {
    dateInput.value = reportSpecificDate;
  }
}

function openReportDetailModal(billNumber) {
  const rec = state.sales.find((s) => s.billNumber === billNumber);
  if (!rec) return;
  const billNumberEl = $("#detail-bill-number");
  const dateEl = $("#detail-bill-date");
  const ctxEl = $("#detail-bill-context");
  const itemsBody = $("#detail-items-body");
  const totalEl = $("#detail-total");
  if (!billNumberEl || !dateEl || !ctxEl || !itemsBody || !totalEl) return;

  billNumberEl.textContent = `Bill #: ${rec.billNumber}`;
  dateEl.textContent = `Date: ${new Date(rec.dateTime).toLocaleString()}`;
  ctxEl.textContent = `Table/Type: ${
    rec.type === "table" ? rec.refName : "Takeaway"
  }`;

  itemsBody.innerHTML = "";
  rec.items.forEach((line) => {
    const row = document.createElement("tr");
    const itemTd = document.createElement("td");
    itemTd.textContent = line.name;
    const qtyTd = document.createElement("td");
    qtyTd.textContent = String(line.qty);
    const priceTd = document.createElement("td");
    priceTd.textContent = formatCurrency(line.price);
    const totalTd = document.createElement("td");
    totalTd.textContent = formatCurrency(line.price * line.qty);
    row.appendChild(itemTd);
    row.appendChild(qtyTd);
    row.appendChild(priceTd);
    row.appendChild(totalTd);
    itemsBody.appendChild(row);
  });

  totalEl.textContent = formatCurrency(rec.total);

  const modal = $("#report-detail-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeReportDetailModal() {
  const modal = $("#report-detail-modal");
  if (modal) modal.classList.add("hidden");
}

function deleteReportRecord(billNumber) {
  const rec = state.sales.find((s) => s.billNumber === billNumber);
  if (!rec) return;
  const ok = confirm(`Delete bill ${billNumber} from reports?`);
  if (!ok) return;
  state.sales = state.sales.filter((s) => s.billNumber !== billNumber);
  persistState();
  renderReports(currentReportRange, reportSpecificDate);
  renderBillingGraph();
}

// Navigation

function setupNavigation() {
  $all(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewId = btn.getAttribute("data-view");
      if (!viewId) return;
      $all(".view").forEach((v) => v.classList.remove("active"));
      const target = document.getElementById(viewId);
      if (target) target.classList.add("active");
      $all(".nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  const takeawayBtn = $("#takeaway-btn");
  if (takeawayBtn) {
    takeawayBtn.addEventListener("click", () => {
      state.ui.context = { type: "takeaway", refId: "takeaway" };
      renderTables();
      renderCart();
    });
  }
}

function setupBillingActions() {
  const clearBtn = $("#clear-cart-btn");
  const payNowBtn = $("#pay-now-btn");
  const printBtn = $("#print-bill-btn");
  const qrCloseBtn = $("#qr-close-btn");
  const qrPaidBtn = $("#qr-paid-btn");

  if (clearBtn) clearBtn.addEventListener("click", clearCurrentCart);
  if (payNowBtn) payNowBtn.addEventListener("click", openQrModal);
  if (printBtn) printBtn.addEventListener("click", printCurrentBill);
  if (qrCloseBtn) qrCloseBtn.addEventListener("click", closeQrModal);
  if (qrPaidBtn) qrPaidBtn.addEventListener("click", markCurrentBillPaid);
}

function setupAdminForms() {
  const menuForm = $("#menu-form");
  const menuReset = $("#menu-reset-btn");
  const menuImage = $("#menu-image");
  const tableForm = $("#table-form");
  const tableReset = $("#table-reset-btn");
  const tableCountBtn = $("#table-count-btn");

  if (menuForm) menuForm.addEventListener("submit", onMenuFormSubmit);
  if (menuReset) menuReset.addEventListener("click", resetMenuForm);
  if (menuImage) menuImage.addEventListener("change", handleMenuImageChange);
  if (tableForm) tableForm.addEventListener("submit", onTableFormSubmit);
  if (tableReset) tableReset.addEventListener("click", resetTableForm);
  if (tableCountBtn) tableCountBtn.addEventListener("click", applyTableCount);
}

function setupReportFilters() {
  $all(".report-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const range = btn.getAttribute("data-range") || "today";
      renderReports(range, null);
      if (range !== "day") {
        reportSpecificDate = null;
        const dateInput = $("#report-date");
        if (dateInput) dateInput.value = "";
      }
    });
  });

  const detailCloseBtn = $("#detail-close-btn");
  if (detailCloseBtn) {
    detailCloseBtn.addEventListener("click", closeReportDetailModal);
  }

  const dateBtn = $("#report-date-btn");
  if (dateBtn) {
    dateBtn.addEventListener("click", () => {
      const input = $("#report-date");
      if (!input || !input.value) {
        alert("Select a date to view reports.");
        return;
      }
      reportSpecificDate = input.value;
      renderReports("day", reportSpecificDate);
    });
  }

  const exportBtn = $("#export-report-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportCurrentReportCsv);
  }
}

function exportCurrentReportCsv() {
  if (!lastRenderedReports.length) {
    alert("No data in the current report to export.");
    return;
  }

  const rows = [];
  rows.push(["BillNumber", "DateTime", "Type", "TableOrRef", "Total"]);
  lastRenderedReports.forEach((rec) => {
    rows.push([
      rec.billNumber,
      new Date(rec.dateTime).toISOString(),
      rec.type === "table" ? "Table" : "Takeaway",
      rec.refName,
      rec.total.toFixed(2),
    ]);
  });

  const csvContent = rows
    .map((cols) =>
      cols
        .map((c) => {
          const s = String(c ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const fileName = `velan-report-${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.csv`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Billing graph (last 7 days) on billing view

function getSalesByDateLastNDays(days) {
  const now = new Date();
  const map = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - i
    );
    const key = d.toISOString().slice(0, 10);
    map.set(key, 0);
  }
  state.sales.forEach((rec) => {
    const d = new Date(rec.dateTime);
    const key = d.toISOString().slice(0, 10);
    if (map.has(key)) {
      map.set(key, map.get(key) + rec.total);
    }
  });
  return Array.from(map.entries()).map(([date, total]) => ({
    date,
    total,
  }));
}

function renderBillingGraph() {
  // Graph removed from billing homepage (no-op)
}

// Init

function init() {
  loadState();
  setupNavigation();
  setupBillingActions();
  setupAdminForms();
  setupReportFilters();

  renderTables();
  renderMenu();
  renderCart();
  renderAdminMenu();
  renderAdminTables();
  renderReports("today");
   renderBillingGraph();
}

document.addEventListener("DOMContentLoaded", init);

