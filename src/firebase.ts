import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve } from "path";

let db: admin.firestore.Firestore | null = null;

export function initializeFirebase(): void {
  try {
    const serviceAccountPath = resolve(
      process.cwd(),
      "./secrets/tasking-agency-serviceaccount.json"
    );
    
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath, "utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.error("Firebase initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
}

export function getFirestore(): admin.firestore.Firestore {
  if (!db) {
    throw new Error("Firebase not initialized. Call initializeFirebase() first.");
  }
  return db;
}
