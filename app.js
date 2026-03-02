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
const historyState = { selectedName: "", selectedVariantId: "" };
const DEFAULT_ITEM_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23e2e8f0'/%3E%3Cpath d='M16 24h32v24H16z' fill='%2394a3b8'/%3E%3Cpath d='M24 20h16v8H24z' fill='%2364748b'/%3E%3C/svg%3E";

const userName = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");
const syncStatus = document.getElementById("syncStatus");

const menuPriceList = document.getElementById("menuPriceList");
const menuMoreBtn = document.getElementById("menuMoreBtn");
const menuDropdown = document.getElementById("menuDropdown");
const menuHistory = document.getElementById("menuHistory");
const menuProfile = document.getElementById("menuProfile");
const cartTabs = document.getElementById("cartTabs");
const addCartTabBtn = document.getElementById("addCartTabBtn");
const viewPriceList = document.getElementById("viewPriceList");
const viewHistory = document.getElementById("viewHistory");
const viewProfile = document.getElementById("viewProfile");
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

const historyItemNameSelect = document.getElementById("historyItemNameSelect");
const historyVariantSelect = document.getElementById("historyVariantSelect");
const historyChart = document.getElementById("historyChart");
const historyChartEmpty = document.getElementById("historyChartEmpty");
const historyTableBody = document.getElementById("historyTableBody");
const profileNameValue = document.getElementById("profileNameValue");
const profileEmailValue = document.getElementById("profileEmailValue");
const profileUserIdValue = document.getElementById("profileUserIdValue");
const currentPasswordInput = document.getElementById("currentPasswordInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const profilePasswordStatus = document.getElementById("profilePasswordStatus");

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-wrap")) {
    closeMenuDropdown();
  }
  if (!e.target.closest(".combo") && !e.target.closest(".modal-card")) {
    closeAllCombos();
  }
});

menuPriceList.addEventListener("click", () => {
  closeMenuDropdown();
  switchView("priceList");
});
menuMoreBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleMenuDropdown();
});
menuHistory.addEventListener("click", () => {
  closeMenuDropdown();
  switchView("history");
});
menuProfile.addEventListener("click", () => {
  closeMenuDropdown();
  switchView("profile");
});
logoutBtn.addEventListener("click", logout);

