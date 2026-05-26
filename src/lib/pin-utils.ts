import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { AUTH_CONSTANTS } from '@/lib/auth/security'

export async function hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pin, AUTH_CONSTANTS.PIN_BCRYPT_ROUNDS)
}

export async function comparePin(pin: string, hashedPin: string): Promise<boolean> {
    if (!hashedPin.startsWith('$2')) {
        const isMatch = await bcrypt.compare(pin, await hashPin(pin))
        return isMatch
    }
    return bcrypt.compare(pin, hashedPin)
}

export function generatePin(): string {
    const bytes = crypto.randomBytes(AUTH_CONSTANTS.PIN_LENGTH)
    let pin = ''
    for (let i = 0; i < AUTH_CONSTANTS.PIN_LENGTH; i++) {
        pin += bytes[i] % 10
    }
    return pin
}

export function generateTempPin(): string {
    const bytes = crypto.randomBytes(AUTH_CONSTANTS.TEMP_PIN_LENGTH)
    let pin = ''
    for (let i = 0; i < AUTH_CONSTANTS.TEMP_PIN_LENGTH; i++) {
        pin += bytes[i] % 10
    }
    return pin
}