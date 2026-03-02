import { account, client, databases, APPWRITE_CONFIG, isConfigured, makeUserDocumentId, Query, userPermissions } from "./appwrite-client.js";

const STORAGE_KEY_PREFIX = "personal-cart-manager-v1";

const state = createDefaultState();
let isApplyingRemoteState = false;
let cloudSaveTimer = null;
let realtimeUnsubscribe = null;
let currentUser = null;
let editingItemId = null;
let pendingQuickAddRowIndex = null;
let newCartEditingId = null;

const userName = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");
const syncStatus = document.getElementById("syncStatus");

const menuPriceList = document.getElementById("menuPriceList");
const cartTabs = document.getElementById("cartTabs");
const addCartTabBtn = document.getElementById("addCartTabBtn");
const viewPriceList = document.getElementById("viewPriceList");
const viewCart = document.getElementById("viewCart");

const newItemName = document.getElementById("newItemName");
const newItemBrand = document.getElementById("newItemBrand");
const newItemStore = document.getElementById("newItemStore");
const newItemSize = document.getElementById("newItemSize");
const newItemPrice = document.getElementById("newItemPrice");
const addPriceItemBtn = document.getElementById("addPriceItemBtn");

const priceListBody = document.getElementById("priceListBody");
const priceListEmpty = document.getElementById("priceListEmpty");

const cartRows = document.getElementById("cartRows");
const addCartRowBtn = document.getElementById("addCartRowBtn");
const cartTotal = document.getElementById("cartTotal");

const quickItemName = document.getElementById("quickItemName");
const quickItemBrand = document.getElementById("quickItemBrand");
const quickItemStore = document.getElementById("quickItemStore");
const quickItemSize = document.getElementById("quickItemSize");
const quickItemPrice = document.getElementById("quickItemPrice");
const quickAddBtn = document.getElementById("quickAddBtn");
const quickAddModal = document.getElementById("quickAddModal");
const quickAddCancelBtn = document.getElementById("quickAddCancelBtn");

document.addEventListener("click", (e) => {
  if (!e.target.closest(".combo") && !e.target.closest(".modal-card")) {
    closeAllCombos();
  }
});

menuPriceList.addEventListener("click", () => switchView("priceList"));
logoutBtn.addEventListener("click", logout);
addCartTabBtn.addEventListener("click", () => {
  const cart = { id: crypto.randomUUID(), name: `New Cart`, items: [] };
  state.carts.push(cart);
  state.activeCartId = cart.id;
  newCartEditingId = cart.id;
  saveState();
  renderCartTabs();
  renderCart();
  switchView("cart");

  const input = cartTabs.querySelector(`.tab[data-cart-id="${cart.id}"] input`);
  if (input) {
    input.focus();
    input.select();
  }
});

addPriceItemBtn.addEventListener("click", () => {
  addPriceListItem(
    newItemName.value,
    newItemSize.value,
    parseFloat(newItemPrice.value),
    newItemBrand.value,
    newItemStore.value
  );
  newItemName.value = "";
  newItemBrand.value = "";
  newItemStore.value = "";
  newItemSize.value = "";
  newItemPrice.value = "";
  newItemName.focus();
});

addCartRowBtn.addEventListener("click", () => {
  const active = getActiveCart();
  active.items.push({ itemId: "", quantity: 1 });
  saveState();
  renderCart();
  focusRowItemInput(active.items.length - 1);
});

