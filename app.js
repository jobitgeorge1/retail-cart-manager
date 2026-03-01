import { account, client, databases, APPWRITE_CONFIG, isConfigured, makeUserDocumentId, Query, userPermissions } from "./appwrite-client.js";

const STORAGE_KEY = "simple-price-cart-v1";

const state = loadState();
let isApplyingRemoteState = false;
let cloudSaveTimer = null;
let realtimeUnsubscribe = null;
let currentUser = null;

const userEmail = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const syncStatus = document.getElementById("syncStatus");

const menuPriceList = document.getElementById("menuPriceList");
const menuCart = document.getElementById("menuCart");
const viewPriceList = document.getElementById("viewPriceList");
const viewCart = document.getElementById("viewCart");

const newItemName = document.getElementById("newItemName");
const newItemSize = document.getElementById("newItemSize");
const newItemPrice = document.getElementById("newItemPrice");
const addPriceItemBtn = document.getElementById("addPriceItemBtn");

const priceListBody = document.getElementById("priceListBody");
const priceListEmpty = document.getElementById("priceListEmpty");

const cartRows = document.getElementById("cartRows");
const addCartRowBtn = document.getElementById("addCartRowBtn");
const cartTotal = document.getElementById("cartTotal");

const quickItemName = document.getElementById("quickItemName");
const quickItemSize = document.getElementById("quickItemSize");
const quickItemPrice = document.getElementById("quickItemPrice");
const quickAddBtn = document.getElementById("quickAddBtn");
const quickAddModal = document.getElementById("quickAddModal");
const quickAddCancelBtn = document.getElementById("quickAddCancelBtn");

let pendingQuickAddRowIndex = null;

document.addEventListener("click", (e) => {
  if (!e.target.closest(".combo") && !e.target.closest(".modal-card")) {
    closeAllCombos();
  }
});

menuPriceList.addEventListener("click", () => switchView("priceList"));
menuCart.addEventListener("click", () => switchView("cart"));
logoutBtn.addEventListener("click", logout);

addPriceItemBtn.addEventListener("click", () => {
  addPriceListItem(newItemName.value, newItemSize.value, parseFloat(newItemPrice.value));
  newItemName.value = "";
  newItemSize.value = "";
  newItemPrice.value = "";
  newItemName.focus();
});

addCartRowBtn.addEventListener("click", () => {
  state.cart.push({ itemId: "", quantity: 1 });
  saveState();
  renderCart();
});

quickAddBtn.addEventListener("click", () => {
  const item = addPriceListItem(quickItemName.value, quickItemSize.value, parseFloat(quickItemPrice.value));
  if (!item) return;

  let focusQtyIndex = null;
  if (pendingQuickAddRowIndex !== null && state.cart[pendingQuickAddRowIndex]) {
    state.cart[pendingQuickAddRowIndex].itemId = item.id;
    focusQtyIndex = pendingQuickAddRowIndex;
  } else {
    const firstEmptyRow = state.cart.find((row) => !row.itemId);
    if (firstEmptyRow) {
      firstEmptyRow.itemId = item.id;
      focusQtyIndex = state.cart.indexOf(firstEmptyRow);
    } else {
      state.cart.push({ itemId: item.id, quantity: 1 });
      focusQtyIndex = state.cart.length - 1;
    }
  }
  saveState();
  closeQuickAddModal();
  renderCart();
  focusRowQuantityInput(focusQtyIndex);
});
quickAddCancelBtn.addEventListener("click", closeQuickAddModal);
quickAddModal.addEventListener("click", (e) => {
  if (e.target === quickAddModal) closeQuickAddModal();
});

function setStatus(text) {
  syncStatus.textContent = text;
}

function switchView(view) {
  const isPriceList = view === "priceList";
  menuPriceList.classList.toggle("active", isPriceList);
  menuCart.classList.toggle("active", !isPriceList);
  viewPriceList.classList.toggle("hidden", !isPriceList);
  viewCart.classList.toggle("hidden", isPriceList);
}

