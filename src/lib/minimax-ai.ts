// OpenRouter AI Integration - Advanced Restaurant Analytics
// Sign up at https://openrouter.ai for a free API key

interface OpenRouterResponse {
    id: string
    choices: {
        finish_reason: string
        index: number
        message: {
            role: string
            content: string
        }
    }[]
    usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

interface AIExpense {
    description: string
    category: 'ingredients' | 'utilities' | 'salary' | 'supplies' | 'maintenance' | 'other'
    suggested_vendor?: string
    confidence: number
    reasoning?: string
}

const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY || ''
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'liquid/lfm-2.5-1.2b-instruct:free'

const EXPENSE_CATEGORIES = ['ingredients', 'utilities', 'salary', 'supplies', 'maintenance', 'other']

// Restaurant-specific system prompt
const RESTAURANT_SYSTEM_PROMPT = `You are an expert Restaurant Business Analyst AI with 15+ years of experience in F&B operations, cost management, and menu optimization.

Your expertise includes:
- Restaurant operations and workflow optimization
- Food cost analysis and supplier negotiations
- Menu engineering and pricing strategies
- Labor cost management
- Revenue growth tactics
- Expense reduction strategies
- Trend analysis and forecasting

Always provide actionable, data-driven insights. Format responses as clean JSON.`

export async function analyzeExpenseWithAI(
    text: string,
    amount?: number
): Promise<AIExpense> {
    if (!OPENROUTER_API_KEY) {
        return analyzeExpenseFallback(text, amount)
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'OrderFlow POS'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `${RESTAURANT_SYSTEM_PROMPT}

Analyze restaurant expenses and respond with ONLY valid JSON:
{
    "description": "cleaned expense description (max 100 chars)",
    "category": "ingredients|utilities|salary|supplies|maintenance|other",
    "suggested_vendor": "vendor name or null",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation of categorization"
}

Rules:
- category must be one of: ${EXPENSE_CATEGORIES.join(', ')}
- confidence: 0.5=unsure, 0.7-1.0=confident
- If amount in PKR/Rs, note it for Pakistani market context
- Consider local Pakistani vendors: Makkah Cash & Carry, Sabzi Mandi, local butchers`
                    },
                    {
                        role: 'user',
                        content: amount
                            ? `Analyze expense: "${text}" - Amount: Rs.${amount}`
                            : `Analyze expense: "${text}"`
                    }
                ],
                temperature: 0.3,
                max_tokens: 256
            })
        })

        if (!response.ok) {
            console.error('OpenRouter API error:', response.status)
            return analyzeExpenseFallback(text, amount)
        }

        const data: OpenRouterResponse = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
            return analyzeExpenseFallback(text, amount)
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return {
                description: parsed.description || text,
                category: EXPENSE_CATEGORIES.includes(parsed.category) ? parsed.category : 'other',
                suggested_vendor: parsed.suggested_vendor || undefined,
                confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                reasoning: parsed.reasoning
            }
        }

        return analyzeExpenseFallback(text, amount)
    } catch (err) {
        console.error('OpenRouter AI error:', err)
        return analyzeExpenseFallback(text, amount)
    }
}