quickAddBtn.addEventListener("click", () => {
  const item = addPriceListItem(
    quickItemName.value,
    quickItemSize.value,
    parseFloat(quickItemPrice.value),
    quickItemBrand.value,
    quickItemStore.value
  );
  if (!item) return;

  const active = getActiveCart();
  let focusQtyIndex = null;

  if (pendingQuickAddRowIndex !== null && active.items[pendingQuickAddRowIndex]) {
    active.items[pendingQuickAddRowIndex].itemId = item.id;
    focusQtyIndex = pendingQuickAddRowIndex;
  } else {
    const firstEmpty = active.items.find((row) => !row.itemId);
    if (firstEmpty) {
      firstEmpty.itemId = item.id;
      focusQtyIndex = active.items.indexOf(firstEmpty);
    } else {
      active.items.push({ itemId: item.id, quantity: 1 });
      focusQtyIndex = active.items.length - 1;
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

function createDefaultState() {
  const defaultId = crypto.randomUUID();
  return {
    priceList: [],
    carts: [{ id: defaultId, name: "Default Cart", items: [] }],
    activeCartId: defaultId
  };
}

function getStorageKeyForUser(userId) {
  return `${STORAGE_KEY_PREFIX}-${userId}`;
}

function setStateFrom(nextState) {
  state.priceList.length = 0;
  state.carts.length = 0;

  nextState.priceList.forEach((item) => {
    state.priceList.push({
      ...item,
      brand: String(item.brand || "").trim(),
      store: String(item.store || "").trim(),
      size: String(item.size || "").trim()
    });
  });

  nextState.carts.forEach((cart, idx) => {
    state.carts.push({
      id: String(cart.id || crypto.randomUUID()),
      name: String(cart.name || `Cart ${idx + 1}`).trim() || `Cart ${idx + 1}`,
      items: Array.isArray(cart.items) ? cart.items.map((row) => ({
        itemId: String(row.itemId || ""),
        quantity: Math.max(1, parseInt(row.quantity, 10) || 1)
      })) : []
    });
  });

  state.activeCartId = nextState.activeCartId;
  ensureCarts();
}

function switchView(view) {
  const isPriceList = view === "priceList";
  menuPriceList.classList.toggle("active", isPriceList);
  viewPriceList.classList.toggle("hidden", !isPriceList);
  viewCart.classList.toggle("hidden", isPriceList);
  renderCartTabs();
}

function ensureCarts() {
  if (!Array.isArray(state.carts)) state.carts = [];
  state.carts = state.carts.map((cart, idx) => ({
    id: String(cart.id || crypto.randomUUID()),
    name: String(cart.name || `Cart ${idx + 1}`).trim() || `Cart ${idx + 1}`,
    items: Array.isArray(cart.items) ? cart.items : []
  }));

  if (!state.carts.length) {
    state.carts.push({ id: crypto.randomUUID(), name: "Default Cart", items: [] });
  }

  const exists = state.carts.some((c) => c.id === state.activeCartId);
  if (!exists) state.activeCartId = state.carts[0].id;
}

function getActiveCart() {
  ensureCarts();
  let active = state.carts.find((c) => c.id === state.activeCartId);
  if (!active) {
    state.activeCartId = state.carts[0].id;
    active = state.carts[0];
  }
  if (!Array.isArray(active.items)) active.items = [];
  return active;
}

function renderCartManager() {
  renderCartTabs();
}

function removeCartById(cartId) {
  if (state.carts.length <= 1) {
    alert("At least one cart is required.");
    return;
  }
  const target = state.carts.find((c) => c.id === cartId);
  if (!target) return;

  const ok = confirm(`Delete cart "${target.name}"?`);
  if (!ok) return;

  state.carts = state.carts.filter((c) => c.id !== cartId);
  if (newCartEditingId === cartId) newCartEditingId = null;
  if (state.activeCartId === cartId) {
    state.activeCartId = state.carts[0]?.id || "";
  }
  saveState();
  renderCartTabs();
  renderCart();
}

function renderCartTabs() {
  ensureCarts();
  cartTabs.innerHTML = "";
  const onPriceList = !viewPriceList.classList.contains("hidden");

  state.carts.forEach((cart) => {
    const tabWrap = document.createElement("div");
    tabWrap.className = "tab";
    tabWrap.dataset.cartId = cart.id;
    if (!onPriceList && cart.id === state.activeCartId) {
      tabWrap.classList.add("active");
    }
    tabWrap.addEventListener("click", () => {
      state.activeCartId = cart.id;
      saveState();
      switchView("cart");
      renderCart();
    });

    if (newCartEditingId === cart.id) {
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.value = cart.name;
      titleInput.addEventListener("click", (e) => e.stopPropagation());
      const finalize = () => {
        const next = String(titleInput.value || "").trim() || `Cart ${state.carts.length}`;
        cart.name = next;
        newCartEditingId = null;
        saveState();
        renderCartTabs();
      };
      titleInput.addEventListener("blur", finalize);
      titleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finalize();
        } else if (e.key === "Escape") {
          e.preventDefault();
          newCartEditingId = null;
          renderCartTabs();
        }
      });
      tabWrap.appendChild(titleInput);
    } else {
      const title = document.createElement("span");
      title.className = "tab-title";
      title.textContent = cart.name;
      tabWrap.appendChild(title);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "close-btn";
    removeBtn.textContent = "×";
    removeBtn.title = `Delete ${cart.name}`;
    removeBtn.disabled = state.carts.length <= 1;
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeCartById(cart.id);
    });
    tabWrap.appendChild(removeBtn);
    cartTabs.appendChild(tabWrap);
  });
}

