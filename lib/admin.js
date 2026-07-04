// Hardcoded allowlist rather than an is_admin DB column — single-admin
// project right now, not worth a schema change until a second admin exists.
export const ADMIN_USERNAMES = ["DinDjarin"]

export function isAdminUsername(username) {
    return !!username && ADMIN_USERNAMES.includes(username)
}
