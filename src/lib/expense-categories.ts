export interface ExpenseCategory {
    key: string
    label: string
    keywords: string[]
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    {
        key: 'ingredients',
        label: 'Ingredients & Food',
        keywords: ['flour', 'sugar', 'oil', 'rice', 'meat', 'chicken', 'vegetable', 'dairy', 'milk', 'cheese', 'bread', 'spice', 'salt', 'sauce', 'ingredient', 'raw', 'produce', 'fruit', 'fish', 'beef', 'mutton', 'lamb', 'seafood', 'onion', 'tomato', 'potato', 'garlic', 'ginger', 'butter', 'cream', 'egg', 'flour'],
    },
    {
        key: 'utilities',
        label: 'Utilities',
        keywords: ['electricity', 'gas', 'water', 'internet', 'wifi', 'phone', 'utility', 'bill', 'electric', 'power', 'connection', 'broadband', 'telecom'],
    },
    {
        key: 'salary',
        label: 'Salaries & Wages',
        keywords: ['salary', 'wage', 'pay', 'payroll', 'staff', 'employee', 'worker', 'bonus', 'overtime', 'compensation', 'contractor'],
    },
    {
        key: 'supplies',
        label: 'Supplies & Equipment',
        keywords: ['equipment', 'supply', 'supplies', 'kitchen', 'utensil', 'plate', 'glass', 'napkin', 'cleaning', 'detergent', 'soap', 'paper', 'tissue', 'menu', 'apron', 'uniform', 'tool', 'machine', 'appliance'],
    },
    {
        key: 'maintenance',
        label: 'Maintenance & Repair',
        keywords: ['repair', 'maintenance', 'fix', 'plumbing', 'ac', 'hvac', 'paint', 'renovation', 'painting', 'carpenter', 'electrician', 'service', 'inspection'],
    },
    {
        key: 'rent',
        label: 'Rent & Lease',
        keywords: ['rent', 'lease', 'property', 'building', 'space', 'mortgage', 'landlord'],
    },
    {
        key: 'marketing',
        label: 'Marketing & Advertising',
        keywords: ['ads', 'advertising', 'marketing', 'social media', 'promo', 'promotion', 'flyer', 'banner', 'branding', 'logo', 'website', 'digital', 'campaign'],
    },
    {
        key: 'transport',
        label: 'Transport & Delivery',
        keywords: ['fuel', 'gas', 'petrol', 'transport', 'delivery', 'vehicle', 'bike', 'car', 'rickshaw', 'logistics', 'shipping', 'courier'],
    },
    {
        key: 'tax',
        label: 'Tax & Compliance',
        keywords: ['tax', 'gst', 'sales tax', 'income tax', 'fbr', 'government', 'license', 'permit', 'registration', 'compliance', 'audit'],
    },
    {
        key: 'other',
        label: 'Other',
        keywords: [],
    },
]

export function categorizeExpense(description: string): ExpenseCategory {
    const lower = description.toLowerCase()
    for (const category of EXPENSE_CATEGORIES) {
        if (category.key === 'other') continue
        if (category.keywords.some(kw => lower.includes(kw))) {
            return category
        }
    }
    return EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
}

export function getCategoryLabel(key: string): string {
    return EXPENSE_CATEGORIES.find(c => c.key === key)?.label ?? key
}