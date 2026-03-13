import { MongoClient } from "mongodb";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoUri() {
  const fromEnv = process.env.MONGODB_URI;
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "development") {
    return "mongodb://127.0.0.1:27017/?directConnection=true";
  }

  throw new Error(
    "Missing MONGODB_URI environment variable. Create .env.local (see .env.example) or set it in your deployment env vars (Vercel → Project → Settings → Environment Variables).",
  );
}

function getMongoClientPromise() {
  if (global._mongoClientPromise) return global._mongoClientPromise;

  const uri = getMongoUri();
  const client = new MongoClient(uri, {});
  global._mongoClientPromise = client.connect();
  return global._mongoClientPromise;
}

export async function getDb() {
  const client = await getMongoClientPromise();
  const dbName = process.env.MONGODB_DB || "calendar_tasks";
  return client.db(dbName);
}