export async function generateDashboardInsights(data: {
    revenue: number
    ordersCount: number
    expenses: { amount: number; category: string; expense_date: string }[]
    topItems: { name: string; count: number; revenue: number }[]
    tableOccupancy: { occupied: number; total: number }
    avgOrderValue: number
}): Promise<any> {
    if (!OPENROUTER_API_KEY) {
        return generateFallbackInsights(data)
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'OrderFlow POS'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `${RESTAURANT_SYSTEM_PROMPT}

Analyze this restaurant's daily performance data and provide insights in JSON format:
{
    "summary": "2-3 sentence executive summary",
    "insights": [
        {
            "type": "opportunity|warning|success|info",
            "title": "Short catchy title",
            "description": "Detailed insight with numbers",
            "action": "Recommended action",
            "priority": "high|medium|low",
            "metric": "optional metric value"
        }
    ],
    "recommendations": ["action 1", "action 2", "action 3"],
    "predictions": {
        "nextWeek": "What to expect next week",
        "trends": ["trend 1", "trend 2", "trend 3"]
    }
}

Focus on:
- Revenue vs expenses ratio analysis
- Top-selling item optimization
- Table turnover optimization
- Expense anomaly detection
- Cost-saving opportunities
- Growth opportunities`
                    },
                    {
                        role: 'user',
                        content: `Restaurant Data:
- Today's Revenue: Rs.${data.revenue.toLocaleString()}
- Orders Completed: ${data.ordersCount}
- Avg Order Value: Rs.${data.avgOrderValue.toLocaleString()}
- Table Occupancy: ${data.tableOccupancy.occupied}/${data.tableOccupancy.total}
- Top Items: ${data.topItems.map(i => `${i.name}(${i.count} sold)`).join(', ')}
- Total Expenses: Rs.${data.expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
- Expense Categories: ${Object.entries(data.expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
}, {} as Record<string, number>)).map(([cat, amt]) => `${cat}: Rs.${amt}`).join(', ')}`
                    }
                ],
                temperature: 0.5,
                max_tokens: 1024
            })
        })

        if (!response.ok) {
            return generateFallbackInsights(data)
        }

        const result = await response.json()
        const content = result.choices?.[0]?.message?.content

        if (!content) {
            return generateFallbackInsights(data)
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }

        return generateFallbackInsights(data)
    } catch (err) {
        console.error('Dashboard AI error:', err)
        return generateFallbackInsights(data)
    }
}

export async function analyzeMenuPerformance(menuItems: {
    name: string
    price: number
    orderCount: number
    revenue: number
    category: string
}[]): Promise<{
    starItems: string[]
    problemItems: string[]
    pricingSuggestions: { item: string; currentPrice: number; suggestedPrice: number; reason: string }[]
    opportunities: string[]
}> {
    if (!OPENROUTER_API_KEY || menuItems.length === 0) {
        return { starItems: [], problemItems: [], pricingSuggestions: [], opportunities: [] }
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'OrderFlow POS'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `${RESTAURANT_SYSTEM_PROMPT}

Analyze menu items and provide optimization insights in JSON format:
{
    "starItems": ["item1", "item2"],
    "problemItems": ["item1", "item2"],
    "pricingSuggestions": [
        {
            "item": "item name",
            "currentPrice": 500,
            "suggestedPrice": 600,
            "reason": "reasoning"
        }
    ],
    "opportunities": ["opportunity 1", "opportunity 2"]
}`
                    },
                    {
                        role: 'user',
                        content: `Menu items: ${JSON.stringify(menuItems, null, 2)}`
                    }
                ],
                temperature: 0.4,
                max_tokens: 768
            })
        })

        if (response.ok) {
            const result = await response.json()
            const content = result.choices?.[0]?.message?.content
            if (content) {
                const jsonMatch = content.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0])
                }
            }
        }
    } catch (err) {
        console.error('Menu AI error:', err)
    }

    return { starItems: [], problemItems: [], pricingSuggestions: [], opportunities: [] }
}

