import { MongoClient } from "mongodb";

const uri =
  process.env.MONGODB_URI ||
  (process.env.NODE_ENV === "development"
    ? "mongodb://127.0.0.1:27017/?directConnection=true"
    : undefined);
if (!uri) {
  throw new Error(
    "Missing MONGODB_URI environment variable. Create .env.local (see .env.example) or set it in your deployment env vars.",
  );
}

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb() {
  const client = await clientPromise;
  const dbName = process.env.MONGODB_DB || "calendar_tasks";
  return client.db(dbName);
}