function addPriceListItem(name, size, price) {
  const cleanedName = String(name || "").trim();
  const cleanedSize = String(size || "").trim();
  if (!cleanedName) {
    alert("Please enter item name.");
    return null;
  }
  if (!cleanedSize) {
    alert("Please enter item size.");
    return null;
  }
  if (Number.isNaN(price) || price < 0) {
    alert("Please enter a valid price.");
    return null;
  }

  const exists = state.priceList.some((item) =>
    item.name.toLowerCase() === cleanedName.toLowerCase() &&
    String(item.size || "").toLowerCase() === cleanedSize.toLowerCase()
  );
  if (exists) {
    alert("Item with the same size already exists in price list.");
    return null;
  }

  const item = {
    id: crypto.randomUUID(),
    name: cleanedName,
    size: cleanedSize,
    price: roundMoney(price)
  };

  state.priceList.push(item);
  saveState();
  renderPriceList();
  renderCart();
  return item;
}

function openQuickAddModal(searchText, rowIndex) {
  pendingQuickAddRowIndex = rowIndex;
  const text = String(searchText || "").trim();
  const split = text.split("-").map((x) => x.trim()).filter(Boolean);

  quickItemName.value = split[0] || text || "";
  quickItemSize.value = split.length > 1 ? split.slice(1).join(" - ") : "";
  quickItemPrice.value = "";

  quickAddModal.classList.remove("hidden");
  if (quickItemName.value) quickItemSize.focus();
  else quickItemName.focus();
}

function closeQuickAddModal() {
  quickAddModal.classList.add("hidden");
  quickItemName.value = "";
  quickItemSize.value = "";
  quickItemPrice.value = "";
  pendingQuickAddRowIndex = null;
}

function renderPriceList() {
  priceListBody.innerHTML = "";

  if (!state.priceList.length) {
    priceListEmpty.style.display = "block";
    return;
  }

  priceListEmpty.style.display = "none";

  state.priceList.forEach((item) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = item.name;

    const tdSize = document.createElement("td");
    const sizeInput = document.createElement("input");
    sizeInput.type = "text";
    sizeInput.value = item.size || "";
    sizeInput.placeholder = "Size";
    sizeInput.addEventListener("change", (e) => {
      const nextSize = String(e.target.value || "").trim();
      if (!nextSize) {
        e.target.value = item.size || "";
        return;
      }
      const duplicate = state.priceList.some((x) =>
        x.id !== item.id &&
        x.name.toLowerCase() === item.name.toLowerCase() &&
        String(x.size || "").toLowerCase() === nextSize.toLowerCase()
      );
      if (duplicate) {
        alert("Another item with same name and size already exists.");
        e.target.value = item.size || "";
        return;
      }
      item.size = nextSize;
      saveState();
      renderCart();
    });
    tdSize.appendChild(sizeInput);

    const tdPrice = document.createElement("td");
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.value = item.price.toFixed(2);
    priceInput.addEventListener("change", (e) => {
      const nextPrice = parseFloat(e.target.value);
      if (Number.isNaN(nextPrice) || nextPrice < 0) {
        e.target.value = item.price.toFixed(2);
        return;
      }
      item.price = roundMoney(nextPrice);
      saveState();
      renderCart();
    });
    tdPrice.appendChild(priceInput);

    const tdActions = document.createElement("td");
    const removeBtn = document.createElement("button");
    removeBtn.className = "danger";
    removeBtn.textContent = "Delete";
    removeBtn.addEventListener("click", () => {
      state.priceList = state.priceList.filter((x) => x.id !== item.id);
      state.cart = state.cart.map((row) => row.itemId === item.id ? { ...row, itemId: "" } : row);
      saveState();
      renderPriceList();
      renderCart();
    });

    tdActions.appendChild(removeBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdSize);
    tr.appendChild(tdPrice);
    tr.appendChild(tdActions);
    priceListBody.appendChild(tr);
  });
}

