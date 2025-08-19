// Cryptographic utility functions for HIPAA E2EE system
// Provides secure random generation and data conversion utilities

/**
 * Generate cryptographically secure random bytes
 * @param {number} length - Number of bytes to generate
 * @returns {Uint8Array} Random bytes
 */
export function generateRandomBytes(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
}

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Base64 encoded string
 */
export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 * @param {string} base64 - Base64 encoded string
 * @returns {ArrayBuffer} Decoded buffer
 */
export function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Secure string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
export function secureStringEquals(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
}

/**
 * Hash function for non-sensitive data (audit logs)
 * @param {string} data - Data to hash
 * @returns {Promise<string>} SHA-256 hash
 */
export async function hashData(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return arrayBufferToBase64(hashBuffer);
}

/**
 * Generate HIPAA-compliant message ID
 * @returns {string} Unique message identifier
 */
export function generateMessageId() {
    const timestamp = Date.now().toString();
    const random = arrayBufferToBase64(generateRandomBytes(16));
    return `msg_${timestamp}_${random.replace(/[+/=]/g, '')}`;
}

/**
 * Sanitize data for HIPAA audit logs (remove PHI)
 * @param {string} data - Original data
 * @returns {string} Sanitized data hash
 */
export async function sanitizeForAudit(data) {
    // Create hash of data for audit trail without exposing PHI
    const hash = await hashData(data);
    return `sha256:${hash}`;
}

/**
 * Validate message envelope structure
 * @param {Object} envelope - Message envelope
 * @returns {boolean} True if valid
 */
export function validateMessageEnvelope(envelope) {
    const requiredFields = ['type', 'sender', 'recipient', 'timestamp', 'ciphertext', 'iv', 'tag'];
    return requiredFields.every(field => envelope.hasOwnProperty(field));
}

/**
 * Clear sensitive data from memory (best effort)
 * @param {ArrayBuffer|Uint8Array} sensitiveData - Data to clear
 */
export function secureClear(sensitiveData) {
    if (sensitiveData instanceof ArrayBuffer) {
        const view = new Uint8Array(sensitiveData);
        crypto.getRandomValues(view);
    } else if (sensitiveData instanceof Uint8Array) {
        crypto.getRandomValues(sensitiveData);
    }
}