export async function generateExpenseReport(expenses: {
    description: string
    amount: number
    category: string
    vendor: string | null
    expense_date: string
}[]): Promise<{
    executiveSummary: string
    costAnalysis: { category: string; amount: number; percentage: number; trend: string }[]
    anomalies: { description: string; amount: number; reason: string }[]
    savingsOpportunities: { category: string; potential: number; action: string }[]
    vendorInsights: { vendor: string; spend: number; frequency: number; recommendation: string }[]
    monthlyTrend: { month: string; amount: number }[]
}> {
    if (!OPENROUTER_API_KEY || expenses.length === 0) {
        return generateExpenseFallbackReport(expenses)
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'OrderFlow POS'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `${RESTAURANT_SYSTEM_PROMPT}

Generate a comprehensive expense report for a Pakistani restaurant in JSON format:
{
    "executiveSummary": "2-3 sentence summary of expense health",
    "costAnalysis": [
        {
            "category": "category name",
            "amount": 50000,
            "percentage": 35,
            "trend": "increasing|decreasing|stable"
        }
    ],
    "anomalies": [
        {
            "description": "expense description",
            "amount": 50000,
            "reason": "why this is unusual"
        }
    ],
    "savingsOpportunities": [
        {
            "category": "category",
            "potential": 10000,
            "action": "specific action to save"
        }
    ],
    "vendorInsights": [
        {
            "vendor": "vendor name",
            "spend": 50000,
            "frequency": 5,
            "recommendation": "recommendation"
        }
    ],
    "monthlyTrend": [
        { "month": "2024-01", "amount": 50000 }
    ]
}`
                    },
                    {
                        role: 'user',
                        content: `Expenses: ${JSON.stringify(expenses, null, 2)}`
                    }
                ],
                temperature: 0.4,
                max_tokens: 1536
            })
        })

        if (response.ok) {
            const result = await response.json()
            const content = result.choices?.[0]?.message?.content
            if (content) {
                const jsonMatch = content.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0])
                }
            }
        }
    } catch (err) {
        console.error('Expense report AI error:', err)
    }

    return generateExpenseFallbackReport(expenses)
}

// Fallback rule-based analyzers
function analyzeExpenseFallback(text: string, amount?: number): AIExpense {
    const lowerText = text.toLowerCase()

    const categoryKeywords: Record<string, string[]> = {
        ingredients: [
            'chicken', 'meat', 'fish', 'vegetable', 'fruit', 'rice', 'flour', 'oil', 'spice',
            'grain', 'dal', 'lentil', 'onion', 'tomato', 'potato', 'mutton', 'beef',
            'dairy', 'milk', 'cream', 'butter', 'cheese', 'yogurt', 'wheat', 'sugar',
            'salt', 'pepper', 'sauce', 'ketchup', 'mayo', 'powder', 'stock', 'basil',
            'pizza', 'burger', 'bread', 'roll', 'wrap', 'filling', 'topping', 'marinade',
            'curry', 'biryani', 'karahi', 'tandoor', 'seekh', 'kabab', 'prince', 'chaamp'
        ],
        utilities: [
            'electric', 'electricity', 'bill', 'gas', 'water', 'internet', 'wifi', 'broadband',
            'generator', 'fuel', 'diesel', 'petrol', 'power', 'load', 'tubewell', 'pump',
            'k-electric', 'sui gas', 'ptcl', 'warid', 'jazz'
        ],
        salary: [
            'salary', 'wage', 'bonus', 'allowance', 'overtime', 'commission', 'incentive',
            'pay', 'staff payment', 'employee', 'worker', 'kitchen', 'waiter', 'cashier',
            'delivery', 'manager', 'chef', 'cook', 'cleaner', 'security', 'hua', 'diwali'
        ],
        supplies: [
            'napkin', 'tissue', 'paper', 'foil', 'wrap', 'box', 'container', 'bag',
            'plastic', 'cutlery', 'fork', 'spoon', 'knife', 'plate', 'bowl', 'cup',
            'glass', 'straw', 'takeaway', 'to-go', 'packaging', 'label', 'tag'
        ],
        maintenance: [
            'repair', 'fix', 'maintenance', 'service', 'cleaning', 'plumber', 'electrician',
            'ac', 'air condition', 'fridge', 'refrigerator', 'oven', 'stove', 'grill',
            'hood', 'exhaust', 'fan', 'pipe', 'drain', 'leak', 'paint', 'renovation'
        ]
    }

    const vendorPatterns: Record<string, string[]> = {
        'Makkah Cash & Carry': ['makkah', 'makkah cash'],
        'Cash & Carry': ['cash', 'carry', 'whole sale', 'wholesale'],
        'Butcher': ['butcher', 'meat', 'beef', 'mutton', 'chicken shop'],
        'Sabzi Mandi': ['sabzi', 'vegetable', 'fruit mandi', 'wholesale market'],
        'Shell Station': ['shell', 'fuel', 'petrol', 'gas station'],
        'K Electric': ['k-electric', 'electricity bill'],
        'Sui Gas': ['sui gas', 'gas bill'],
        'Water Board': ['water board', 'kwsb']
    }

    let bestCategory = 'other'
    let bestScore = 0

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        const score = keywords.filter(kw => lowerText.includes(kw)).length
        if (score > bestScore) {
            bestScore = score
            bestCategory = category
        }
    }

    let suggestedVendor: string | undefined
    for (const [vendor, patterns] of Object.entries(vendorPatterns)) {
        if (patterns.some(p => lowerText.includes(p))) {
            suggestedVendor = vendor
            break
        }
    }

    return {
        description: text.length > 100 ? text.substring(0, 97) + '...' : text,
        category: bestCategory as AIExpense['category'],
        suggested_vendor: suggestedVendor,
        confidence: bestScore > 0 ? Math.min(0.9, 0.5 + bestScore * 0.2) : 0.3,
        reasoning: bestScore > 0 ? `Matched ${bestScore} keywords for ${bestCategory}` : 'No specific keywords matched'
    }
}

