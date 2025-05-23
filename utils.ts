
/**
 * Represents an ID used to identify games or temporary users.
 */
export type ID = string;

/**
 * Generates a random ID.
 */
export function genId(): ID {
    return crypto.randomUUID();
}

/**
 * Choose an element from the given array. Returns `null` if the array is empty.
 */
export function choose<T>(array: T[]): T | null {
    if (array.length === 0) {
        return null;
    }
    return array[Math.floor(Math.random() * array.length)];
}

// From:
// https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep/39914235#39914235
export function sleep(milisecs: number) {
    return new Promise(resolve => setTimeout(resolve, milisecs));
}

// From: 
// https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript/6234804#6234804
export function escapeHtml(unsafe: string): string {
    return unsafe
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
};

/**
 * A username must be 1 to 20 characters long and must be composed
 * of upper(lower) case letters, digits, and/or underscores.
 */
export function isValidUsername(username: string): boolean {
    return username.length > 0 && 
        username.length <= 20 && 
        /^[A-Za-z\d_]+$/.test(username);
}

/**
 * A display name must be 1 to 20 characters long and must be 
 * composed of upper(lower) case letters, digits, underscores,
 * and/or non-leading nor trailing whitespace.
 */
export function isValidDisplayName(displayname: string): boolean {
    return displayname.length > 0 && 
        displayname.length <= 20 && 
        /^[A-Za-z\d_\s]+$/.test(displayname);
}

/**
 * A password must be between 8 and 40 characters long.
 */
export function isValidPassword(password: string): boolean {
    return password.length >= 8 &&
        password.length <= 40;
}
