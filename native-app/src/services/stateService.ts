import { APPWRITE_CONFIG, databases, makeUserDocumentId, userPermissions } from '../config/appwrite';
import type { AppState } from '../types';
import { makeId } from '../utils/id';

export function createDefaultState(): AppState {
  const cartId = makeId('cart');
  return {
    priceList: [],
    carts: [{ id: cartId, name: 'Cart', items: [] }],
    activeCartId: cartId,
    priceHistory: {},
  };
}

function normalizeState(raw: any): AppState {
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const carts = Array.isArray(parsed.carts) ? parsed.carts : [];
  const safeCarts = carts.length
    ? carts.map((c: any) => ({
        id: String(c?.id || makeId('cart')),
        name: String(c?.name || 'Cart'),
        items: Array.isArray(c?.items)
          ? c.items.map((i: any) => ({ itemId: String(i?.itemId || ''), qty: Number(i?.qty || 1) }))
          : [],
      }))
    : [{ id: makeId('cart'), name: 'Cart', items: [] }];

  const activeCartId = safeCarts.some((c: any) => c.id === parsed.activeCartId)
    ? String(parsed.activeCartId)
    : safeCarts[0].id;

  return {
    priceList: Array.isArray(parsed.priceList)
      ? parsed.priceList.map((p: any) => ({
          id: String(p?.id || makeId('item')),
          name: String(p?.name || ''),
          size: String(p?.size || ''),
          price: Number(p?.price || 0),
          brand: String(p?.brand || ''),
          store: String(p?.store || ''),
        }))
      : [],
    carts: safeCarts,
    activeCartId,
    priceHistory: parsed.priceHistory && typeof parsed.priceHistory === 'object'
      ? Object.entries(parsed.priceHistory).reduce<Record<string, Array<{ at: string; price: number }>>>((acc, [itemId, history]) => {
          if (!Array.isArray(history)) return acc;
          acc[itemId] = history
            .map((point: any) => ({
              at: String(point?.at || ''),
              price: Number(point?.price || 0),
            }))
            .filter((point) => point.at && Number.isFinite(point.price) && point.price > 0);
          return acc;
        }, {})
      : {},
  };
}

export async function loadUserState(userId: string): Promise<AppState> {
  const docId = makeUserDocumentId(userId);
  try {
    const doc = await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collectionId, docId);
    const payload = JSON.parse(String(doc?.payload || '{}'));
    return normalizeState(payload);
  } catch (error: any) {
    if (error?.code === 404 || error?.type === 'document_not_found') {
      return createDefaultState();
    }
    throw error;
  }
}

export async function saveUserState(userId: string, state: AppState): Promise<void> {
  const docId = makeUserDocumentId(userId);
  const data = { payload: JSON.stringify(state) };

  try {
    await databases.updateDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collectionId, docId, data);
  } catch (error: any) {
    if (error?.code === 404 || error?.type === 'document_not_found') {
      await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collectionId,
        docId,
        data,
        userPermissions(userId),
      );
      return;
    }
    throw error;
  }
}
