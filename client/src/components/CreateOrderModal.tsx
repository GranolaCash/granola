import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OrderRequest, Currency, OrderType } from '@/types/types';

const DENOMINATIONS: Currency[] = ['sat', 'brl', 'usd', 'eur', 'chf'];
const ORDER_TYPES: OrderType[] = ['buy', 'sell'];

interface CreateOrderModalProps {
  onSubmit: (order: OrderRequest) => Promise<void>;
  onClose: () => void;
  availableBalances: Record<Currency, number>;
}

export function CreateOrderModal({ onSubmit, onClose, availableBalances }: CreateOrderModalProps) {
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

    // Validate amounts
    if (orderData.make_amount <= 0 || orderData.take_amount <= 0) {
      setError('Amounts must be greater than 0');
      return;
    }

    // Check available balance
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
        <h3 className="text-xl font-bold mb-4">Create New Order</h3>
        
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
                kind: e.target.value as OrderType
              })}
            >
              {ORDER_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
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
              <label className="block text-sm font-medium mb-1">Denomination</label>
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
              <label className="block text-sm font-medium mb-1">You pay</label>
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
              <label className="block text-sm font-medium mb-1">You get</label>
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

          <div className="flex justify-end gap-2 mt-6">
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
}