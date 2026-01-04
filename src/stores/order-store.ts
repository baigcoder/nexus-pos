import { create } from 'zustand'
import type { Order, OrderItem, OrderStatus, MenuItem } from '@/types'

interface CartItem {
    menuItem: MenuItem
    quantity: number
    specialInstructions: string
    customizations: {
        customization_id: string
        customization_name: string
        selected_options: {
            option_id: string
            option_name: string
            price_modifier: number
        }[]
    }[]
}

interface OrderState {
    // Current order being created
    currentTableId: string | null
    cart: CartItem[]
    orderNotes: string

    // Active orders (for kitchen display)
    activeOrders: Order[]

    // Actions for cart
    setCurrentTable: (tableId: string | null) => void
    addToCart: (item: CartItem) => void
    updateCartItemQuantity: (menuItemId: string, quantity: number) => void
    removeFromCart: (menuItemId: string) => void
    updateCartItemInstructions: (menuItemId: string, instructions: string) => void
    setOrderNotes: (notes: string) => void
    clearCart: () => void

    // Actions for active orders
    setActiveOrders: (orders: Order[]) => void
    addOrder: (order: Order) => void
    updateOrderStatus: (orderId: string, status: OrderStatus) => void
    updateOrderItemStatus: (orderId: string, itemId: string, status: OrderItem['status']) => void
    removeOrder: (orderId: string) => void

    // Computed
    getCartTotal: () => number
    getCartItemCount: () => number
}

export const useOrderStore = create<OrderState>((set, get) => ({
    // Initial state
    currentTableId: null,
    cart: [],
    orderNotes: '',
    activeOrders: [],

    // Cart actions
    setCurrentTable: (tableId) => set({ currentTableId: tableId }),

    addToCart: (item) => set((state) => {
        const existingIndex = state.cart.findIndex(
            (cartItem) =>
                cartItem.menuItem.id === item.menuItem.id &&
                cartItem.specialInstructions === item.specialInstructions &&
                JSON.stringify(cartItem.customizations) === JSON.stringify(item.customizations)
        )

        if (existingIndex >= 0) {
            const newCart = [...state.cart]
            newCart[existingIndex].quantity += item.quantity
            return { cart: newCart }
        }

        return { cart: [...state.cart, item] }
    }),

    updateCartItemQuantity: (menuItemId, quantity) => set((state) => {
        if (quantity <= 0) {
            return { cart: state.cart.filter((item) => item.menuItem.id !== menuItemId) }
        }

        return {
            cart: state.cart.map((item) =>
                item.menuItem.id === menuItemId ? { ...item, quantity } : item
            ),
        }
    }),

    removeFromCart: (menuItemId) => set((state) => ({
        cart: state.cart.filter((item) => item.menuItem.id !== menuItemId),
    })),

    updateCartItemInstructions: (menuItemId, instructions) => set((state) => ({
        cart: state.cart.map((item) =>
            item.menuItem.id === menuItemId
                ? { ...item, specialInstructions: instructions }
                : item
        ),
    })),

    setOrderNotes: (notes) => set({ orderNotes: notes }),

    clearCart: () => set({
        cart: [],
        orderNotes: '',
        currentTableId: null
    }),

    // Active orders actions
    setActiveOrders: (orders) => set({ activeOrders: orders }),

    addOrder: (order) => set((state) => ({
        activeOrders: [order, ...state.activeOrders],
    })),

    updateOrderStatus: (orderId, status) => set((state) => ({
        activeOrders: state.activeOrders.map((order) =>
            order.id === orderId ? { ...order, status } : order
        ),
    })),

    updateOrderItemStatus: (orderId, itemId, status) => set((state) => ({
        activeOrders: state.activeOrders.map((order) =>
            order.id === orderId
                ? {
                    ...order,
                    items: order.items?.map((item) =>
                        item.id === itemId ? { ...item, status } : item
                    ),
                }
                : order
        ),
    })),

    removeOrder: (orderId) => set((state) => ({
        activeOrders: state.activeOrders.filter((order) => order.id !== orderId),
    })),

    // Computed values
    getCartTotal: () => {
        const { cart } = get()
        return cart.reduce((total, item) => {
            const itemPrice = item.menuItem.price
            const customizationPrice = item.customizations.reduce(
                (sum, c) => sum + c.selected_options.reduce((s, o) => s + o.price_modifier, 0),
                0
            )
            return total + (itemPrice + customizationPrice) * item.quantity
        }, 0)
    },

    getCartItemCount: () => {
        const { cart } = get()
        return cart.reduce((count, item) => count + item.quantity, 0)
    },
}))
