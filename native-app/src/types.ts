export type PriceItem = {
  id: string;
  name: string;
  size: string;
  price: number;
  brand?: string;
  store?: string;
};

export type CartItem = {
  itemId: string;
  qty: number;
};

export type Cart = {
  id: string;
  name: string;
  items: CartItem[];
};

export type AppState = {
  priceList: PriceItem[];
  carts: Cart[];
  activeCartId: string;
  priceHistory: Record<string, PriceHistoryPoint[]>;
};

export type PriceHistoryPoint = {
  at: string;
  price: number;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};