function generateFallbackInsights(data: {
    revenue: number
    ordersCount: number
    expenses: { amount: number; category: string }[]
}): {
    summary: string
    insights: { type: string; title: string; description: string; action: string; priority: string }[]
    recommendations: string[]
    predictions: { nextWeek: string; trends: string[] }
} {
    const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0)
    const expenseRatio = data.revenue > 0 ? totalExpenses / data.revenue : 0

    const insights: { type: string; title: string; description: string; action: string; priority: string }[] = []

    if (expenseRatio > 0.7) {
        insights.push({
            type: 'warning',
            title: 'High Expense Ratio',
            description: `Expenses are ${Math.round(expenseRatio * 100)}% of revenue`,
            action: 'Review discretionary spending',
            priority: 'high'
        })
    } else if (expenseRatio < 0.4) {
        insights.push({
            type: 'success',
            title: 'Healthy Margins',
            description: `Expense ratio is ${Math.round(expenseRatio * 100)}%`,
            action: 'Maintain current practices',
            priority: 'low'
        })
    }

    const topCategory = Object.entries(data.expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
    }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]

    if (topCategory) {
        insights.push({
            type: 'info',
            title: `${topCategory[0]} Dominates`,
            description: `Rs.${topCategory[1].toLocaleString()} spent on ${topCategory[0]}`,
            action: 'Explore bulk purchasing',
            priority: 'medium'
        })
    }

    return {
        summary: `Today: Rs.${data.revenue.toLocaleString()} revenue, ${data.ordersCount} orders, Rs.${totalExpenses.toLocaleString()} expenses.`,
        insights,
        recommendations: [
            'Review bulk purchasing for top categories',
            'Negotiate with frequent vendors',
            'Track waste and reduce food costs'
        ],
        predictions: {
            nextWeek: 'Expect stable performance with potential weekend uptick',
            trends: ['Online orders increasing', 'Premium items trending', 'Lunch rush extending']
        }
    }
}

