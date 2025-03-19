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
const guestUsers: GuestUserDb = {};

export function guestUsernameAlreadyGenerated(generatedUsername: string): boolean {
    return Object.hasOwn(guestUsers, generatedUsername);
}

export function addGuestUser(generatedUsername: string, guestInfo: GuestUserInfo) {
    guestUsers[generatedUsername] = guestInfo;
}

// Fetches (public) data from the user with the given username.
// The user could be from an account or a guest.
export async function fetchUserData(username: string): Promise<PublicUserData | null> {
    // The username belongs to a guest account.
    if (username.startsWith("@guest-") && Object.hasOwn(guestUsers, username)) {
        const userData = {
            username,
            displayname: guestUsers[username].displayname,
            elo: guestUsers[username].elo,
            isGuest: true,
        };
        return userData;
    }

    const usersCollection = db.collection<UserSchema>("users");
    const user = await usersCollection.findOne({ username });

    // The username belongs to an account in the database.
    if (user !== undefined) {
        const userData = {
            username: user.username,
            displayname: user.displayname,
            elo: user.elo,
            isGuest: false,
        };
        return userData;
    }

    // Could not find user data.
    return null;
}
