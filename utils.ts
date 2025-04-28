
export type ID = string;

export function genId(): ID {
    return crypto.randomUUID();
}

export function choose<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

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
 * composed of upper(lower) case letters, digits, and/or non-leading
 * nor trailing whitespace.
 */
export function isValidDisplayName(displayname: string): boolean {
    return displayname.length > 0 && 
        displayname.length <= 20 && 
        /^[A-Za-z\d\s]+$/.test(displayname);
}

/**
 * A password must be between 8 and 40 characters long.
 */
export function isValidPassword(password: string): boolean {
    return password.length >= 8 &&
        password.length <= 40;
}

/**
 * An email must between 4 and 40 characters long and must contain an `@` sign.
 */
export function isValidEmail(email: string): boolean {
    return email.length > 3 && email.length < 40 && /@/.test(email);
}
