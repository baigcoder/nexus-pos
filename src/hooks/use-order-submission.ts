'use client'

import { useRef } from 'react'

export function useOrderSubmission() {
    const attempt = useRef<{ body: string; key: string } | null>(null)

    function submitOrderRequest(url: string, payload: object) {
        const body = JSON.stringify(payload)
        if (attempt.current?.body !== body) {
            attempt.current = { body, key: crypto.randomUUID() }
        }
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key },
            body,
        })
    }

    function completeOrderRequest() {
        attempt.current = null
    }

    return { submitOrderRequest, completeOrderRequest }
}
