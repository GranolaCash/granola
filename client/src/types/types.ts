export type Currency = 'sat' | 'brl' | 'usd' | 'eur' | 'chf' | 'gbp';
export type OrderType = 'buy' | 'sell';
export type RelayStatus = 'connecting' | 'connected' | 'disconnected';
export type Balances = Record<Currency, number>;

export const DENOMINATIONS: Currency[] = ['sat', 'brl', 'usd', 'eur', 'chf', 'gbp'];

export interface Order {
  id: string;
  kind: OrderType;
  make_amount: number;
  make_denomination: Currency;
  take_amount: number;
  take_denomination: Currency;
}

export interface OrderRequest {
  kind: OrderType;
  make_amount: number;
  make_denomination: Currency;
  take_amount: number;
  take_denomination: Currency;
}