import db from "./db_conn.ts";
import { UserSchema } from "./db_conn_types.d.ts";

type PublicUserData = {
    username: string,
    displayname: string,
    elo: number,
    isGuest: boolean,
};

type GuestUserInfo = {
    displayname: string,
    elo: number,
};

type GuestUserDb = {
    [username: string]: GuestUserInfo,
};
const guestUsersLocalDb: GuestUserDb = {};

function guestUsernameAlreadyGenerated(generatedUsername: string): boolean {
    return Object.hasOwn(guestUsersLocalDb, generatedUsername);
}

function addGuestUser(generatedUsername: string, guestInfo: GuestUserInfo) {
    guestUsersLocalDb[generatedUsername] = guestInfo;
}

function usernameIsGuest(username: string): boolean {
    return username.startsWith("@guest-") && Object.hasOwn(guestUsersLocalDb, username);
}

// Fetches (public) data from the user with the given username.
// The user could be from an account or a guest.
async function fetchUserData(username: string, roundElo?: boolean): Promise<PublicUserData | null> {
    if (roundElo === undefined) {
        // Round the ELO by default.
        roundElo = true;
    }
    
    // The username belongs to a guest account.
    if (usernameIsGuest(username)) {
        const elo = guestUsersLocalDb[username].elo;

        const userData = {
            username,
            displayname: guestUsersLocalDb[username].displayname,
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
    if (usernameIsGuest(username)) {
        guestUsersLocalDb[username].elo = newElo;
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
    guestUsernameAlreadyGenerated,
    addGuestUser,
    fetchUserData,
    setUserELO,
};
