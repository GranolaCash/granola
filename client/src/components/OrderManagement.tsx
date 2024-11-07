'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CircleDollarSign, Lock, LinkIcon, Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { Order, OrderRequest, Currency, RelayStatus, DENOMINATIONS, Balances } from '@/types/types';

const formatBalance = (amount: number, currency: Currency) => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'sat' ? 0 : 2,
    maximumFractionDigits: currency === 'sat' ? 0 : 2,
  });
  return formatter.format(amount);
};

const BalanceCard = ({ 
  currency, 
  amount, 
  lockedAmount,
  isUpdating 
}: { 
  currency: Currency; 
  amount: number; 
  lockedAmount: number;
  isUpdating: boolean;
}) => (
  <div className={`bg-white rounded-lg shadow p-4 transition-all duration-300 ${
    isUpdating ? 'scale-105 ring-2 ring-blue-500' : ''
  }`}>
    <div className="flex justify-between items-center">
      <div>
        <h3 className="text-lg font-semibold uppercase">{currency}</h3>
        <p className="text-2xl">{formatBalance(amount, currency)}</p>
      </div>
      {lockedAmount > 0 && (
        <div className="text-right">
          <div className="flex items-center text-gray-500 gap-1">
            <Lock className="w-4 h-4" />
            <span>Locked</span>
          </div>
          <p className="text-gray-500">{formatBalance(lockedAmount, currency)}</p>
        </div>
      )}
    </div>
  </div>
);

