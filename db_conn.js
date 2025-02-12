// Load configuration environment variables.
import dotenv from "npm:dotenv@16.4.7";
dotenv.config();

import { MongoClient, ServerApiVersion } from 'npm:mongodb@6.13.0';
const uri = process.env.ATLAS_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version.
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const db = client.db("sample_mflix");
export default db; 
