const STORAGE_KEY = "rc_ref"

export function storeReferral(ref) {
    try {
        localStorage.setItem(STORAGE_KEY, ref)
    } catch {
        // localStorage blocked (private mode, etc.) — just skip attribution
    }
}

export function getStoredReferral() {
    try {
        return localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

export function clearStoredReferral() {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // ignore
    }
}
