import { NextRequest, NextResponse } from 'next/server'
import { analyzeExpenseWithAI } from '@/lib/minimax-ai'
import { requireManagerOrOwner } from '@/lib/api-auth'

const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY || ''
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'liquid/lfm-2.5-1.2b-instruct:free'

const EXPENSE_CATEGORIES = ['ingredients', 'utilities', 'salary', 'supplies', 'maintenance', 'other']

const RESTAURANT_SYSTEM_PROMPT = `You are an expert Restaurant Business Analyst AI for Pakistani F&B operations.

Categories: ingredients, utilities, salary, supplies, maintenance, other

Common Pakistani vendors:
- Makkah Cash & Carry (wholesale)
- Cash & Carry (wholesale)
- Sabzi Mandi (vegetables)
- Local butchers
- Shell/Caltex (fuel)
- K Electric (electricity)
- Sui Gas

Respond ONLY with JSON matching this schema:
{
    "description": "cleaned expense (max 100 chars)",
    "category": "ingredients|utilities|salary|supplies|maintenance|other",
    "suggested_vendor": "vendor name or null",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
}`

export async function POST(request: NextRequest) {
    try {
        const { response: authResponse } = await requireManagerOrOwner()(request)
        if (authResponse) return authResponse

        const body = await request.json()
        const { text, amount } = body

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        // If no API key, use fallback
        if (!OPENROUTER_API_KEY) {
            const result = await analyzeExpenseWithAI(text, amount)
            return NextResponse.json({ ...result, source: 'fallback' })
        }

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
                    { role: 'system', content: RESTAURANT_SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: amount
                            ? `Analyze: "${text}" - Rs.${amount}`
                            : `Analyze: "${text}"`
                    }
                ],
                temperature: 0.3,
                max_tokens: 256
            })
        })

        if (!response.ok) {
            console.error('OpenRouter API error:', response.status)
            const result = await analyzeExpenseWithAI(text, amount)
            return NextResponse.json({ ...result, source: 'fallback', error: 'API error' })
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
            const result = await analyzeExpenseWithAI(text, amount)
            return NextResponse.json({ ...result, source: 'fallback' })
        }

        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return NextResponse.json({
                description: parsed.description || text,
                category: EXPENSE_CATEGORIES.includes(parsed.category) ? parsed.category : 'other',
                suggested_vendor: parsed.suggested_vendor || null,
                confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                reasoning: parsed.reasoning,
                source: 'openrouter'
            })
        }

        // Fallback if JSON parsing fails
        const result = await analyzeExpenseWithAI(text, amount)
        return NextResponse.json({ ...result, source: 'fallback' })
    } catch (err) {
        console.error('AI analysis error:', err)
        return NextResponse.json({
            description: '',
            category: 'other',
            suggested_vendor: null,
            confidence: 0.3,
            reasoning: 'Error during analysis',
            source: 'error'
        }, { status: 500 })
    }
}