function generateExpenseFallbackReport(expenses: {
    description: string
    amount: number
    category: string
    vendor: string | null
}[]): {
    executiveSummary: string
    costAnalysis: { category: string; amount: number; percentage: number; trend: string }[]
    anomalies: { description: string; amount: number; reason: string }[]
    savingsOpportunities: { category: string; potential: number; action: string }[]
    vendorInsights: { vendor: string; spend: number; frequency: number; recommendation: string }[]
    monthlyTrend: { month: string; amount: number }[]
} {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0)
    const avgExpense = expenses.length > 0 ? total / expenses.length : 0

    const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
    }, {} as Record<string, number>)

    const anomalies = expenses
        .filter(e => e.amount > avgExpense * 3)
        .map(e => ({
            description: e.description,
            amount: e.amount,
            reason: `Amount is ${Math.round(e.amount / avgExpense)}x above average`
        }))

    return {
        executiveSummary: `Total expenses: Rs.${total.toLocaleString()} across ${expenses.length} transactions.`,
        costAnalysis: Object.entries(byCategory).map(([cat, amt]) => ({
            category: cat,
            amount: amt,
            percentage: Math.round(amt / total * 100),
            trend: 'stable'
        })),
        anomalies,
        savingsOpportunities: Object.entries(byCategory).map(([cat, amt]) => ({
            category: cat,
            potential: Math.round(amt * 0.1),
            action: `Consider bulk purchasing or vendor negotiation for ${cat}`
        })),
        vendorInsights: [],
        monthlyTrend: []
    }
}

export async function batchAnalyzeExpenses(
    expenses: { text: string; amount?: number }[]
): Promise<AIExpense[]> {
    const results: AIExpense[] = []
    for (const expense of expenses) {
        const result = await analyzeExpenseWithAI(expense.text, expense.amount)
        results.push(result)
        if (expenses.indexOf(expense) < expenses.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300))
        }
    }
    return results
}

export function generateExpenseInsights(expenses: { amount: number; category: string; expense_date: string }[]): string[] {
    const insights: string[] = []

    const total = expenses.reduce((sum, e) => sum + e.amount, 0)

    const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
    }, {} as Record<string, number>)

    const highest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    if (highest) {
        insights.push(`${highest[0].charAt(0).toUpperCase() + highest[0].slice(1)} expenses are your largest cost at Rs.${highest[1].toLocaleString()}`)
    }

    const now = new Date()
    const thisMonth = expenses.filter(e => e.expense_date.startsWith(now.toISOString().slice(0, 7)))
    const lastMonth = expenses.filter(e => {
        const d = new Date(e.expense_date)
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1)
        return e.expense_date.startsWith(lastMonthDate.toISOString().slice(0, 7))
    })

    if (thisMonth.length > 0 && lastMonth.length > 0) {
        const thisMonthTotal = thisMonth.reduce((sum, e) => sum + e.amount, 0)
        const lastMonthTotal = lastMonth.reduce((sum, e) => sum + e.amount, 0)
        const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1)
        if (parseFloat(change) > 10) {
            insights.push(`Your expenses increased by ${change}% compared to last month`)
        } else if (parseFloat(change) < -10) {
            insights.push(`Good job! Expenses decreased by ${Math.abs(parseFloat(change))}% compared to last month`)
        }
    }

    const uniqueDays = new Set(expenses.map(e => e.expense_date)).size
    if (uniqueDays > 0) {
        const dailyAvg = Math.round(total / uniqueDays)
        insights.push(`Daily average expense: Rs.${dailyAvg.toLocaleString()}`)
    }

    return insights
}

// ============================================
// STAFF PERFORMANCE AI ANALYSIS
// ============================================