function renderCart() {
  cartRows.innerHTML = "";

  if (!state.cart.length) {
    state.cart.push({ itemId: "", quantity: 1 });
  }

  state.cart.forEach((row, index) => {
    const container = document.createElement("div");
    container.className = "cart-row";

    const combo = document.createElement("div");
    combo.className = "combo";
    const control = document.createElement("div");
    control.className = "combo-control";

    const itemInput = document.createElement("input");
    itemInput.type = "text";
    itemInput.className = "combo-input";
    itemInput.dataset.rowIndex = String(index);
    itemInput.placeholder = state.priceList.length ? "Search or select item..." : "No items in price list";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "combo-toggle";
    toggleBtn.textContent = "▾";

    const menu = document.createElement("div");
    menu.className = "combo-menu hidden";

    const renderOptions = (queryOverride) => {
      const query = typeof queryOverride === "string"
        ? queryOverride
        : String(itemInput.value || "").trim().toLowerCase();
      const filtered = state.priceList.filter((item) => getItemLabel(item).toLowerCase().includes(query));

      menu.innerHTML = "";
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "combo-empty";
        empty.textContent = "No matching items";
        menu.appendChild(empty);

        const query = String(itemInput.value || "").trim();
        if (query) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "combo-option";
          addBtn.textContent = `+ Add "${query}"`;
          addBtn.addEventListener("click", () => {
            menu.classList.add("hidden");
            openQuickAddModal(query, index);
          });
          menu.appendChild(addBtn);
        }
        return;
      }

      filtered.forEach((item) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "combo-option";
        option.textContent = `${getItemLabel(item)}  ($${item.price.toFixed(2)})`;
        option.addEventListener("click", () => {
          row.itemId = item.id;
          itemInput.value = getItemLabel(item);
          saveState();
          updateCartTotal();
          menu.classList.add("hidden");
        });
        menu.appendChild(option);
      });
    };

    const openMenu = (showAll = false) => {
      closeAllCombos();
      renderOptions(showAll ? "" : undefined);
      menu.classList.remove("hidden");
    };

    const selectedItem = state.priceList.find((item) => item.id === row.itemId);
    itemInput.value = selectedItem ? getItemLabel(selectedItem) : "";

    itemInput.addEventListener("input", (e) => {
      const typed = String(e.target.value || "").trim().toLowerCase();
      const match = state.priceList.find((item) => getItemLabel(item).toLowerCase() === typed);
      row.itemId = match ? match.id : "";
      saveState();
      updateCartTotal();
      openMenu();
    });
    itemInput.addEventListener("focus", openMenu);
    itemInput.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openMenu(true);
        return;
      }
      if (e.key !== "Enter") return;

      e.preventDefault();
      const typedRaw = String(itemInput.value || "").trim();
      const typed = typedRaw.toLowerCase();
      const exact = state.priceList.find((item) => getItemLabel(item).toLowerCase() === typed);
      if (exact) {
        row.itemId = exact.id;
        itemInput.value = getItemLabel(exact);
        saveState();
        updateCartTotal();
        menu.classList.add("hidden");
        focusRowQuantityInput(index);
        return;
      }

      const filtered = state.priceList.filter((item) => getItemLabel(item).toLowerCase().includes(typed));
      if (!filtered.length && typedRaw) {
        menu.classList.add("hidden");
        openQuickAddModal(typedRaw, index);
      }
    });
    toggleBtn.addEventListener("click", () => {
      if (menu.classList.contains("hidden")) openMenu(true);
      else menu.classList.add("hidden");
    });

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.dataset.rowIndex = String(index);
    qtyInput.min = "1";
    qtyInput.step = "1";
    qtyInput.value = String(row.quantity || 1);
    qtyInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      row.quantity = Number.isNaN(val) || val < 1 ? 1 : val;
      saveState();
      updateCartTotal();
    });
    qtyInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      const val = parseInt(qtyInput.value, 10);
      row.quantity = Number.isNaN(val) || val < 1 ? 1 : val;
      saveState();
      updateCartTotal();

      const nextIndex = index + 1;
      if (!state.cart[nextIndex]) {
        state.cart.push({ itemId: "", quantity: 1 });
        saveState();
        renderCart();
      }
      focusRowItemInput(nextIndex);
    });

    const lineTotal = document.createElement("div");
    lineTotal.className = "muted";

    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      state.cart.splice(index, 1);
      saveState();
      renderCart();
    });

    control.appendChild(itemInput);
    control.appendChild(toggleBtn);
    combo.appendChild(control);
    combo.appendChild(menu);

    container.appendChild(combo);
    container.appendChild(qtyInput);
    container.appendChild(lineTotal);
    container.appendChild(removeBtn);
    cartRows.appendChild(container);

    updateLineTotal(lineTotal, row);
  });

  updateCartTotal();
}

function closeAllCombos() {
  cartRows.querySelectorAll(".combo-menu").forEach((menu) => menu.classList.add("hidden"));
}

function focusRowItemInput(index) {
  if (index === null || index === undefined) return;
  const input = cartRows.querySelector(`.combo-input[data-row-index="${index}"]`);
  if (input) input.focus();
}

