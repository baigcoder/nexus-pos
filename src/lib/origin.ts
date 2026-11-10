export function isFirstPartyOrigin(origin: string | null, requestOrigin?: string): boolean {
    if (!origin) return true

    const candidates = [
        requestOrigin,
        process.env.NEXT_PUBLIC_APP_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ].filter((value): value is string => Boolean(value))

    return candidates.some((url) => {
        try {
            return new URL(url).origin === origin
        } catch {
            return false
        }
    })
}