function addPriceListItem(name, size, price, brand = "", store = "") {
  const cleanedName = String(name || "").trim();
  const cleanedSize = String(size || "").trim();
  const cleanedBrand = String(brand || "").trim();
  const cleanedStore = String(store || "").trim();

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

  const exists = state.priceList.some((item) => isDuplicateByIdentity(item, {
    name: cleanedName,
    size: cleanedSize,
    brand: cleanedBrand,
    store: cleanedStore
  }));
  if (exists) {
    alert("Item with same name, size, brand and store already exists.");
    return null;
  }

  const item = {
    id: crypto.randomUUID(),
    name: cleanedName,
    brand: cleanedBrand,
    store: cleanedStore,
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
  quickItemBrand.value = "";
  quickItemStore.value = "";
  quickItemSize.value = split.length > 1 ? split.slice(1).join(" - ") : "";
  quickItemPrice.value = "";

  quickAddModal.classList.remove("hidden");
  if (quickItemName.value) quickItemSize.focus();
  else quickItemName.focus();
}

function closeQuickAddModal() {
  quickAddModal.classList.add("hidden");
  quickItemName.value = "";
  quickItemBrand.value = "";
  quickItemStore.value = "";
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
    const isEditing = editingItemId === item.id;

    const tdName = document.createElement("td");
    const tdBrand = document.createElement("td");
    const tdStore = document.createElement("td");
    const tdSize = document.createElement("td");
    const tdPrice = document.createElement("td");

    if (isEditing) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item.name || "";

      const brandInput = document.createElement("input");
      brandInput.type = "text";
      brandInput.value = item.brand || "";

      const storeInput = document.createElement("input");
      storeInput.type = "text";
      storeInput.value = item.store || "";

      const sizeInput = document.createElement("input");
      sizeInput.type = "text";
      sizeInput.value = item.size || "";

      const priceInput = document.createElement("input");
      priceInput.type = "number";
      priceInput.min = "0";
      priceInput.step = "0.01";
      priceInput.value = Number(item.price || 0).toFixed(2);

      tdName.appendChild(nameInput);
      tdBrand.appendChild(brandInput);
      tdStore.appendChild(storeInput);
      tdSize.appendChild(sizeInput);
      tdPrice.appendChild(priceInput);

      tr._editFields = { nameInput, brandInput, storeInput, sizeInput, priceInput };
    } else {
      tdName.textContent = item.name;
      tdBrand.textContent = item.brand || "-";
      tdStore.textContent = item.store || "-";
      tdSize.textContent = item.size;
      tdPrice.textContent = `$${Number(item.price || 0).toFixed(2)}`;
    }

    const tdActions = document.createElement("td");
    tdActions.className = "actions-inline";

    if (isEditing) {
      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", () => {
        const fields = tr._editFields;
        const nextName = String(fields.nameInput.value || "").trim();
        const nextBrand = String(fields.brandInput.value || "").trim();
        const nextStore = String(fields.storeInput.value || "").trim();
        const nextSize = String(fields.sizeInput.value || "").trim();
        const nextPrice = parseFloat(fields.priceInput.value);

        if (!nextName) {
          alert("Please enter item name.");
          return;
        }
        if (!nextSize) {
          alert("Please enter item size.");
          return;
        }
        if (Number.isNaN(nextPrice) || nextPrice < 0) {
          alert("Please enter a valid price.");
          return;
        }

        const duplicate = state.priceList.some((x) =>
          x.id !== item.id && isDuplicateByIdentity(x, {
            name: nextName,
            size: nextSize,
            brand: nextBrand,
            store: nextStore
          })
        );
        if (duplicate) {
          alert("Another item with same identity already exists.");
          return;
        }

        item.name = nextName;
        item.brand = nextBrand;
        item.store = nextStore;
        item.size = nextSize;
        item.price = roundMoney(nextPrice);

        editingItemId = null;
        saveState();
        renderPriceList();
        renderCart();
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "secondary";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        editingItemId = null;
        renderPriceList();
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "danger";
      removeBtn.textContent = "Delete";
      removeBtn.addEventListener("click", () => {
        deletePriceItem(item.id);
      });

      tdActions.appendChild(saveBtn);
      tdActions.appendChild(cancelBtn);
      tdActions.appendChild(removeBtn);
    } else {
      const editBtn = document.createElement("button");
      editBtn.className = "secondary";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        editingItemId = item.id;
        renderPriceList();
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "danger";
      removeBtn.textContent = "Delete";
      removeBtn.addEventListener("click", () => {
        deletePriceItem(item.id);
      });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(removeBtn);
    }

    tr.appendChild(tdName);
    tr.appendChild(tdBrand);
    tr.appendChild(tdStore);
    tr.appendChild(tdSize);
    tr.appendChild(tdPrice);
    tr.appendChild(tdActions);
    priceListBody.appendChild(tr);
  });
}

