import type { MenuItem, Category, MenuCustomization } from '@/types'

export const ALLERGENS = [
    'milk', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts',
    'wheat', 'soybeans', 'celery', 'mustard', 'sesame',
    'sulfur_dioxide', 'lupin', 'molluscs',
] as const

export type Allergen = typeof ALLERGENS[number]

export const ALLERGEN_LABELS: Record<Allergen, string> = {
    milk: 'Milk',
    eggs: 'Eggs',
    fish: 'Fish',
    shellfish: 'Shellfish',
    tree_nuts: 'Tree Nuts',
    peanuts: 'Peanuts',
    wheat: 'Wheat',
    soybeans: 'Soy',
    celery: 'Celery',
    mustard: 'Mustard',
    sesame: 'Sesame',
    sulfur_dioxide: 'Sulfites',
    lupin: 'Lupin',
    molluscs: 'Molluscs',
}

export const DIETARY_TAG_OPTIONS = [
    { value: 'vegan', label: 'Vegan', color: 'bg-green-500/20 text-green-600' },
    { value: 'vegetarian', label: 'Vegetarian', color: 'bg-emerald-500/20 text-emerald-600' },
    { value: 'spicy', label: 'Spicy', color: 'bg-red-500/20 text-red-600' },
    { value: 'gluten-free', label: 'Gluten-Free', color: 'bg-amber-500/20 text-amber-600' },
    { value: 'halal', label: 'Halal', color: 'bg-blue-500/20 text-blue-600' },
    { value: 'dairy-free', label: 'Dairy-Free', color: 'bg-purple-500/20 text-purple-600' },
    { value: 'keto', label: 'Keto', color: 'bg-orange-500/20 text-orange-600' },
    { value: 'organic', label: 'Organic', color: 'bg-lime-500/20 text-lime-600' },
] as const

export const CATEGORY_ICONS = [
    { value: 'tag', label: 'Tag' },
    { value: 'utensils', label: 'Utensils' },
    { value: 'coffee', label: 'Coffee' },
    { value: 'pizza', label: 'Pizza' },
    { value: 'beef', label: 'Beef' },
    { value: 'wine', label: 'Wine' },
    { value: 'icecream', label: 'Dessert' },
    { value: 'layers', label: 'Layers' },
    { value: 'soup', label: 'Soup' },
    { value: 'salad', label: 'Salad' },
    { value: 'bread', label: 'Bread' },
    { value: 'cake', label: 'Cake' },
] as const

export const MENU_TEMPLATES: Record<string, { categories: string[]; description: string }> = {
    'quick-service': {
        categories: ['Burgers', 'Sides', 'Beverages', 'Desserts'],
        description: 'Quick Service Restaurant',
    },
    'fine-dining': {
        categories: ['Starters', 'Mains', 'Desserts', 'Beverages', 'Wine List'],
        description: 'Fine Dining',
    },
    'cafe': {
        categories: ['Hot Drinks', 'Cold Drinks', 'Pastries', 'Sandwiches', 'Salads'],
        description: 'Café / Coffee Shop',
    },
    'pizzeria': {
        categories: ['Pizza', 'Pasta', 'Salads', 'Desserts', 'Beverages'],
        description: 'Pizzeria',
    },
    'desi': {
        categories: ['Starters', 'BBQ & Grills', 'Curries', 'Breads & Rice', 'Desserts', 'Beverages'],
        description: 'Desi / South Asian',
    },
}

export function generateId(): string {
    return Math.random().toString(36).substring(2, 11)
}

export function createEmptyCustomization(): MenuCustomization {
    return {
        id: generateId(),
        name: '',
        type: 'single',
        required: false,
        options: [],
    }
}

export function createEmptyOption(): { id: string; name: string; price_modifier: number } {
    return { id: generateId(), name: '', price_modifier: 0 }
}

export function cloneMenuItem(item: MenuItem, newName?: string): Partial<MenuItem> {
    return {
        ...item,
        id: undefined as unknown as string,
        name: newName || `${item.name} (Copy)`,
        created_at: undefined as unknown as string,
        updated_at: undefined as unknown as string,
        customizations: item.customizations.map(c => ({
            ...c,
            id: generateId(),
            options: c.options.map(o => ({ ...o, id: generateId() })),
        })),
    }
}

export function exportMenuToCSV(categories: Category[], items: MenuItem[]): string {
    const headers = ['Category', 'Name', 'Description', 'Price', 'Cost Price', 'Dietary Tags', 'Allergens', 'Is Available', 'Is Special', 'Prep Time (min)', 'Calories']
    const rows = items.map(item => {
        const cat = categories.find(c => c.id === item.category_id)
        return [
            cat?.name || '',
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.description || '').replace(/"/g, '""')}"`,
            item.price,
            item.cost_price || 0,
            (item.dietary_tags || []).join(';'),
            (item.allergens || []).join(';'),
            item.is_available ? 'Yes' : 'No',
            item.is_special ? 'Yes' : 'No',
            item.preparation_time || '',
            item.calories || '',
        ].join(',')
    })
    return [headers.join(','), ...rows].join('\n')
}

export function parseCSVToItems(csv: string, categoryId: string): { name: string; price: number; description: string; dietary_tags: string[]; category_id: string }[] {
    const lines = csv.trim().split('\n')
    if (lines.length < 2) return []

    return lines.slice(1).map(line => {
        const parts = line.match(/(".*?"|[^,]+)/g)?.map(s => s.replace(/^"|"$/g, '').trim()) || []
        return {
            name: parts[1] || 'Unnamed',
            price: parseFloat(parts[3]) || 0,
            description: parts[2] || '',
            dietary_tags: parts[5] ? parts[5].split(';').filter(Boolean) : [],
            category_id: categoryId,
        }
    }).filter(item => item.name && item.price > 0)
}

export function calculateMargin(price: number, costPrice: number): number {
    if (price <= 0) return 0
    return Math.round(((price - costPrice) / price) * 100)
}

export function getMarginColor(margin: number): string {
    if (margin >= 70) return 'text-emerald-500'
    if (margin >= 50) return 'text-amber-500'
    if (margin >= 30) return 'text-orange-500'
    return 'text-rose-500'
}

export function formatCurrency(amount: number, currency: string = 'PKR'): string {
    if (currency === 'PKR') return `Rs ${amount.toLocaleString()}`
    return `${currency} ${amount.toLocaleString()}`
}

export const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
]