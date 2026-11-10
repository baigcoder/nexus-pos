import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner, tenantMismatchResponse } from '@/lib/api-auth'


export const dynamic = 'force-dynamic'

export type RestaurantArchetype = 'cafe' | 'full_service' | 'ghost_kitchen'

interface ArchetypeTemplate {
    tables: { table_number: string; capacity: number }[]
    categories: {
        name: string
        description: string
        display_order: number
        items: {
            name: string
            description: string
            price: number
            cost_price: number
            preparation_time: number
            customizations?: any[]
        }[]
    }[]
    registers: string[]
}

const ARCHETYPE_TEMPLATES: Record<RestaurantArchetype, ArchetypeTemplate> = {
    cafe: {
        tables: [
            { table_number: 'C-01', capacity: 2 },
            { table_number: 'C-02', capacity: 2 },
            { table_number: 'C-03', capacity: 4 },
            { table_number: 'C-04', capacity: 4 },
            { table_number: 'Bar-1', capacity: 1 },
            { table_number: 'Bar-2', capacity: 1 },
            { table_number: 'Patio-1', capacity: 4 },
            { table_number: 'Patio-2', capacity: 4 },
        ],
        categories: [
            {
                name: 'Espresso & Hot Coffee',
                description: 'Specialty roasted espresso-based beverages',
                display_order: 1,
                items: [
                    {
                        name: 'Double Shot Flat White',
                        description: 'Double ristretto with micro-foamed whole milk',
                        price: 550,
                        cost_price: 120,
                        preparation_time: 4,
                        customizations: [
                            {
                                name: 'Milk Choice',
                                type: 'single',
                                options: [
                                    { name: 'Whole Milk', price_modifier: 0 },
                                    { name: 'Oat Milk', price_modifier: 120 },
                                    { name: 'Almond Milk', price_modifier: 100 },
                                ],
                            },
                            {
                                name: 'Extra Shot',
                                type: 'single',
                                options: [
                                    { name: 'None', price_modifier: 0 },
                                    { name: 'Add Extra Espresso Shot', price_modifier: 150 },
                                ],
                            },
                        ],
                    },
                    {
                        name: 'Classic Spanish Latte',
                        description: 'Espresso poured over condensed and steamed milk',
                        price: 650,
                        cost_price: 140,
                        preparation_time: 5,
                    },
                    {
                        name: 'Americano Classico',
                        description: 'Rich double espresso diluted with hot filtered water',
                        price: 450,
                        cost_price: 60,
                        preparation_time: 3,
                    },
                ],
            },
            {
                name: 'Pastries & Fresh Bakery',
                description: 'Freshly baked viennoiseries and treats daily',
                display_order: 2,
                items: [
                    {
                        name: 'Butter Croissant',
                        description: 'Golden flaky French all-butter croissant',
                        price: 390,
                        cost_price: 95,
                        preparation_time: 2,
                    },
                    {
                        name: 'Pain au Chocolat',
                        description: 'Viennoiserie layered with Belgian dark chocolate batons',
                        price: 450,
                        cost_price: 110,
                        preparation_time: 2,
                    },
                    {
                        name: 'Blueberry Cream Muffin',
                        description: 'Wild blueberry muffin with streusel crumble topping',
                        price: 420,
                        cost_price: 105,
                        preparation_time: 2,
                    },
                ],
            },
            {
                name: 'Artisan Sandwiches',
                description: 'Toasted sourdough sandwiches and savories',
                display_order: 3,
                items: [
                    {
                        name: 'Smoked Turkey & Swiss Toastie',
                        description: 'Sourdough melt with smoked turkey, Swiss cheese, and dijon mustard',
                        price: 850,
                        cost_price: 260,
                        preparation_time: 8,
                    },
                    {
                        name: 'Caprese Pesto Panini',
                        description: 'Fresh mozzarella, roma tomatoes, basil pesto on ciabatta',
                        price: 780,
                        cost_price: 230,
                        preparation_time: 7,
                    },
                ],
            },
        ],
        registers: ['Main Barista POS', 'Grab & Go Counter'],
    },
    full_service: {
        tables: [
            { table_number: 'T-01', capacity: 2 },
            { table_number: 'T-02', capacity: 2 },
            { table_number: 'T-03', capacity: 4 },
            { table_number: 'T-04', capacity: 4 },
            { table_number: 'T-05', capacity: 4 },
            { table_number: 'T-06', capacity: 6 },
            { table_number: 'T-07', capacity: 6 },
            { table_number: 'T-08', capacity: 8 },
            { table_number: 'VIP-1', capacity: 10 },
            { table_number: 'VIP-2', capacity: 12 },
        ],
        categories: [
            {
                name: 'Starters & Small Plates',
                description: 'Appetizers and sharing platters',
                display_order: 1,
                items: [
                    {
                        name: 'Truffle Parmesan Fries',
                        description: 'Crisp shoestring fries tossed in white truffle oil and reggiano',
                        price: 750,
                        cost_price: 180,
                        preparation_time: 10,
                    },
                    {
                        name: 'Dynamite Tempura Prawns',
                        description: 'Crispy tiger prawns tossed in spicy sriracha tobiko glaze',
                        price: 1450,
                        cost_price: 450,
                        preparation_time: 12,
                    },
                ],
            },
            {
                name: 'Steaks & Chef Grills',
                description: 'Prime cuts grilled to perfection over charcoal',
                display_order: 2,
                items: [
                    {
                        name: 'Prime Black Angus Ribeye (350g)',
                        description: 'Grilled ribeye with rosemary garlic butter, served with demi-glace',
                        price: 4200,
                        cost_price: 1850,
                        preparation_time: 22,
                        customizations: [
                            {
                                name: 'Doneness',
                                type: 'single',
                                options: [
                                    { name: 'Medium Rare', price_modifier: 0 },
                                    { name: 'Medium', price_modifier: 0 },
                                    { name: 'Medium Well', price_modifier: 0 },
                                    { name: 'Well Done', price_modifier: 0 },
                                ],
                            },
                            {
                                name: 'Sauce Choice',
                                type: 'single',
                                options: [
                                    { name: 'Green Peppercorn', price_modifier: 0 },
                                    { name: 'Mushroom Truffle Cream', price_modifier: 150 },
                                    { name: 'Chimichurri', price_modifier: 0 },
                                ],
                            },
                        ],
                    },
                    {
                        name: 'Charcoal Grilled Half Chicken',
                        description: 'Marinated in smoked paprika, garlic, lemon, served with grilled vegetables',
                        price: 1850,
                        cost_price: 620,
                        preparation_time: 18,
                    },
                ],
            },
            {
                name: 'Artisan Pastas',
                description: 'Handcrafted pasta tossed in house sauces',
                display_order: 3,
                items: [
                    {
                        name: 'Tagliatelle Funghi e Tartufo',
                        description: 'Wild forest mushrooms, black truffle paste, parmigiano cream',
                        price: 1650,
                        cost_price: 420,
                        preparation_time: 14,
                    },
                    {
                        name: 'Rigatoni Spicy Arrabbiata',
                        description: 'San Marzano plum tomatoes, chili flakes, roasted garlic, fresh basil',
                        price: 1350,
                        cost_price: 290,
                        preparation_time: 12,
                    },
                ],
            },
        ],
        registers: ['Host Stand POS', 'Bar Service Register'],
    },
    ghost_kitchen: {
        tables: [
            { table_number: 'Dispatch Bay A', capacity: 1 },
            { table_number: 'Dispatch Bay B', capacity: 1 },
            { table_number: 'Takeaway Shelf 1', capacity: 1 },
            { table_number: 'Takeaway Shelf 2', capacity: 1 },
        ],
        categories: [
            {
                name: 'Smash Burgers',
                description: 'Double smashed beef patties with potato buns',
                display_order: 1,
                items: [
                    {
                        name: 'OG Double Cheese Smash',
                        description: 'Two smashed patties, American cheddar, secret sauce, pickles',
                        price: 950,
                        cost_price: 310,
                        preparation_time: 8,
                        customizations: [
                            {
                                name: 'Add Bacon',
                                type: 'single',
                                options: [
                                    { name: 'No Bacon', price_modifier: 0 },
                                    { name: 'Crispy Beef Bacon Strip', price_modifier: 180 },
                                ],
                            },
                        ],
                    },
                    {
                        name: 'Nashville Hot Crispy Chicken',
                        description: 'Buttermilk fried chicken breast dipped in Nashville hot oil with coleslaw',
                        price: 990,
                        cost_price: 330,
                        preparation_time: 10,
                    },
                ],
            },
            {
                name: 'Wings & Loaded Sides',
                description: 'Crispy bone-in wings and loaded fries',
                display_order: 2,
                items: [
                    {
                        name: 'Crispy Buffalo Wings (8pcs)',
                        description: 'Tossed in tangy hot cayenne buffalo sauce with blue cheese ranch',
                        price: 890,
                        cost_price: 280,
                        preparation_time: 9,
                    },
                    {
                        name: 'Cheese Sauce Loaded Fries',
                        description: 'Fries smothered in warm cheddar cheese sauce and jalapeño crisps',
                        price: 650,
                        cost_price: 160,
                        preparation_time: 6,
                    },
                ],
            },
        ],
        registers: ['Kitchen Dispatch Station'],
    },
}

