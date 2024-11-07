import { Order, OrderRequest } from '@/types/types';

const API_BASE = 'http://localhost:8080';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, `API Error: ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  async getOrders(): Promise<Order[]> {
    const response = await fetch(`${API_BASE}/orders`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return handleResponse<Order[]>(response);
  },

  async createOrder(order: OrderRequest): Promise<Order> {
    const response = await fetch(`${API_BASE}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });
    return handleResponse<Order>(response);
  },

  async deleteOrder(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/order/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return handleResponse<void>(response);
  }
};