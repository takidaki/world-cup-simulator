/**
 * LocalStorage Utilities
 * Provides type-safe, error-handling wrappers for localStorage operations
 */

/**
 * Safely gets a value from localStorage with optional default
 * @param {string} key - The storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {string|null} The stored value or default
 */
export function getStorageItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item !== null ? item : defaultValue;
    } catch (error) {
        console.warn(`Failed to get localStorage item '${key}':`, error);
        return defaultValue;
    }
}

/**
 * Safely sets a value in localStorage
 * @param {string} key - The storage key
 * @param {any} value - The value to store (will be converted to string)
 * @returns {boolean} True if successful, false otherwise
 */
export function setStorageItem(key, value) {
    try {
        localStorage.setItem(key, String(value));
        return true;
    } catch (error) {
        console.error(`Failed to set localStorage item '${key}':`, error);
        return false;
    }
}

/**
 * Safely removes a value from localStorage
 * @param {string} key - The storage key to remove
 * @returns {boolean} True if successful, false otherwise
 */
export function removeStorageItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn(`Failed to remove localStorage item '${key}':`, error);
        return false;
    }
}

/**
 * Clears all localStorage data
 * @returns {boolean} True if successful, false otherwise
 */
export function clearStorage() {
    try {
        localStorage.clear();
        return true;
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
        return false;
    }
}

/**
 * Checks if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
export function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
}

/**
 * Gets a JSON-parsed value from localStorage
 * @param {string} key - The storage key
 * @param {any} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {any} The parsed JSON value or default
 */
export function getStorageJson(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item !== null ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Failed to parse localStorage JSON for '${key}':`, error);
        return defaultValue;
    }
}

/**
 * Sets a JSON-stringified value in localStorage
 * @param {string} key - The storage key
 * @param {any} value - The value to store (will be JSON.stringify'd)
 * @returns {boolean} True if successful, false otherwise
 */
export function setStorageJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Failed to set localStorage JSON for '${key}':`, error);
        return false;
    }
}

// --- Application-specific storage keys and helpers ---
export const STORAGE_KEYS = {
    ODDS_API_KEY: 'odds_api_key',
    GROUP_MAPPING_DATA: 'group_mapping_data'
};

/**
 * Gets the stored odds API key
 * @returns {string} The API key or empty string
 */
export function getOddsApiKey() {
    return getStorageItem(STORAGE_KEYS.ODDS_API_KEY, '');
}

/**
 * Sets the odds API key
 * @param {string} key - The API key to store
 * @returns {boolean} True if successful
 */
export function setOddsApiKey(key) {
    return setStorageItem(STORAGE_KEYS.ODDS_API_KEY, key);
}

/**
 * Gets the stored group mapping data
 * @returns {string} The group mapping data or empty string
 */
export function getGroupMappingData() {
    return getStorageItem(STORAGE_KEYS.GROUP_MAPPING_DATA, '');
}

/**
 * Sets the group mapping data
 * @param {string} data - The group mapping data to store
 * @returns {boolean} True if successful
 */
export function setGroupMappingData(data) {
    return setStorageItem(STORAGE_KEYS.GROUP_MAPPING_DATA, data);
}

/**
 * Removes the stored group mapping data
 * @returns {boolean} True if successful
 */
export function removeGroupMappingData() {
    return removeStorageItem(STORAGE_KEYS.GROUP_MAPPING_DATA);
}