export async function POST(request: NextRequest) {
    try {
        const { auth, response } = await requireOwner()(request)
        if (response) return response

        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
        }

        const { restaurant_id, archetype = 'full_service', currency = 'PKR',
            tax_rate = 16.0, wipe_existing_catalog } = body
        if (restaurant_id !== undefined && restaurant_id !== auth.restaurantId) return tenantMismatchResponse()
        if (wipe_existing_catalog !== undefined && wipe_existing_catalog !== false) {
            return NextResponse.json({ success: false, error: 'Catalog reset is unavailable in onboarding' }, { status: 400 })
        }
        if (typeof archetype !== 'string' || !Object.hasOwn(ARCHETYPE_TEMPLATES, archetype) ||
            typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) ||
            typeof tax_rate !== 'number' || !Number.isFinite(tax_rate) || tax_rate < 0 || tax_rate > 100 || Number(tax_rate.toFixed(2)) !== tax_rate) {
            return NextResponse.json({ success: false, error: 'Invalid template, currency, or tax rate' }, { status: 400 })
        }

        const { data, error } = await createAdminClient().rpc('bootstrap_restaurant_template', {
            p_restaurant_id: auth.restaurantId,
            p_staff_id: auth.staffId,
            p_archetype: archetype,
            p_currency: currency,
            p_tax_rate: tax_rate,
            p_template: ARCHETYPE_TEMPLATES[archetype as RestaurantArchetype],
        })
        if (error) throw error
        if (!data.success) {
            const status = data.code === 'forbidden' ? 403 : data.code === 'not_found' ? 404 : 409
            return NextResponse.json({ success: false, error: data.error }, { status })
        }

        return NextResponse.json({ success: true, message: 'Restaurant setup complete', stats: data.stats })
    } catch (error) {
        console.error('[OnboardingBootstrap] Error:', error)
        return NextResponse.json({ success: false, error: 'Restaurant setup failed' }, { status: 500 })
    }
}