export async function analyzeStaffPerformance(staffData: {
    staff_id: string
    staff_name: string
    role: string
    orders_today: number
    revenue_today: number
    avg_order_time: number
    customer_rating: number
    on_time_rate: number
}[]): Promise<{
    topPerformers: string[]
    needsImprovement: string[]
    teamInsights: string[]
    recommendations: { staff_id: string; action: string; priority: 'high' | 'medium' | 'low' }[]
}> {
    if (!OPENROUTER_API_KEY || staffData.length === 0) {
        return analyzeStaffPerformanceFallback(staffData)
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'OrderFlow POS'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert Restaurant Staff Manager AI specializing in Pakistani F&B operations.

Analyze staff performance data and provide actionable insights.
Consider Pakistani restaurant context: peak hours, teamwork, customer satisfaction, order efficiency.
Return JSON:
{
    "topPerformers": ["staff_name1", "staff_name2"],
    "needsImprovement": ["staff_name1"],
    "teamInsights": ["insight1", "insight2"],
    "recommendations": [
        {"staff_id": "uuid", "action": "specific action", "priority": "high|medium|low"}
    ]
}`
                    },
                    {
                        role: 'user',
                        content: `Staff Performance Data:\n${JSON.stringify(staffData, null, 2)}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 768
            })
        })

        if (response.ok) {
            const result = await response.json()
            const content = result.choices?.[0]?.message?.content
            if (content) {
                const jsonMatch = content.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0])
                }
            }
        }
    } catch (err) {
        console.error('Staff performance AI error:', err)
    }

    return analyzeStaffPerformanceFallback(staffData)
}

