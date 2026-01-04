import bcrypt from 'bcryptjs'

/**
 * Hash a PIN for secure storage
 * @param pin - Plain text PIN (4 digits)
 * @returns Hashed PIN
 */
export async function hashPin(pin: string): Promise<string> {
    const saltRounds = 10
    return bcrypt.hash(pin, saltRounds)
}

/**
 * Compare a plain text PIN with a hashed PIN
 * @param pin - Plain text PIN to check
 * @param hashedPin - Stored hashed PIN
 * @returns True if PINs match
 */
export async function comparePin(pin: string, hashedPin: string): Promise<boolean> {
    // Handle legacy plain text PINs (should be migrated)
    if (!hashedPin.startsWith('$2')) {
        return pin === hashedPin
    }
    return bcrypt.compare(pin, hashedPin)
}

/**
 * Generate a secure random 4-digit PIN
 * @returns A 4-digit string PIN
 */
export function generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString()
}
