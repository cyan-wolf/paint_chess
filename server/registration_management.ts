import * as utils from "../utils.ts";

type RawRegisterRequest = {
    username?: string,
    displayname?: string,
    email?: string,
    password?: string,
};

type RegisterRequest = {
    username: string,
    displayname: string,
    email: string,
    password: string,
};

/**
 * Validates a registration request.
 */
export function checkRegistration(reqBody: RawRegisterRequest): RegisterRequest | null {
    if (typeof(reqBody.username) !== 'string' || 
        typeof(reqBody.displayname) !== 'string' ||
        typeof(reqBody.password) !== 'string' || 
        typeof(reqBody.email) !== 'string') {
        return null;
    }
    const { username, displayname, password, email } = reqBody;
    if (! utils.isValidUsername(username.trim())) {
        return null;
    }
    if (! utils.isValidDisplayName(displayname.trim())) {
        return null;
    }
    if (! utils.isValidPassword(password.trim())) {
        return null;
    }
    if (! utils.isValidEmail(email.trim())) {
        return null;
    }
    return {
        username: username.trim(),
        displayname: displayname.trim(),
        password: password.trim(),
        email: email.trim(),
    };
}