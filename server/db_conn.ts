import process from "node:process";

// Load configuration environment variables.
import dotenv from "npm:dotenv@16.4.7";
dotenv.config();

import { MongoClient } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

const client = new MongoClient();

await client.connect({
    db: "paint_chess",
    tls: true,
    servers: [
        {
            host: process.env.ATLAS_HOST!,
            port: 27017,
        },
    ],
    credential: {
        username: process.env.ATLAS_USERNAME!,
        password: process.env.ATLAS_PASSWORD!,
        db: "paint_chess",
        mechanism: "SCRAM-SHA-1",
    },
});

async function run() {
    try {
        const db = client.database("paint_chess");
        const collections = await db.listCollectionNames();

        if (collections.length > 0) {
            console.log("Successfully connected to MongoDB.");
        } else {
            console.error("Could not connect to MongoDB.");
        }
    }
    catch (err) {
        console.error(err);
    }
    finally {
        // Ensures that the client will close when you finish/error
        //client.close();
    }
}

run().catch(console.dir);

const db = client.database("paint_chess");
export default db;
