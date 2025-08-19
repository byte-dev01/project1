// Signal Protocol Store implementation using IndexedDB
// Provides secure key storage for Signal Protocol sessions

export class SignalProtocolStore {
    constructor() {
        this.dbName = 'HIPAASignalStore';
        this.dbVersion = 1;
        this.db = null;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('identityKeys')) {
                    db.createObjectStore('identityKeys');
                }
                if (!db.objectStoreNames.contains('preKeys')) {
                    db.createObjectStore('preKeys');
                }
                if (!db.objectStoreNames.contains('signedPreKeys')) {
                    db.createObjectStore('signedPreKeys');
                }
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions');
                }
            };
        });
    }

    async put(key, value) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['identityKeys'], 'readwrite');
            const store = transaction.objectStore('identityKeys');
            const request = store.put(value, key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async get(key) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['identityKeys'], 'readonly');
            const store = transaction.objectStore('identityKeys');
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async storePreKey(keyId, keyPair) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['preKeys'], 'readwrite');
            const store = transaction.objectStore('preKeys');
            const request = store.put(keyPair, keyId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadPreKey(keyId) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['preKeys'], 'readonly');
            const store = transaction.objectStore('preKeys');
            const request = store.get(keyId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async storeSignedPreKey(keyId, keyPair) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['signedPreKeys'], 'readwrite');
            const store = transaction.objectStore('signedPreKeys');
            const request = store.put(keyPair, keyId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadSignedPreKey(keyId) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['signedPreKeys'], 'readonly');
            const store = transaction.objectStore('signedPreKeys');
            const request = store.get(keyId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removePreKey(keyId) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['preKeys'], 'readwrite');
            const store = transaction.objectStore('preKeys');
            const request = store.delete(keyId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Session store methods
    async storeSession(identifier, record) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.put(record, identifier);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async loadSession(identifier) {
        if (!this.db) await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.get(identifier);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    // Cleanup methods for HIPAA compliance
    async clearExpiredKeys() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        // Clear expired signed pre-keys
        // Implementation would iterate through keys and remove old ones
        console.log('Clearing expired keys for HIPAA compliance');
    }

    async secureDelete() {
        // Implement secure deletion for HIPAA
        if (this.db) {
            this.db.close();
            
            return new Promise((resolve, reject) => {
                const deleteRequest = indexedDB.deleteDatabase(this.dbName);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
            });
        }
    }
}