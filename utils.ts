
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