function focusRowQuantityInput(index) {
  if (index === null || index === undefined) return;
  const input = cartRows.querySelector(`input[type="number"][data-row-index="${index}"]`);
  if (input) input.focus();
}

function getItemLabel(item) {
  const name = String(item?.name || "").trim();
  const size = String(item?.size || "").trim();
  return size ? `${name} - ${size}` : name;
}

function updateLineTotal(node, row) {
  const item = state.priceList.find((x) => x.id === row.itemId);
  if (!item) {
    node.textContent = "Line Total: $0.00";
    return 0;
  }
  const total = roundMoney((row.quantity || 1) * item.price);
  node.textContent = `Line Total: $${total.toFixed(2)}`;
  return total;
}

function updateCartTotal() {
  let total = 0;
  const nodes = cartRows.querySelectorAll(".cart-row .muted");
  state.cart.forEach((row, idx) => {
    total += updateLineTotal(nodes[idx], row);
  });
  cartTotal.textContent = roundMoney(total).toFixed(2);
}

function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { priceList: [], cart: [] };
    const parsed = JSON.parse(raw);
    return {
      priceList: Array.isArray(parsed.priceList)
        ? parsed.priceList.map((item) => ({ ...item, size: String(item.size || "").trim() }))
        : [],
      cart: Array.isArray(parsed.cart) ? parsed.cart : []
    };
  } catch {
    return { priceList: [], cart: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSave();
}

function applyRemotePayload(payloadText) {
  try {
    const data = JSON.parse(payloadText);
    if (!data || !Array.isArray(data.priceList) || !Array.isArray(data.cart)) return;

    isApplyingRemoteState = true;
    state.priceList.length = 0;
    state.cart.length = 0;
    data.priceList.forEach((item) => {
      state.priceList.push({
        id: String(item.id || crypto.randomUUID()),
        name: String(item.name || "").trim(),
        size: String(item.size || "").trim(),
        price: roundMoney(Number(item.price || 0))
      });
    });
    data.cart.forEach((row) => {
      state.cart.push({
        itemId: String(row.itemId || ""),
        quantity: Math.max(1, parseInt(row.quantity, 10) || 1)
      });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderPriceList();
    renderCart();
    isApplyingRemoteState = false;
  } catch {
    // Ignore invalid payload.
  }
}

function queueCloudSave() {
  if (!currentUser || isApplyingRemoteState) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    saveToCloud(currentUser.$id).catch(() => {
      setStatus("Cloud save failed. Changes are local only.");
    });
  }, 300);
}

function serializeState() {
  return JSON.stringify({ priceList: state.priceList, cart: state.cart });
}

async function connectUserSync(userId) {
  const documentId = makeUserDocumentId(userId);

  const list = await databases.listDocuments(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collectionId,
    [Query.equal("$id", documentId), Query.limit(1)]
  );
  const existing = list.documents?.[0] || null;

  if (existing && typeof existing.payload === "string") {
    applyRemotePayload(existing.payload);
    saveState();
  } else {
    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collectionId,
      documentId,
      { payload: serializeState() },
      userPermissions(userId)
    );
  }

  if (realtimeUnsubscribe) realtimeUnsubscribe();
  realtimeUnsubscribe = client.subscribe(
    `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collectionId}.documents.${documentId}`,
    (event) => {
      const payload = event?.payload?.payload;
      if (typeof payload === "string") applyRemotePayload(payload);
    }
  );
}

async function saveToCloud(userId) {
  const documentId = makeUserDocumentId(userId);
  const data = { payload: serializeState() };

  try {
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collectionId,
      documentId,
      data
    );
  } catch {
    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collectionId,
      documentId,
      data,
      userPermissions(userId)
    );
  }
}

async function logout() {
  try {
    await account.deleteSession("current");
  } catch {
    // Ignore.
  }
  window.location.href = "./login.html";
}

async function init() {
  closeQuickAddModal();
  renderPriceList();
  renderCart();

  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    return;
  }

  try {
    currentUser = await account.get();
    userEmail.textContent = currentUser.email;
    setStatus("Connecting cloud sync...");
    await connectUserSync(currentUser.$id);
    setStatus("Cloud sync connected.");
  } catch {
    window.location.href = "./login.html";
  }
}

init();