addCartTabBtn.addEventListener("click", () => {
  const cart = { id: crypto.randomUUID(), name: "New Cart", items: [] };
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

historyItemNameSelect.addEventListener("change", () => {
  historyState.selectedName = historyItemNameSelect.value;
  historyState.selectedVariantId = "";
  renderHistoryView();
});

historyVariantSelect.addEventListener("change", () => {
  historyState.selectedVariantId = historyVariantSelect.value;
  renderHistoryView();
});

resetPasswordBtn.addEventListener("click", async () => {
  const currentPassword = String(currentPasswordInput.value || "");
  const nextPassword = String(newPasswordInput.value || "");
  const confirmPassword = String(confirmPasswordInput.value || "");

  if (!currentPassword || !nextPassword || !confirmPassword) {
    setProfileStatus("Please fill all password fields.", true);
    return;
  }
  if (nextPassword.length < 8) {
    setProfileStatus("New password must be at least 8 characters.", true);
    return;
  }
  if (nextPassword !== confirmPassword) {
    setProfileStatus("New password and confirm password must match.", true);
    return;
  }

  try {
    await account.updatePassword(nextPassword, currentPassword);
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    setProfileStatus("Password updated successfully.", false);
  } catch (error) {
    const message = error?.message || "Failed to update password.";
    setProfileStatus(message, true);
  }
});

function setStatus(text) {
  syncStatus.textContent = text;
}

function setProfileStatus(text, isError) {
  profilePasswordStatus.textContent = text;
  profilePasswordStatus.classList.toggle("error-text", Boolean(isError));
}

function populateProfile() {
  profileNameValue.textContent = currentUser?.name || "-";
  profileEmailValue.textContent = currentUser?.email || "-";
  profileUserIdValue.textContent = currentUser?.$id || "-";
}

function toggleMenuDropdown() {
  const isHidden = menuDropdown.classList.contains("hidden");
  menuDropdown.classList.toggle("hidden", !isHidden);
  menuMoreBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
}

function closeMenuDropdown() {
  menuDropdown.classList.add("hidden");
  menuMoreBtn.setAttribute("aria-expanded", "false");
}

function getSafeImageUrl(imageUrl) {
  const text = String(imageUrl || "").trim();
  return text || DEFAULT_ITEM_IMAGE;
}

async function fetchItemImageUrl(item) {
  const query = [item.brand, item.name, item.store].filter(Boolean).join(" ").trim();
  if (!query) return "";

  const endpoint = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=80`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) return "";
    const data = await response.json();
    const pages = Object.values(data?.query?.pages || {});
    const withImage = pages.find((page) => page?.thumbnail?.source);
    return String(withImage?.thumbnail?.source || "").trim();
  } catch {
    return "";
  }
}

async function hydrateItemImage(itemId) {
  const item = state.priceList.find((x) => x.id === itemId);
  if (!item) return;
  if (item.imageUrl && item.imageUrl !== DEFAULT_ITEM_IMAGE) return;

  const imageUrl = await fetchItemImageUrl(item);
  if (!imageUrl) return;

  const latest = state.priceList.find((x) => x.id === itemId);
  if (!latest) return;
  latest.imageUrl = imageUrl;
  saveState();
  renderPriceList();
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

function normalizeHistory(history, fallbackPrice) {
  if (Array.isArray(history) && history.length) {
    return history
      .map((entry) => ({
        ts: Number(entry.ts || Date.now()),
        price: roundMoney(Number(entry.price || fallbackPrice || 0))
      }))
      .sort((a, b) => a.ts - b.ts);
  }
  return [{ ts: Date.now(), price: roundMoney(Number(fallbackPrice || 0)) }];
}

function setStateFrom(nextState) {
  state.priceList.length = 0;
  state.carts.length = 0;

  nextState.priceList.forEach((item) => {
    state.priceList.push({
      ...item,
      brand: String(item.brand || "").trim(),
      store: String(item.store || "").trim(),
      size: String(item.size || "").trim(),
      imageUrl: getSafeImageUrl(item.imageUrl),
      history: normalizeHistory(item.history, Number(item.price || 0))
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
  const isHistory = view === "history";
  const isProfile = view === "profile";
  const isCart = !isPriceList && !isHistory && !isProfile;
  const isMenuView = isPriceList || isHistory || isProfile;

  menuPriceList.classList.toggle("active", isPriceList);
  menuMoreBtn.classList.toggle("active", isMenuView);
  menuHistory.classList.toggle("active", isHistory);
  menuProfile.classList.toggle("active", isProfile);
  viewPriceList.classList.toggle("hidden", !isPriceList);
  viewHistory.classList.toggle("hidden", !isHistory);
  viewProfile.classList.toggle("hidden", !isProfile);
  viewCart.classList.toggle("hidden", !isCart);

  renderCartTabs();
  if (isHistory) renderHistoryView();
  if (isProfile) populateProfile();
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
  const onCart = !viewCart.classList.contains("hidden");

  state.carts.forEach((cart) => {
    const tabWrap = document.createElement("div");
    tabWrap.className = "tab";
    tabWrap.dataset.cartId = cart.id;
    if (onCart && cart.id === state.activeCartId) {
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

  const rounded = roundMoney(price);
  const item = {
    id: crypto.randomUUID(),
    name: cleanedName,
    brand: cleanedBrand,
    store: cleanedStore,
    size: cleanedSize,
    imageUrl: DEFAULT_ITEM_IMAGE,
    price: rounded,
    history: [{ ts: Date.now(), price: rounded }]
  };

  state.priceList.push(item);
  saveState();
  renderPriceList();
  renderCart();
  renderHistoryView();
  hydrateItemImage(item.id);
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

    const tdIcon = document.createElement("td");
    const tdName = document.createElement("td");
    const tdBrand = document.createElement("td");
    const tdStore = document.createElement("td");
    const tdSize = document.createElement("td");
    const tdPrice = document.createElement("td");
    const iconImg = document.createElement("img");
    iconImg.className = "item-icon";
    iconImg.alt = item.name ? `${item.name} icon` : "Item icon";
    iconImg.src = getSafeImageUrl(item.imageUrl);
    iconImg.referrerPolicy = "no-referrer";
    iconImg.loading = "lazy";
    iconImg.addEventListener("error", () => {
      iconImg.src = DEFAULT_ITEM_IMAGE;
    });
    tdIcon.appendChild(iconImg);

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

        const rounded = roundMoney(nextPrice);
        if (rounded !== Number(item.price || 0)) {
          item.history = normalizeHistory(item.history, Number(item.price || 0));
          item.history.push({ ts: Date.now(), price: rounded });
        }

        item.name = nextName;
        item.brand = nextBrand;
        item.store = nextStore;
        item.size = nextSize;
        item.price = rounded;

        editingItemId = null;
        saveState();
        renderPriceList();
        renderCart();
        renderHistoryView();
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

    tr.appendChild(tdIcon);
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
  renderHistoryView();
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

    const getMenuOptions = () => Array.from(menu.querySelectorAll(".combo-option"));
    const focusOptionAt = (idx) => {
      const options = getMenuOptions();
      if (!options.length) return;
      const bounded = Math.max(0, Math.min(idx, options.length - 1));
      options[bounded].focus();
    };
    const moveFocusedOption = (delta) => {
      const options = getMenuOptions();
      if (!options.length) return;
      const current = options.indexOf(document.activeElement);
      if (current === -1) {
        focusOptionAt(delta > 0 ? 0 : options.length - 1);
        return;
      }
      const next = Math.max(0, Math.min(current + delta, options.length - 1));
      options[next].focus();
    };
    const bindOptionNavigation = (option) => {
      option.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveFocusedOption(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          moveFocusedOption(-1);
        } else if (e.key === "Escape") {
          e.preventDefault();
          menu.classList.add("hidden");
          itemInput.focus();
        } else if (e.key === "Enter") {
          e.preventDefault();
          option.click();
        }
      });
    };

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
          bindOptionNavigation(addBtn);
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
        bindOptionNavigation(option);
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
        openMenu();
        focusOptionAt(0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
        focusOptionAt(getMenuOptions().length - 1);
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

function getVariantLabel(item) {
  const size = String(item.size || "").trim() || "-";
  const brand = String(item.brand || "").trim() || "-";
  const store = String(item.store || "").trim() || "-";
  return `${size} | Brand: ${brand} | Store: ${store}`;
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
        size: String(item.size || "").trim(),
        imageUrl: getSafeImageUrl(item.imageUrl),
        history: normalizeHistory(item.history, Number(item.price || 0))
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
    if (!raw) return createDefaultState();
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
    renderHistoryView();
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

function renderHistoryView() {
  const names = [...new Set(state.priceList.map((x) => x.name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  historyItemNameSelect.innerHTML = "";
  if (!names.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No items available";
    historyItemNameSelect.appendChild(opt);
    historyVariantSelect.innerHTML = "";
    historyChart.classList.add("hidden");
    historyChartEmpty.textContent = "No items in price list.";
    historyChartEmpty.classList.remove("hidden");
    historyTableBody.innerHTML = "";
    return;
  }

  if (!historyState.selectedName || !names.includes(historyState.selectedName)) {
    historyState.selectedName = names[0];
  }

  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === historyState.selectedName) opt.selected = true;
    historyItemNameSelect.appendChild(opt);
  });

  const variants = state.priceList.filter((x) => x.name === historyState.selectedName);
  historyVariantSelect.innerHTML = "";
  if (!variants.length) {
    historyChart.classList.add("hidden");
    historyChartEmpty.textContent = "No variants found for selected item.";
    historyChartEmpty.classList.remove("hidden");
    historyTableBody.innerHTML = "";
    return;
  }

  if (!historyState.selectedVariantId || !variants.some((v) => v.id === historyState.selectedVariantId)) {
    historyState.selectedVariantId = variants[0].id;
  }

  variants.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = getVariantLabel(item);
    if (item.id === historyState.selectedVariantId) opt.selected = true;
    historyVariantSelect.appendChild(opt);
  });

  const selected = variants.find((x) => x.id === historyState.selectedVariantId) || variants[0];
  const history = normalizeHistory(selected.history, Number(selected.price || 0));
  selected.history = history;

  renderHistoryChart(history);
  renderHistoryTable(history);
}

function renderHistoryChart(history) {
  if (!history.length) {
    historyChart.classList.add("hidden");
    historyChartEmpty.textContent = "No history available.";
    historyChartEmpty.classList.remove("hidden");
    return;
  }

  historyChart.classList.remove("hidden");
  historyChartEmpty.classList.add("hidden");

  const width = 760;
  const height = 240;
  const pad = 28;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = max - min || 1;

  const pts = history.map((entry, idx) => {
    const x = pad + (history.length === 1 ? 0 : (idx / (history.length - 1)) * (width - pad * 2));
    const y = height - pad - ((entry.price - min) / spread) * (height - pad * 2);
    return { x, y, ts: entry.ts, price: entry.price };
  });

  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  historyChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="history-chart-svg" aria-label="Price trend chart">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="history-axis" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="history-axis" />
      <polyline points="${poly}" class="history-line" />
      ${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" class="history-point"><title>${new Date(p.ts).toLocaleString()} - $${p.price.toFixed(2)}</title></circle>`).join("")}
      <text x="${pad}" y="${pad - 8}" class="history-label">$${max.toFixed(2)}</text>
      <text x="${pad}" y="${height - pad + 16}" class="history-label">$${min.toFixed(2)}</text>
    </svg>
  `;
}

function renderHistoryTable(history) {
  historyTableBody.innerHTML = "";
  [...history].reverse().forEach((entry) => {
    const tr = document.createElement("tr");
    const tdDate = document.createElement("td");
    const tdPrice = document.createElement("td");
    tdDate.textContent = new Date(entry.ts).toLocaleString();
    tdPrice.textContent = `$${entry.price.toFixed(2)}`;
    tr.appendChild(tdDate);
    tr.appendChild(tdPrice);
    historyTableBody.appendChild(tr);
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
  closeMenuDropdown();
  setProfileStatus("Use your current password to set a new one.", false);

  if (!isConfigured()) {
    setStatus("Appwrite is not configured.");
    ensureCarts();
    renderCartTabs();
    renderPriceList();
    renderCart();
    renderHistoryView();
    populateProfile();
    return;
  }

  try {
    currentUser = await account.get();
    setStateFrom(loadStateForUser(currentUser.$id));
    renderCartTabs();
    renderPriceList();
    renderCart();
    renderHistoryView();
    populateProfile();

    userName.textContent = currentUser.name || currentUser.email;
    setStatus("Connecting cloud sync...");
    await connectUserSync(currentUser.$id);
    setStatus("Cloud sync connected.");
  } catch {
    window.location.href = "./login.html";
  }
}

init();
