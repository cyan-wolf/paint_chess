import db from "./db_conn.ts";
import { UserSchema } from "./db_conn_types.d.ts";

type PublicUserData = {
    username: string,
    displayname: string,
    elo: number,
    isGuest: boolean,
};

type TemporaryUserInfo = {
    displayname: string,
    elo: number,
};

type GuestUserDb = {
    [username: string]: TemporaryUserInfo,
};
const temporaryUsersLocalDb: GuestUserDb = {};

function tempUsernameAlreadyGenerated(generatedUsername: string): boolean {
    return Object.hasOwn(temporaryUsersLocalDb, generatedUsername);
}

// Placeholder ID generator.
function genId(): string {
    return Math.random().toString().substring(2);
}

function generateTemporaryUsername(prefix: "guest" | "ai") {
    return `@${prefix}-${genId()}`;
}

function addTemporaryUser(generatedUsername: string, temporaryInfo: TemporaryUserInfo) {
    temporaryUsersLocalDb[generatedUsername] = temporaryInfo;
}

function usernameIsTemporary(username: string): boolean {
    return username.startsWith("@") && Object.hasOwn(temporaryUsersLocalDb, username);
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
            isGuest: true,
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
            isGuest: false,
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
    addTemporaryUser,
    fetchUserData,
    setUserELO,
};
