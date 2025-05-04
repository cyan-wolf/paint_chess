import { ObjectId } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

/**
 * Represents how users with accounts are stored in the database.
 */
type UserSchema = {
    _id: ObjectId,
    username: string,
    displayname: string,
    password: string,
    elo: number,
};

/**
 * Represents a publically-accesible view into a user's data.
 */
type PublicUserData = {
    username: string,
    displayname: string,
    elo: number,
    isTemp: boolean,
};

/**
 * The information that is stored for a temporary user.
 */
type TemporaryUserInfo = {
    displayname: string,
    elo: number,
};

type TemporaryUserDb = {
    [username: string]: TemporaryUserInfo,
};
