// For database access.
import db from "./db_conn.ts";
import { UserSchema } from "./types/db_conn_types.d.ts";

// For hashing passwords.
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

import * as data_access from "./data_access.ts";
import { isValidDisplayName } from "../utils.ts";

// Validates the given login credentials.
async function validateLoginCredentials(username: string, plaintextPassword: string): Promise<boolean> {
    const userCollection = db.collection<UserSchema>("users");

    // Usernames are unique.
    const user = await userCollection.findOne({ username });

    if (user !== undefined) {
        const validPassword = await bcrypt.compare(plaintextPassword, user.password);
        if (validPassword) {
            return true;
        }
    }
    return false;
}

type RawLoginRequest = 
    | { type?: "account", username?: string, password?: string }
    | { type?: "guest", displayname?: string };

// TODO: this is a duplicated type definition
type User = {
    username: string
};

// Tries to generate a login user session with the given credentials.
export async function tryLoginUser(reqBody?: RawLoginRequest): Promise<User | null> {
    // Client is trying to login with an account.
    if (reqBody?.type === "account" && reqBody?.username !== undefined && reqBody?.password !== undefined) {
        const { username, password } = reqBody;
        // Validate the provided credentials.
        const validCredentials = await validateLoginCredentials(username, password);

        if (validCredentials) {
            // Generate user session.
            const user = { username };
            return user;
        }
        return null;
    }
    // Client is trying to login with a guest account.
    else if (reqBody?.type === "guest" && reqBody.displayname !== undefined) {
        const displayname = reqBody.displayname.trim();

        if (isValidDisplayName(displayname)) {
            const generatedUsername = data_access.generateTemporaryUsername("guest");

            if (!data_access.tempUsernameAlreadyGenerated(generatedUsername)) {
                data_access.addTemporaryUser(generatedUsername, {
                    displayname: reqBody.displayname,
                    elo: 400,
                });

                // Generate user session.
                const user = { username: generatedUsername };
                return user;
            }
        }
        return null;
    }
    else {
        return null;
    }
}
