import { ObjectId } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

type UserSchema = {
    _id: ObjectId,
    username: string,
    displayname: string,
    email: string,
    password: string,
    friends: string[],
    elo: number,
};

type PublicUserData = {
    username: string,
    displayname: string,
    elo: number,
    isTemp: boolean,
};

type TemporaryUserInfo = {
    displayname: string,
    elo: number,
};

type TemporaryUserDb = {
    [username: string]: TemporaryUserInfo,
};