function deletePriceItem(itemId) {
  state.priceList = state.priceList.filter((x) => x.id !== itemId);
  state.carts.forEach((cart) => {
    cart.items = cart.items.map((row) => row.itemId === itemId ? { ...row, itemId: "" } : row);
  });
  if (editingItemId === itemId) editingItemId = null;
  saveState();
  renderPriceList();
  renderCart();
}

function renderCart() {
  cartRows.innerHTML = "";
  const active = getActiveCart();

  if (!active.items.length) {
    active.items.push({ itemId: "", quantity: 1 });
  }

  active.items.forEach((row, index) => {
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

        const typedQuery = String(itemInput.value || "").trim();
        if (typedQuery) {
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "combo-option";
          addBtn.textContent = `+ Add "${typedQuery}"`;
          addBtn.addEventListener("click", () => {
            menu.classList.add("hidden");
            openQuickAddModal(typedQuery, index);
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
      if (!active.items[nextIndex]) {
        active.items.push({ itemId: "", quantity: 1 });
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
      active.items.splice(index, 1);
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
  const brand = String(item?.brand || "").trim();
  const store = String(item?.store || "").trim();
  const base = size ? `${name} - ${size}` : name;
  const details = [brand, store].filter(Boolean).join(" | ");
  return details ? `${base} (${details})` : base;
}

function isDuplicateByIdentity(item, identity) {
  return String(item.name || "").toLowerCase() === String(identity.name || "").toLowerCase()
    && String(item.size || "").toLowerCase() === String(identity.size || "").toLowerCase()
    && String(item.brand || "").toLowerCase() === String(identity.brand || "").toLowerCase()
    && String(item.store || "").toLowerCase() === String(identity.store || "").toLowerCase();
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
  const active = getActiveCart();
  let total = 0;
  const nodes = cartRows.querySelectorAll(".cart-row .muted");
  active.items.forEach((row, idx) => {
    total += updateLineTotal(nodes[idx], row);
  });
  cartTotal.textContent = roundMoney(total).toFixed(2);
}

function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function migrateState(parsed) {
  const migrated = {
    priceList: Array.isArray(parsed?.priceList)
      ? parsed.priceList.map((item) => ({
        ...item,
        brand: String(item.brand || "").trim(),
        store: String(item.store || "").trim(),
        size: String(item.size || "").trim()
      }))
      : [],
    carts: [],
    activeCartId: ""
  };

  if (Array.isArray(parsed?.carts)) {
    migrated.carts = parsed.carts.map((cart, idx) => ({
      id: String(cart.id || crypto.randomUUID()),
      name: String(cart.name || `Cart ${idx + 1}`).trim() || `Cart ${idx + 1}`,
      items: Array.isArray(cart.items) ? cart.items : []
    }));
    migrated.activeCartId = String(parsed.activeCartId || "");
  } else {
    const oldCart = Array.isArray(parsed?.cart) ? parsed.cart : [];
    const defaultId = crypto.randomUUID();
    migrated.carts = [{ id: defaultId, name: "Default Cart", items: oldCart }];
    migrated.activeCartId = defaultId;
  }

  if (!migrated.carts.length) {
    const defaultId = crypto.randomUUID();
    migrated.carts = [{ id: defaultId, name: "Default Cart", items: [] }];
    migrated.activeCartId = defaultId;
  }

  if (!migrated.carts.some((c) => c.id === migrated.activeCartId)) {
    migrated.activeCartId = migrated.carts[0].id;
  }

  return migrated;
}

function loadStateForUser(userId) {
  try {
    const raw = localStorage.getItem(getStorageKeyForUser(userId));
    if (!raw) {
      return createDefaultState();
    }
    return migrateState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  if (currentUser?.$id) {
    localStorage.setItem(getStorageKeyForUser(currentUser.$id), JSON.stringify(state));
  }
  queueCloudSave();
}

function applyRemotePayload(payloadText) {
  try {
    const data = migrateState(JSON.parse(payloadText));

    isApplyingRemoteState = true;
    setStateFrom(data);
    if (currentUser?.$id) {
      localStorage.setItem(getStorageKeyForUser(currentUser.$id), JSON.stringify(state));
    }

    renderCartManager();
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
  return JSON.stringify({
    priceList: state.priceList,
    carts: state.carts,
    activeCartId: state.activeCartId
  });
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

  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    ensureCarts();
    renderCartTabs();
    renderPriceList();
    renderCart();
    return;
  }

  try {
    currentUser = await account.get();
    setStateFrom(loadStateForUser(currentUser.$id));
    renderCartTabs();
    renderPriceList();
    renderCart();

    userName.textContent = currentUser.name || currentUser.email;
    setStatus("Connecting cloud sync...");
    await connectUserSync(currentUser.$id);
    setStatus("Cloud sync connected.");
  } catch {
    window.location.href = "./login.html";
  }
}

init();
