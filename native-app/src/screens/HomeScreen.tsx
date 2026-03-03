import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import type { AppState, Cart, PriceHistoryPoint, PriceItem } from '../types';
import { createDefaultState, loadUserState, saveUserState } from '../services/stateService';
import { makeId } from '../utils/id';

type ViewName = 'cart' | 'price' | 'profile' | 'history';
type ComposerMode = 'add' | 'edit';

export function HomeScreen() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<ViewName>('cart');
  const [state, setState] = useState<AppState>(createDefaultState());
  const [status, setStatus] = useState('Loading cloud data...');
  const [loaded, setLoaded] = useState(false);

  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(1)).current;
  const [selectedHistoryItemId, setSelectedHistoryItemId] = useState('');

  const [itemQuery, setItemQuery] = useState('');
  const [qty, setQty] = useState('1');
  const [selectedPriceItemId, setSelectedPriceItemId] = useState('');
  const [composerMode, setComposerMode] = useState<ComposerMode>('add');
  const [editRowIndex, setEditRowIndex] = useState<number | null>(null);

  const [cartNameModalOpen, setCartNameModalOpen] = useState(false);
  const [newCartName, setNewCartName] = useState('');

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickSize, setQuickSize] = useState('');
  const [quickBrand, setQuickBrand] = useState('');
  const [quickStore, setQuickStore] = useState('');
  const [quickPrice, setQuickPrice] = useState('');

  const [editItemId, setEditItemId] = useState('');
  const [editName, setEditName] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editStore, setEditStore] = useState('');
  const [editPrice, setEditPrice] = useState('');

  useEffect(() => {
    let active = true;
    if (!user?.id) return;

    (async () => {
      try {
        const loadedState = await loadUserState(user.id);
        if (!active) return;
        setState(loadedState);
        setStatus('Cloud sync connected.');
      } catch (error: any) {
        if (!active) return;
        setStatus(`Cloud sync failed: ${error?.message || 'Unknown error'}`);
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!loaded || !user?.id) return;
    const timer = setTimeout(() => {
      saveUserState(user.id, state)
        .then(() => setStatus('Cloud sync connected.'))
        .catch((error: any) => setStatus(`Cloud sync failed: ${error?.message || 'Unknown error'}`));
    }, 350);

    return () => clearTimeout(timer);
  }, [state, loaded, user?.id]);

  useEffect(() => {
    panelAnim.setValue(0);
    Animated.timing(panelAnim, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [view, panelAnim]);

  const activeCart: Cart = useMemo(() => {
    return state.carts.find((c) => c.id === state.activeCartId) || state.carts[0];
  }, [state]);

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return state.priceList.slice(0, 20);
    return state.priceList
      .filter((item) => {
        const hay = [item.name, item.size, item.brand || '', item.store || ''].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [itemQuery, state.priceList]);

  const hasExactMatch = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return false;
    return state.priceList.some((item) => item.name.toLowerCase() === q);
  }, [itemQuery, state.priceList]);

  const historyItems = useMemo(() => {
    return [...state.priceList].sort((a, b) => renderItemLabel(a).localeCompare(renderItemLabel(b)));
  }, [state.priceList]);

  useEffect(() => {
    if (!historyItems.length) {
      setSelectedHistoryItemId('');
      return;
    }
    if (!selectedHistoryItemId || !historyItems.some((item) => item.id === selectedHistoryItemId)) {
      setSelectedHistoryItemId(historyItems[0].id);
    }
  }, [historyItems, selectedHistoryItemId]);

  const historyPoints = useMemo(() => {
    if (!selectedHistoryItemId) return [];
    return [...(state.priceHistory[selectedHistoryItemId] || [])].sort((a, b) => b.at.localeCompare(a.at));
  }, [selectedHistoryItemId, state.priceHistory]);

  const cartRows = useMemo(() => {
    if (!activeCart) return [];
    return activeCart.items
      .map((entry, idx) => {
        const item = state.priceList.find((p) => p.id === entry.itemId);
        if (!item) return null;
        return {
          idx,
          item,
          qty: entry.qty,
          lineTotal: entry.qty * item.price,
          storeKey: (item.store || 'Other').trim() || 'Other',
        };
      })
      .filter(Boolean) as Array<{ idx: number; item: PriceItem; qty: number; lineTotal: number; storeKey: string }>;
  }, [activeCart, state.priceList]);

  const groupedByStore = useMemo(() => {
    const map: Record<string, typeof cartRows> = {};
    for (const row of cartRows) {
      if (!map[row.storeKey]) map[row.storeKey] = [];
      map[row.storeKey].push(row);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [cartRows]);

  const cartTotal = useMemo(() => cartRows.reduce((sum, row) => sum + row.lineTotal, 0), [cartRows]);
  const panelAnimatedStyle = {
    opacity: panelAnim,
    transform: [
      {
        translateY: panelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };
  const menuCardAnimatedStyle = {
    opacity: menuAnim,
    transform: [
      {
        translateY: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        scale: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  function historyPoint(price: number): PriceHistoryPoint {
    return { at: new Date().toISOString(), price };
  }

  function resetComposer() {
    setItemQuery('');
    setQty('1');
    setSelectedPriceItemId('');
    setComposerMode('add');
    setEditRowIndex(null);
  }

  function addNewCart() {
    const name = newCartName.trim() || `Cart ${state.carts.length + 1}`;
    const cart = { id: makeId('cart'), name, items: [] };
    setState((prev) => ({ ...prev, carts: [...prev.carts, cart], activeCartId: cart.id }));
    setNewCartName('');
    setCartNameModalOpen(false);
    setView('cart');
  }

  function removeCart(cartId: string) {
    if (state.carts.length <= 1) {
      Alert.alert('Cannot remove', 'At least one cart is required.');
      return;
    }
    const nextCarts = state.carts.filter((c) => c.id !== cartId);
    const nextActive = state.activeCartId === cartId ? nextCarts[0].id : state.activeCartId;
    setState((prev) => ({ ...prev, carts: nextCarts, activeCartId: nextActive }));
  }

  function selectSuggestion(item: PriceItem) {
    setSelectedPriceItemId(item.id);
    setItemQuery(item.name);
  }

  function addOrUpdateCartItem() {
    const parsedQty = Math.max(1, Number(qty || 1));
    if (!parsedQty) return;

    let targetItemId = selectedPriceItemId;
    if (!targetItemId && itemQuery.trim()) {
      const q = itemQuery.trim().toLowerCase();
      const exactByName = state.priceList.filter((item) => item.name.toLowerCase() === q);
      if (exactByName.length === 1) {
        targetItemId = exactByName[0].id;
      } else if (filteredItems.length === 1) {
        targetItemId = filteredItems[0].id;
      }
    }

    if (!targetItemId) {
      Alert.alert('Item missing', 'Choose an existing item or use Quick Add.');
      return;
    }

    const targetCartId = activeCart.id;

    setState((prev) => {
      const nextCarts = prev.carts.map((cart) => {
        if (cart.id !== targetCartId) return cart;

        if (composerMode === 'edit' && editRowIndex !== null && cart.items[editRowIndex]) {
          const nextItems = [...cart.items];
          nextItems[editRowIndex] = { itemId: targetItemId, qty: parsedQty };
          return { ...cart, items: nextItems };
        }

        return { ...cart, items: [...cart.items, { itemId: targetItemId, qty: parsedQty }] };
      });
      return { ...prev, carts: nextCarts };
    });

    resetComposer();
  }

  function addPriceListItemFromInputs() {
    const name = quickName.trim();
    const size = quickSize.trim();
    const price = Number(quickPrice || 0);
    if (!name || !size || !Number.isFinite(price) || price <= 0) {
      Alert.alert('Required', 'Enter name, size and valid price.');
      return;
    }

    const item: PriceItem = {
      id: makeId('item'),
      name,
      size,
      brand: quickBrand.trim(),
      store: quickStore.trim(),
      price,
    };

    setState((prev) => ({
      ...prev,
      priceList: [...prev.priceList, item],
      priceHistory: {
        ...prev.priceHistory,
        [item.id]: [...(prev.priceHistory[item.id] || []), historyPoint(price)],
      },
    }));
    setSelectedPriceItemId(item.id);
    setItemQuery(item.name);

    setQuickName('');
    setQuickSize('');
    setQuickBrand('');
    setQuickStore('');
    setQuickPrice('');
    setQuickAddOpen(false);
  }

  function deletePriceItem(itemId: string) {
    setState((prev) => {
      const nextPrice = prev.priceList.filter((p) => p.id !== itemId);
      const nextCarts = prev.carts.map((cart) => ({
        ...cart,
        items: cart.items.filter((ci) => ci.itemId !== itemId),
      }));
      const nextHistory = { ...prev.priceHistory };
      delete nextHistory[itemId];
      return { ...prev, priceList: nextPrice, carts: nextCarts, priceHistory: nextHistory };
    });
  }

  function beginEditPriceItem(item: PriceItem) {
    setEditItemId(item.id);
    setEditName(item.name);
    setEditSize(item.size);
    setEditBrand(item.brand || '');
    setEditStore(item.store || '');
    setEditPrice(String(item.price));
  }

  function saveEditedPriceItem() {
    if (!editItemId) return;
    const price = Number(editPrice || 0);
    if (!editName.trim() || !editSize.trim() || !price) {
      Alert.alert('Required', 'Name, size, and price are required.');
      return;
    }

    setState((prev) => {
      const current = prev.priceList.find((item) => item.id === editItemId);
      const hasPriceChange = !!current && Number(current.price) !== price;
      const nextHistory = hasPriceChange
        ? {
            ...prev.priceHistory,
            [editItemId]: [...(prev.priceHistory[editItemId] || []), historyPoint(price)],
          }
        : prev.priceHistory;

      return {
        ...prev,
        priceList: prev.priceList.map((item) =>
          item.id === editItemId
            ? {
                ...item,
                name: editName.trim(),
                size: editSize.trim(),
                brand: editBrand.trim(),
                store: editStore.trim(),
                price,
              }
            : item,
        ),
        priceHistory: nextHistory,
      };
    });

    setEditItemId('');
  }

  function editCartRow(index: number) {
    const row = cartRows.find((r) => r.idx === index);
    if (!row) return;
    setComposerMode('edit');
    setEditRowIndex(index);
    setSelectedPriceItemId(row.item.id);
    setItemQuery(row.item.name);
    setQty(String(row.qty));
    setView('cart');
  }

  function removeCartRow(index: number) {
    setState((prev) => ({
      ...prev,
      carts: prev.carts.map((cart) =>
        cart.id === activeCart.id
          ? { ...cart, items: cart.items.filter((_, i) => i !== index) }
          : cart,
      ),
    }));

    if (editRowIndex === index) {
      resetComposer();
    }
  }

  function openNameMenu() {
    setNameMenuOpen(true);
    menuAnim.setValue(0);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function closeNameMenu() {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 120,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setNameMenuOpen(false);
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Personal Cart Manager</Text>
            <Text style={styles.syncText}>{status}</Text>
          </View>

          <Pressable style={styles.nameChip} onPress={openNameMenu}>
            <Text style={styles.nameChipText} numberOfLines={1}>{user?.name || user?.email || 'Account'}</Text>
            <Text style={styles.nameChevron}>⌄</Text>
          </Pressable>
        </View>

        <View style={styles.tabBar}>
          {([
            ['cart', 'Carts'],
            ['price', 'Price List'],
            ['history', 'History'],
          ] as const).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.tabBtn, view === key && styles.tabBtnActive]}
              onPress={() => setView(key)}
            >
              <Text style={[styles.tabBtnText, view === key && styles.tabBtnTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {view === 'cart' && (
          <Animated.View style={[styles.panel, panelAnimatedStyle]}>
            <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
            <View style={styles.cartTabsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cartsScrollRow}>
                {state.carts.map((cart) => (
                  <Pressable
                    key={cart.id}
                    style={[styles.cartTab, state.activeCartId === cart.id && styles.cartTabActive]}
                    onPress={() => setState((prev) => ({ ...prev, activeCartId: cart.id }))}
                  >
                    <Text numberOfLines={1} style={[styles.cartTabText, state.activeCartId === cart.id && styles.cartTabTextActive]}>
                      {cart.name}
                    </Text>
                    <Pressable onPress={() => removeCart(cart.id)} style={styles.cartTabClose} hitSlop={8}>
                      <Text style={styles.cartTabCloseText}>x</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.squareBtn} onPress={() => setCartNameModalOpen(true)}>
                <Text style={styles.squareBtnText}>+</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Add Item</Text>
            <View style={styles.composerRow}>
              <TextInput
                style={[styles.input, styles.itemSearchInput]}
                placeholder="Search item"
                value={itemQuery}
                onChangeText={(val) => {
                  setItemQuery(val);
                  setSelectedPriceItemId('');
                }}
              />
              <TextInput
                style={[styles.input, styles.qtyInput]}
                keyboardType="number-pad"
                returnKeyType="done"
                value={qty}
                onChangeText={setQty}
                onSubmitEditing={addOrUpdateCartItem}
              />
              <Pressable style={styles.primaryBtn} onPress={addOrUpdateCartItem}>
                <Text style={styles.primaryBtnText}>{composerMode === 'edit' ? 'Update' : 'Add'}</Text>
              </Pressable>
              {composerMode === 'edit' && (
                <Pressable style={styles.secondaryBtn} onPress={resetComposer}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              )}
            </View>

            {filteredItems.length > 0 && itemQuery.trim() && !selectedPriceItemId ? (
              <View style={styles.suggestionsBox}>
                {filteredItems.map((item) => (
                  <Pressable key={item.id} style={styles.suggestionRow} onPress={() => selectSuggestion(item)}>
                    <Text style={styles.suggestionText}>{renderItemLabel(item)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {itemQuery.trim() && !hasExactMatch ? (
              <Pressable
                onPress={() => {
                  setQuickName(itemQuery.trim());
                  setQuickAddOpen(true);
                }}
                style={styles.quickAddBtn}
              >
                <Text style={styles.quickAddText}>+ Quick add "{itemQuery.trim()}"</Text>
              </Pressable>
            ) : null}

            <Text style={styles.sectionTitle}>Cart Items</Text>
            <View style={styles.cartListBox}>
              <ScrollView style={{ maxHeight: 340 }} nestedScrollEnabled>
                {groupedByStore.length === 0 ? (
                  <Text style={styles.emptyText}>No items in this cart yet.</Text>
                ) : (
                  groupedByStore.map(([storeName, rows]) => (
                    <View key={storeName} style={styles.storeSection}>
                      <Text style={styles.storeHeading}>Store: {storeName}</Text>
                      {rows.map((row) => (
                        <View key={`${storeName}-${row.idx}`} style={styles.rowItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rowName}>{row.item.name}</Text>
                            <Text style={styles.rowSub}>{row.item.size} | {row.item.brand || '-'}</Text>
                          </View>
                          <Text style={styles.rowMeta}>x{row.qty}</Text>
                          <Text style={styles.rowMeta}>${row.lineTotal.toFixed(2)}</Text>
                          <Pressable onPress={() => editCartRow(row.idx)} style={styles.inlineBtn}><Text style={styles.inlineBtnText}>Edit</Text></Pressable>
                          <Pressable onPress={() => removeCartRow(row.idx)} style={styles.inlineBtn}><Text style={styles.inlineBtnText}>Del</Text></Pressable>
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </ScrollView>
              <Text style={styles.totalText}>Total: ${cartTotal.toFixed(2)}</Text>
            </View>
            </ScrollView>
          </Animated.View>
        )}

        {view === 'price' && (
          <Animated.View style={[styles.panel, panelAnimatedStyle]}>
            <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
            <Text style={styles.sectionTitle}>Add to Price List</Text>
            <View style={styles.priceAddWrap}>
              <TextInput placeholder="Item name" style={styles.input} value={quickName} onChangeText={setQuickName} />
              <TextInput placeholder="Size (1kg/1L)" style={styles.input} value={quickSize} onChangeText={setQuickSize} />
              <TextInput placeholder="Brand" style={styles.input} value={quickBrand} onChangeText={setQuickBrand} />
              <TextInput placeholder="Store" style={styles.input} value={quickStore} onChangeText={setQuickStore} />
              <TextInput placeholder="Price" style={styles.input} value={quickPrice} onChangeText={setQuickPrice} keyboardType="decimal-pad" />
              <Pressable style={styles.primaryBtn} onPress={addPriceListItemFromInputs}><Text style={styles.primaryBtnText}>Add</Text></Pressable>
            </View>

            <Text style={styles.sectionTitle}>Items</Text>
            {state.priceList.length === 0 ? <Text style={styles.emptyText}>No items yet.</Text> : null}

            {state.priceList.map((item) => (
              <View key={item.id} style={styles.priceRowCard}>
                {editItemId === item.id ? (
                  <>
                    <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Name" />
                    <TextInput style={styles.input} value={editSize} onChangeText={setEditSize} placeholder="Size" />
                    <TextInput style={styles.input} value={editBrand} onChangeText={setEditBrand} placeholder="Brand" />
                    <TextInput style={styles.input} value={editStore} onChangeText={setEditStore} placeholder="Store" />
                    <TextInput style={styles.input} value={editPrice} onChangeText={setEditPrice} placeholder="Price" keyboardType="decimal-pad" />
                    <View style={styles.inlineActionRow}>
                      <Pressable style={styles.primaryBtn} onPress={saveEditedPriceItem}><Text style={styles.primaryBtnText}>Save</Text></Pressable>
                      <Pressable style={styles.secondaryBtn} onPress={() => setEditItemId('')}><Text style={styles.secondaryBtnText}>Cancel</Text></Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowSub}>{item.size} | {item.brand || '-'} | {item.store || '-'}</Text>
                    <Text style={styles.rowPrice}>${item.price.toFixed(2)}</Text>
                    <View style={styles.inlineActionRow}>
                      <Pressable style={styles.secondaryBtn} onPress={() => beginEditPriceItem(item)}><Text style={styles.secondaryBtnText}>Edit</Text></Pressable>
                      <Pressable style={styles.secondaryBtn} onPress={() => deletePriceItem(item.id)}><Text style={styles.secondaryBtnText}>Delete</Text></Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}
            </ScrollView>
          </Animated.View>
        )}

        {view === 'profile' && (
          <Animated.View style={[styles.panel, styles.panelContent, panelAnimatedStyle]}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{user?.name || '-'}</Text>

              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || '-'}</Text>

              <Text style={styles.infoLabel}>User ID</Text>
              <Text style={styles.infoValue}>{user?.id || '-'}</Text>
            </View>
          </Animated.View>
        )}

        {view === 'history' && (
          <Animated.View style={[styles.panel, panelAnimatedStyle]}>
            <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
            <Text style={styles.sectionTitle}>Price History</Text>
            {historyItems.length ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historySelectorRow}>
                  {historyItems.map((item) => (
                    <Pressable
                      key={item.id}
                      style={[styles.historyItemChip, selectedHistoryItemId === item.id && styles.historyItemChipActive]}
                      onPress={() => setSelectedHistoryItemId(item.id)}
                    >
                      <Text style={[styles.historyItemChipText, selectedHistoryItemId === item.id && styles.historyItemChipTextActive]}>
                        {renderItemLabel(item)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.infoCard}>
                  {historyPoints.length ? (
                    historyPoints.map((point, idx) => (
                      <View key={`${point.at}-${idx}`} style={styles.historyRow}>
                        <Text style={styles.historyDate}>{formatDate(point.at)}</Text>
                        <Text style={styles.historyPrice}>${point.price.toFixed(2)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No history for this item yet.</Text>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>No items in price list yet.</Text>
            )}
            </ScrollView>
          </Animated.View>
        )}
      </View>

      <Modal visible={nameMenuOpen} transparent animationType="none" onRequestClose={closeNameMenu}>
        <Animated.View style={[styles.menuBackdrop, { opacity: menuAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeNameMenu} />
          <Animated.View style={[styles.nameMenuCard, menuCardAnimatedStyle]}>
            <Pressable style={styles.nameMenuItem} onPress={() => { setView('profile'); closeNameMenu(); }}>
              <Text style={styles.nameMenuItemText}>Profile</Text>
            </Pressable>
            <Pressable style={styles.nameMenuItem} onPress={async () => { closeNameMenu(); await logout(); }}>
              <Text style={[styles.nameMenuItemText, styles.nameMenuDanger]}>Logout</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal visible={cartNameModalOpen} transparent animationType="fade" onRequestClose={() => setCartNameModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>New Cart</Text>
            <TextInput placeholder="Cart name" style={styles.input} value={newCartName} onChangeText={setNewCartName} />
            <View style={styles.inlineActionRow}>
              <Pressable style={styles.primaryBtn} onPress={addNewCart}><Text style={styles.primaryBtnText}>Create</Text></Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => setCartNameModalOpen(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={quickAddOpen} transparent animationType="fade" onRequestClose={() => setQuickAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Quick Add Item</Text>
            <TextInput placeholder="Item name" style={styles.input} value={quickName} onChangeText={setQuickName} />
            <TextInput placeholder="Size" style={styles.input} value={quickSize} onChangeText={setQuickSize} />
            <TextInput placeholder="Brand" style={styles.input} value={quickBrand} onChangeText={setQuickBrand} />
            <TextInput placeholder="Store" style={styles.input} value={quickStore} onChangeText={setQuickStore} />
            <TextInput placeholder="Price" style={styles.input} value={quickPrice} onChangeText={setQuickPrice} keyboardType="decimal-pad" />
            <View style={styles.inlineActionRow}>
              <Pressable style={styles.primaryBtn} onPress={addPriceListItemFromInputs}><Text style={styles.primaryBtnText}>Add</Text></Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => setQuickAddOpen(false)}><Text style={styles.secondaryBtnText}>Cancel</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function renderItemLabel(item: PriceItem): string {
  const parts = [item.name, item.size, item.brand || '', item.store || ''].filter(Boolean);
  return parts.join(' | ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#061433' },
  page: { flex: 1, paddingHorizontal: 12, backgroundColor: '#dbe8f8' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 10,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  syncText: { marginTop: 4, color: '#334155', fontSize: 12 },
  nameChip: {
    maxWidth: 190,
    borderRadius: 18.5,
    backgroundColor: '#0f2740',
    borderWidth: 1,
    borderColor: '#1f3d5f',
    paddingVertical: 8,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameChipText: { color: '#f8fafc', fontWeight: '700', flex: 1 },
  nameChevron: { color: '#cbd5e1', fontSize: 13, marginTop: -2 },

  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 3,
    gap: 3,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1.5 },
      },
      android: { elevation: 2 },
    }),
  },
  tabBtnText: { color: '#475569', fontWeight: '800' },
  tabBtnTextActive: { color: '#0f172a' },

  panel: { flex: 1 },
  panelContent: { paddingBottom: 18 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8, marginTop: 4 },

  cartTabsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cartsScrollRow: { gap: 8, paddingRight: 8 },
  cartTab: {
    minWidth: 110,
    maxWidth: 180,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 30,
    position: 'relative',
  },
  cartTabActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  cartTabText: { color: '#0f172a', fontWeight: '700' },
  cartTabTextActive: { color: '#fff' },
  cartTabClose: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(15,118,110,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartTabCloseText: { color: '#0f172a', fontWeight: '900', fontSize: 12 },
  squareBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareBtnText: { fontSize: 20, fontWeight: '700', color: '#0f172a' },

  composerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 },
  itemSearchInput: { flexGrow: 1, minWidth: 170 },
  qtyInput: { width: 60 },

  input: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  primaryBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },

  suggestionsBox: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    backgroundColor: '#fff',
    maxHeight: 180,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  suggestionText: { color: '#0f172a', fontSize: 14 },

  quickAddBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ccfbf1',
    marginBottom: 6,
  },
  quickAddText: { color: '#134e4a', fontWeight: '700' },

  cartListBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 10,
  },
  storeSection: { marginBottom: 10 },
  storeHeading: {
    backgroundColor: '#ecfeff',
    color: '#0f766e',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    fontWeight: '800',
    marginBottom: 6,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowName: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  rowSub: { color: '#475569', marginTop: 2, fontSize: 13 },
  rowPrice: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginTop: 6 },
  rowMeta: { color: '#0f172a', fontWeight: '700', width: 56, textAlign: 'right' },
  inlineBtn: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  inlineBtnText: { color: '#0f172a', fontWeight: '700' },
  totalText: { marginTop: 10, fontSize: 26, fontWeight: '900', color: '#0f172a' },

  priceAddWrap: { gap: 8, marginBottom: 10 },
  priceRowCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  inlineActionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#fff',
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
    }),
  },
  infoLabel: { color: '#475569', fontSize: 12, marginBottom: 2, marginTop: 8, fontWeight: '600' },
  infoValue: { color: '#020617', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#64748b', marginVertical: 8 },

  historySelectorRow: { gap: 8, paddingBottom: 10 },
  historyItemChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#fff',
    paddingVertical: 7,
    paddingHorizontal: 12,
    maxWidth: 260,
  },
  historyItemChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  historyItemChipText: { color: '#0f172a', fontWeight: '700' },
  historyItemChipTextActive: { color: '#fff' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  historyDate: { color: '#334155' },
  historyPrice: { color: '#0f172a', fontWeight: '800' },

  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.42)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 58,
    paddingRight: 14,
  },
  nameMenuCard: {
    width: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#020617',
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },
  nameMenuItem: {
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  nameMenuItemText: { color: '#0f172a', fontWeight: '700' },
  nameMenuDanger: { color: '#b91c1c' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.52)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
    gap: 8,
  },
});
