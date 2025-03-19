import { ObjectId } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

export type UserSchema = {
    _id: ObjectId,
    username: string,
    displayname: string,
    email: string,
    password: string,
    friends: string[],
    elo: number,
};

export { ObjectId };
