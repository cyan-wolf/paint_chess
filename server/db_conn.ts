import process from "node:process";

// Load configuration environment variables.
import dotenv from "npm:dotenv@16.4.7";
dotenv.config();

import { MongoClient } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

import assert from "node:assert";

type Error = { message: string };

function isError(error: unknown): error is Error {
    return typeof(error) === "object" && error !== null && 'message' in error;
}

async function connect(client: MongoClient) {
    // Assert that environment variables are present.
    assert(process.env.ATLAS_HOSTS !== undefined);

    // Get a list of possile costs.
    const hosts = process.env.ATLAS_HOSTS.split(";");
    
    for (let i = 0; i < hosts.length; i++) {
        try {
            await connectToHost(client, hosts[i]);

            console.log(`LOG: Connected to host #${i}.`);
            break;
        }
        catch (error: unknown) {
            if (isError(error)) {
                if (error.message.includes("Could not find a master node")) {
                    console.log(`LOG: Could not connect to host #${i}.`);
                }
                else {
                    console.log(`ERROR: ${error.message}`);
                }
            }
        }
    }
}

async function connectToHost(client: MongoClient, host: string) {
    // Assert that environment variables are present.

    assert(process.env.ATLAS_USERNAME !== undefined);
    assert(process.env.ATLAS_PASSWORD !== undefined);

    await client.connect({
        db: "paint_chess",
        tls: true,
        servers: [
            {
                host,
                port: 27017,
            },
        ],
        credential: {
            username: process.env.ATLAS_USERNAME,
            password: process.env.ATLAS_PASSWORD,
            db: "paint_chess",
            mechanism: "SCRAM-SHA-1",
        },
    });
}

async function testDBConnection(client: MongoClient) {
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

const appClient = new MongoClient();
await connect(appClient);
await testDBConnection(appClient);

const db = appClient.database("paint_chess");
export default db;
