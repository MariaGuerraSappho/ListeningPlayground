export class Storage {
    constructor() {
        this.dbName = 'SoundExplorerDB';
        this.dbVersion = 1;
        this.db = null;
        this.useFallback = false;
        this.fallbackData = { recordings: [], settings: {} };
    }

    _loadFallbackData() {
        try {
            if (window.localStorage) {
                const raw = localStorage.getItem(`${this.dbName}_fallback`);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        this.fallbackData = {
                            recordings: Array.isArray(parsed.recordings) ? parsed.recordings : [],
                            settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}
                        };
                    }
                }
            }
        } catch (err) {
            console.warn('Unable to restore fallback storage:', err);
        }
    }

    _saveFallbackData() {
        try {
            if (window.localStorage) {
                localStorage.setItem(`${this.dbName}_fallback`, JSON.stringify(this.fallbackData));
            }
        } catch (err) {
            // ignore fallback storage failures
        }
    }

    async init() {
        if (!window.indexedDB) {
            this.useFallback = true;
            this._loadFallbackData();
            return;
        }

        return new Promise((resolve, reject) => {
            let request;
            try {
                request = indexedDB.open(this.dbName, this.dbVersion);
            } catch (err) {
                this.useFallback = true;
                this._loadFallbackData();
                resolve();
                return;
            }

            request.onerror = () => {
                console.warn('IndexedDB open failed, using fallback storage:', request.error);
                this.useFallback = true;
                this._loadFallbackData();
                resolve();
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('recordings')) {
                    const recordingsStore = db.createObjectStore('recordings', { keyPath: 'id' });
                    recordingsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async ensureDb() {
        if (this.useFallback) {
            return;
        }
        if (!this.db) {
            await this.init();
        }
    }

    async saveRecording(recording) {
        if (this.useFallback) {
            const existingIndex = this.fallbackData.recordings.findIndex(r => r.id === recording.id);
            if (existingIndex >= 0) {
                this.fallbackData.recordings[existingIndex] = recording;
            } else {
                this.fallbackData.recordings.push(recording);
            }
            this._saveFallbackData();
            return;
        }

        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            const request = store.put(recording);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllRecordings() {
        if (this.useFallback) {
            return this.fallbackData.recordings.slice();
        }

        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getRecording(id) {
        if (this.useFallback) {
            return this.fallbackData.recordings.find(r => r.id === id);
        }

        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteRecording(id) {
        if (this.useFallback) {
            this.fallbackData.recordings = this.fallbackData.recordings.filter(r => r.id !== id);
            this._saveFallbackData();
            return;
        }

        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async set(key, value) {
        if (this.useFallback) {
            this.fallbackData.settings[key] = value;
            this._saveFallbackData();
            return;
        }

        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async get(key) {
        if (this.useFallback) {
            return this.fallbackData.settings[key];
        }

        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result && request.result.value);
            request.onerror = () => reject(request.error);
        });
    }

    async clear() {
        if (this.useFallback) {
            this.fallbackData = { recordings: [], settings: {} };
            this._saveFallbackData();
            return;
        }

        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recordings', 'settings'], 'readwrite');
            const recordingsStore = transaction.objectStore('recordings');
            const settingsStore = transaction.objectStore('settings');

            recordingsStore.clear();
            settingsStore.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

