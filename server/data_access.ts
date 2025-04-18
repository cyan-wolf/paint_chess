import db from "./db_conn.ts";
import { TemporaryUserDb, PublicUserData, TemporaryUserInfo, UserSchema } from "./types/db_conn_types.d.ts";

import * as utils from "../utils.ts";

const temporaryUsersLocalDb: TemporaryUserDb = {};

function tempUsernameAlreadyGenerated(generatedUsername: string): boolean {
    return Object.hasOwn(temporaryUsersLocalDb, generatedUsername);
}

function generateTemporaryUsername(prefix: "guest" | "ai") {
    return `@${prefix}-${utils.genId()}`;
}

function addTemporaryUser(generatedUsername: string, temporaryInfo: TemporaryUserInfo) {
    temporaryUsersLocalDb[generatedUsername] = temporaryInfo;
}

/**
 * Removes the temporary user from the local database.
 * @returns `true` if the removal was successful.
 */
function removeTemporaryUser(generatedUsername: string) {
    if (Object.hasOwn(temporaryUsersLocalDb, generatedUsername)) {
        delete temporaryUsersLocalDb[generatedUsername];
        return true;
    }
    return false;
}

function usernameIsTemporary(username: string): boolean {
    return username.startsWith("@") && Object.hasOwn(temporaryUsersLocalDb, username);
}

function usernameIsAI(username: string): boolean {
    return usernameIsTemporary(username) && username.startsWith("@ai-");
}

// Fetches (public) data from the user with the given username.
// The user could be from an account or a temporary (i.e. guest) profile.
async function fetchUserData(username: string, roundElo?: boolean): Promise<PublicUserData | null> {
    if (roundElo === undefined) {
        // Round the ELO by default.
        roundElo = true;
    }
    
    // The username belongs to a guest account.
    if (usernameIsTemporary(username)) {
        const elo = temporaryUsersLocalDb[username].elo;

        const userData = {
            username,
            displayname: temporaryUsersLocalDb[username].displayname,
            elo: (roundElo) ? Math.floor(elo) : elo,
            isTemp: true,
        };
        return userData;
    }

    const usersCollection = db.collection<UserSchema>("users");
    const user = await usersCollection.findOne({ username });

    // The username belongs to an account in the database.
    if (user !== undefined) {
        const elo = user.elo;

        const userData = {
            username: user.username,
            displayname: user.displayname,
            elo: (roundElo) ? Math.floor(elo) : elo,
            isTemp: false,
        };
        return userData;
    }

    // Could not find user data.
    return null;
}

async function setUserELO(username: string, newElo: number) {
    if (usernameIsTemporary(username)) {
        temporaryUsersLocalDb[username].elo = newElo;
    }
    else {
        const usersCollection = db.collection<UserSchema>("users");
        await usersCollection.updateOne(
            { username }, 
            { 
                $set: { elo: newElo }
            },
        );
    }
}

export {
    generateTemporaryUsername,
    tempUsernameAlreadyGenerated,
    usernameIsTemporary,
    usernameIsAI,
    addTemporaryUser,
    removeTemporaryUser,
    fetchUserData,
    setUserELO,
};