const RelayStatusBadge = ({ 
    relay, 
    status,
    onRemove 
  }: { 
    relay: string; 
    status: RelayStatus;
    onRemove: (relay: string) => void;
  }) => {
    const statusStyles = {
      connecting: 'bg-blue-100 text-blue-800',
      connected: 'bg-green-100 text-green-800',
      disconnected: 'bg-red-100 text-red-800'
    };
  
    return (
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-green-500' :
            status === 'connecting' ? 'bg-blue-500' :
            'bg-red-500'
          }`} />
          <span>{relay}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 rounded ${statusStyles[status]}`}>
            {status}
          </span>
          <button
            onClick={() => onRemove(relay)}
            className="text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      </div>
    );
  };

  const CreateOrderModal = ({ 
    onSubmit, 
    onClose, 
    availableBalances 
  }: { 
    onSubmit: (order: OrderRequest) => Promise<void>;
    onClose: () => void;
    availableBalances: Record<string, number>;
  }) => {
    const [error, setError] = useState<string | null>(null);
    const [orderData, setOrderData] = useState<OrderRequest>({
      kind: 'buy',
      make_amount: 0,
      make_denomination: 'sat',
      take_amount: 0,
      take_denomination: 'brl'
    });
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
  
      if (orderData.make_amount <= 0 || orderData.take_amount <= 0) {
        setError('Amounts must be greater than 0');
        return;
      }
  
      if (orderData.make_amount > availableBalances[orderData.make_denomination]) {
        setError('Insufficient balance');
        return;
      }
  
      try {
        await onSubmit(orderData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create order');
      }
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg w-full max-w-md">
          <h3 className="text-xl font-bold mb-4">Create Order</h3>
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
  
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Order Type</label>
              <select
                className="w-full p-2 border rounded"
                value={orderData.kind}
                onChange={(e) => setOrderData({
                  ...orderData,
                  kind: e.target.value as 'buy' | 'sell'
                })}
              >
                <option value="buy">BUY</option>
                <option value="sell">SELL</option>
              </select>
            </div>
  
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Make Amount</label>
                <input
                  type="number"
                  step="any"
                  className="w-full p-2 border rounded"
                  value={orderData.make_amount}
                  onChange={(e) => setOrderData({
                    ...orderData,
                    make_amount: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Make Currency</label>
                <select
                    className="w-full p-2 border rounded"
                    value={orderData.make_denomination}
                    onChange={(e) => setOrderData({
                        ...orderData,
                        make_denomination: e.target.value as Currency
                    })}
                    >
                    {DENOMINATIONS.map(denom => (
                        <option key={denom} value={denom}>
                        {denom.toUpperCase()}
                        </option>
                    ))}
                </select>
                <div className="text-sm text-gray-500 mt-1">
                  Available: {availableBalances[orderData.make_denomination]}
                </div>
              </div>
            </div>
  
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Take Amount</label>
                <input
                  type="number"
                  step="any"
                  className="w-full p-2 border rounded"
                  value={orderData.take_amount}
                  onChange={(e) => setOrderData({
                    ...orderData,
                    take_amount: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Take Currency</label>
                <select
                    className="w-full p-2 border rounded"
                    value={orderData.take_denomination}
                    onChange={(e) => setOrderData({
                        ...orderData,
                        take_denomination: e.target.value as Currency
                    })}
                    >
                    {DENOMINATIONS.map(denom => (
                        <option key={denom} value={denom}>
                        {denom.toUpperCase()}
                        </option>
                    ))}
                </select>
              </div>
            </div>
  
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Create Order
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const AddRelayModal = ({ 
    onAdd, 
    onClose 
  }: { 
    onAdd: (relay: string) => void; 
    onClose: () => void;
  }) => {
    const [newRelay, setNewRelay] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newRelay) {
        onAdd(newRelay);
        onClose();
      }
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg w-full max-w-md">
          <h3 className="text-xl font-bold mb-4">Add New Relay</h3>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={newRelay}
              onChange={(e) => setNewRelay(e.target.value)}
              placeholder="wss://relay.example.com"
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  export default function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [balances, setBalances] = useState<Balances>({
      sat: 212121,
      brl: 4242,
      usd: 1031,
      eur: 2140,
      chf: 6102
    });
    const [lockedBalances, setLockedBalances] = useState<Balances>({
      sat: 0,
      brl: 0,
      usd: 0,
      eur: 0,
      chf: 0
    });
    const MIN_BALANCES: Balances = {
      sat: 0,    // 1k sats
      brl: 0,      // 10 BRL
      usd: 0,      // 10 USD
      eur: 0,      // 10 EUR
      chf: 0       // 10 CHF
    };
    const [updatingBalances, setUpdatingBalances] = useState<Set<Currency>>(new Set());
    const [showAddRelay, setShowAddRelay] = useState(false);
    const [showCreateOrder, setShowCreateOrder] = useState(false);
    const [relays, setRelays] = useState<string[]>([]);
    const [relayStatuses, setRelayStatuses] = useState<Record<string, RelayStatus>>({});
    const [relayConnections, setRelayConnections] = useState<Record<string, WebSocket>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    

    const connectToRelay = useCallback((relay: string) => {
      setRelayStatuses(prev => ({ ...prev, [relay]: 'connecting' }));
  
      try {
        const ws = new WebSocket(relay);
  
        ws.onopen = () => {
          setRelayStatuses(prev => ({ ...prev, [relay]: 'connected' }));
        };
  
        ws.onclose = () => {
          setRelayStatuses(prev => ({ ...prev, [relay]: 'disconnected' }));
          setTimeout(() => {
            setRelayStatuses(prev => ({ ...prev, [relay]: 'connecting' }));
            connectToRelay(relay);
          }, 5000);
        };
  
        ws.onerror = () => {
          setRelayStatuses(prev => ({ ...prev, [relay]: 'disconnected' }));
        };
  
        setRelayConnections(prev => ({ ...prev, [relay]: ws }));
        return ws;
      } catch (error) {
        console.error(`Failed to connect to ${relay}:`, error);
        setRelayStatuses(prev => ({ ...prev, [relay]: 'disconnected' }));
      }
    }, []);
  
    const addRelay = useCallback((newRelay: string) => {
      setRelays(prev => [...prev, newRelay]);
    }, []);
  
    const removeRelay = useCallback((relayToRemove: string) => {
      relayConnections[relayToRemove]?.close();
      setRelayConnections(prev => {
        const newConnections = { ...prev };
        delete newConnections[relayToRemove];
        return newConnections;
      });
      setRelayStatuses(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[relayToRemove];
        return newStatuses;
      });
      setRelays(prev => prev.filter(relay => relay !== relayToRemove));
    }, [relayConnections]);
  
    useEffect(() => {
      relays.forEach(relay => {
        if (!relayConnections[relay]) {
          connectToRelay(relay);
        }
      });
  
      return () => {
        Object.values(relayConnections).forEach(ws => ws?.close());
      };
    }, [relays, connectToRelay, relayConnections]);
    


    useEffect(() => {
      const fetchOrders = async () => {
        try {
          setLoading(true);
          const data = await api.getOrders();
          setOrders(data);
          setError(null);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          setError('Failed to fetch orders');
        } finally {
          setLoading(false);
        }
      };
  
      fetchOrders();
      const interval = setInterval(fetchOrders, 10000);
      return () => clearInterval(interval);
    }, []);
  
    const handleCreateOrder = async (orderRequest: OrderRequest) => {
      try {
        // Check if balance would go below minimum
        const remainingBalance = balances[orderRequest.make_denomination] - orderRequest.make_amount;
        if (remainingBalance < MIN_BALANCES[orderRequest.make_denomination]) {
          throw new Error(`Balance would go below minimum required for ${orderRequest.make_denomination.toUpperCase()}`);
        }
  
        const newOrder = await api.createOrder(orderRequest);
        setOrders(prev => [...prev, newOrder]);
        
        // Show animation
        setUpdatingBalances(prev => new Set(prev).add(orderRequest.make_denomination));
        
        // Lock the balance and reduce available amount
        setLockedBalances(prev => ({
          ...prev,
          [orderRequest.make_denomination]: 
            (prev[orderRequest.make_denomination] || 0) + orderRequest.make_amount
        }));
        
        setBalances(prev => ({
          ...prev,
          [orderRequest.make_denomination]: 
            prev[orderRequest.make_denomination] - orderRequest.make_amount
        }));
  
        // Remove animation after delay
        setTimeout(() => {
          setUpdatingBalances(prev => {
            const next = new Set(prev);
            next.delete(orderRequest.make_denomination);
            return next;
          });
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create order');
      }
    };
  
    const handleTakeOrder = async (order: Order) => {
      try {
        // Check if taker has enough balance
        if (balances[order.take_denomination] < order.take_amount) {
          throw new Error(`Insufficient ${order.take_denomination.toUpperCase()} balance`);
        }
  
        await api.deleteOrder(order.id);
        setOrders(prev => prev.filter(o => o.id !== order.id));
  
        // Show animation for both currencies
        setUpdatingBalances(prev => new Set([...prev, order.make_denomination, order.take_denomination]));
  
        // Update taker's balances
        setBalances(prev => ({
          ...prev,
          [order.take_denomination]: prev[order.take_denomination] - order.take_amount,
          [order.make_denomination]: prev[order.make_denomination] + order.make_amount
        }));
  
        // Release locked amount
        setLockedBalances(prev => ({
          ...prev,
          [order.make_denomination]: prev[order.make_denomination] - order.make_amount
        }));
  
        // Remove animation after delay
        setTimeout(() => {
          setUpdatingBalances(new Set());
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to take order');
      }
    };

    return (
        <div className="container mx-auto p-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
    
          {/* This is the balances section we're fixing */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CircleDollarSign className="w-6 h-6" />
              Balances
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.entries(balances) as [Currency, number][]).map(([currency, amount]) => (
                <BalanceCard
                  key={currency}
                  currency={currency}
                  amount={amount}
                  lockedAmount={lockedBalances[currency]}
                  isUpdating={updatingBalances.has(currency)}
                />
              ))}
            </div>
          </div>

      {/* Relays */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LinkIcon className="w-6 h-6" />
            Relays
          </h2>
          <button
            onClick={() => setShowAddRelay(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Relay
          </button>
        </div>
        <div className="bg-white rounded-lg shadow">
          {relays.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No relays connected. Add a relay to get started.
            </div>
          ) : (
            relays.map(relay => (
                <RelayStatusBadge
                    key={relay}
                    relay={relay}
                    status={relayStatuses[relay] || 'disconnected'}
                    onRemove={removeRelay}
                />
            ))
          )}
        </div>
      </div>

      {/* Orders */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Orders</h2>
          <button
            onClick={() => setShowCreateOrder(true)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Order
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          {loading ? (
            <div className="p-4 text-center">Loading...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Order Type</th>
                  <th className="px-4 py-2 text-left">Maker</th>
                  <th className="px-4 py-2 text-left">Taker</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-t">
                    <td className="px-4 py-2">
                      <span className={`capitalize ${
                        order.kind === 'buy' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {order.kind}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {order.make_amount} {order.make_denomination.toUpperCase()}
                    </td>
                    <td className="px-4 py-2">
                      {order.take_amount} {order.take_denomination.toUpperCase()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleTakeOrder(order)}
                        className="text-blue-500 hover:text-blue-700 bg-blue"
                      >
                        Take Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddRelay && (
        <AddRelayModal
          onAdd={addRelay}
          onClose={() => setShowAddRelay(false)}
        />
      )}

      {showCreateOrder && (
        <CreateOrderModal
          onSubmit={handleCreateOrder}
          onClose={() => setShowCreateOrder(false)}
          availableBalances={balances}
        />
      )}
    </div>
  );
}