export async function generateStaffAlerts(staffData: {
    staff_id: string
    staff_name: string
    role: string
    status: string
    orders_today: number
    customer_rating: number
}[]): Promise<{
    alerts: {
        staff_id: string
        severity: 'low' | 'medium' | 'high' | 'urgent'
        type: 'performance' | 'attendance' | 'efficiency' | 'feedback'
        message: string
        action: string
    }[]
}> {
    const alerts: {
        staff_id: string
        severity: 'low' | 'medium' | 'high' | 'urgent'
        type: 'performance' | 'attendance' | 'efficiency' | 'feedback'
        message: string
        action: string
    }[] = []

    staffData.forEach(staff => {
        // Critical performance alerts
        if (staff.status === 'critical') {
            alerts.push({
                staff_id: staff.staff_id,
                severity: 'urgent',
                type: 'performance',
                message: `${staff.staff_name} is critically underperforming`,
                action: 'Immediate intervention required'
            })
        } else if (staff.status === 'needs_attention') {
            alerts.push({
                staff_id: staff.staff_id,
                severity: 'medium',
                type: 'performance',
                message: `${staff.staff_name} needs performance review`,
                action: 'Schedule coaching session'
            })
        }

        // Low order volume
        if (staff.orders_today < 3 && staff.role === 'waiter') {
            alerts.push({
                staff_id: staff.staff_id,
                severity: 'low',
                type: 'attendance',
                message: `${staff.staff_name} has low order count today`,
                action: 'Check if tables need reassignment'
            })
        }

        // Low rating
        if (staff.customer_rating > 0 && staff.customer_rating < 3.5) {
            alerts.push({
                staff_id: staff.staff_id,
                severity: 'high',
                type: 'feedback',
                message: `${staff.staff_name} has low customer rating (${staff.customer_rating}★)`,
                action: 'Review recent feedback and provide training'
            })
        }
    })

    // AI enhancement if available
    if (OPENROUTER_API_KEY) {
        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                    'X-Title': 'OrderFlow POS'
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a Restaurant Staff Alert System. Generate additional alerts based on patterns.
Return JSON: {"alerts": [{"staff_id": "uuid", "severity": "low|medium|high|urgent", "type": "performance|attendance|efficiency|feedback", "message": "text", "action": "text"}]}`
                        },
                        {
                            role: 'user',
                            content: `Analyze: ${JSON.stringify(staffData)}`
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 512
                })
            })

            if (response.ok) {
                const result = await response.json()
                const content = result.choices?.[0]?.message?.content
                if (content) {
                    const jsonMatch = content.match(/\{[\s\S]*\}/)
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0])
                        if (parsed.alerts) {
                            alerts.push(...parsed.alerts)
                        }
                    }
                }
            }
        } catch (err) {
            console.error('AI alerts error:', err)
        }
    }

    return { alerts }
}

export async function generatePerformanceReport(
    staffId: string,
    dateRange: { start: string; end: string },
    metrics: {
        orders_count: number
        revenue: number
        avg_order_time: number
        customer_rating: number
        late_orders: number
    }
): Promise<{
    summary: string
    performanceScore: number
    strengths: string[]
    improvements: string[]
    suggestions: string[]
}> {
    // Calculate performance score
    const orderScore = Math.min(metrics.orders_count / 30, 1) * 100
    const ratingScore = (metrics.customer_rating / 5) * 100
    const efficiencyScore = Math.max(0, 100 - (metrics.avg_order_time / 45) * 100)
    const onTimeScore = metrics.orders_count > 0
        ? Math.max(0, 100 - (metrics.late_orders / metrics.orders_count) * 100)
        : 100

    const performanceScore = Math.round(
        orderScore * 0.3 +
        ratingScore * 0.3 +
        efficiencyScore * 0.25 +
        onTimeScore * 0.15
    )

    const strengths: string[] = []
    const improvements: string[] = []
    const suggestions: string[] = []

    if (ratingScore >= 80) strengths.push('Excellent customer satisfaction')
    if (efficiencyScore >= 80) strengths.push('Fast order processing')
    if (onTimeScore >= 90) strengths.push('Consistent on-time delivery')

    if (ratingScore < 60) improvements.push('Customer satisfaction needs attention')
    if (efficiencyScore < 50) improvements.push('Slow order processing times')
    if (onTimeScore < 80) improvements.push('Frequent delays in order completion')

    if (metrics.avg_order_time > 20) {
        suggestions.push('Consider reviewing workflow for faster service')
    }
    if (metrics.customer_rating > 0 && metrics.customer_rating < 4) {
        suggestions.push('Focus on customer interaction quality')
    }
    if (metrics.orders_count < 15) {
        suggestions.push('Could take on more tables during peak hours')
    }

    const summary = `Performance score: ${performanceScore}/100. Handled ${metrics.orders_count} orders generating Rs.${metrics.revenue.toLocaleString()}. ` +
        (performanceScore >= 80 ? 'Outstanding performance!' :
         performanceScore >= 60 ? 'Good performance with room for improvement.' :
         'Requires attention and development.')

    return {
        summary,
        performanceScore,
        strengths,
        improvements,
        suggestions
    }
}

// Fallback for staff performance
function analyzeStaffPerformanceFallback(staffData: {
    staff_id: string
    staff_name: string
    role: string
    orders_today: number
    revenue_today: number
    avg_order_time: number
    customer_rating: number
    on_time_rate: number
}[]): {
    topPerformers: string[]
    needsImprovement: string[]
    teamInsights: string[]
    recommendations: { staff_id: string; action: string; priority: 'high' | 'medium' | 'low' }[]
} {
    const sorted = [...staffData].sort((a, b) => {
        const scoreA = (a.orders_today * 10) + (a.customer_rating * 20) + (a.on_time_rate * 0.5)
        const scoreB = (b.orders_today * 10) + (b.customer_rating * 20) + (b.on_time_rate * 0.5)
        return scoreB - scoreA
    })

    const topPerformers = sorted.slice(0, 2).map(s => s.staff_name)
    const needsImprovement = sorted.filter(s => s.orders_today < 5 || s.customer_rating < 3).map(s => s.staff_name)

    const teamInsights = [
        `Team handled ${staffData.reduce((sum, s) => sum + s.orders_today, 0)} orders today`,
        `Average customer rating: ${(staffData.reduce((sum, s) => sum + s.customer_rating, 0) / staffData.filter(s => s.customer_rating > 0).length || 0).toFixed(1)}★`
    ]

    const recommendations = sorted.filter(s => s.orders_today < 5).map(s => ({
        staff_id: s.staff_id,
        action: `Consider additional table assignment for ${s.staff_name}`,
        priority: 'medium' as const
    }))

    return { topPerformers, needsImprovement, teamInsights, recommendations }
}
