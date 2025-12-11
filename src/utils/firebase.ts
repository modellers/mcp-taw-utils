import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getConfig } from "../config.js";

let db: admin.firestore.Firestore | null = null;
let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Uses configuration from environment variables
 */
export function initializeFirebase(
  serviceAccountPath?: string
): admin.firestore.Firestore {
  if (initialized && db) {
    return db;
  }

  try {
    const config = getConfig();
    const accountPath =
      serviceAccountPath || config.FIREBASE_SERVICE_ACCOUNT_PATH;

    const resolvedPath = resolve(process.cwd(), accountPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    const serviceAccount = JSON.parse(readFileSync(resolvedPath, "utf-8"));

    // Initialize app if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.FIREBASE_PROJECT_ID,
      });
    }

    db = admin.firestore();
    initialized = true;

    console.error("Firebase initialized successfully");
    return db;
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
}

/**
 * Get Firestore instance
 * Initializes Firebase if not already initialized
 */
export function getFirestore(): admin.firestore.Firestore {
  if (!db) {
    return initializeFirebase();
  }
  return db;
}

/**
 * Initialize Firebase with a specific service account
 * Useful for multi-project operations
 */
export function initializeFirebaseWithAccount(
  serviceAccountPath: string,
  appName?: string
): admin.firestore.Firestore {
  try {
    const resolvedPath = resolve(process.cwd(), serviceAccountPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }

    const serviceAccount = JSON.parse(readFileSync(resolvedPath, "utf-8"));

    const app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
      },
      appName
    );

    return app.firestore();
  } catch (error) {
    console.error("Error initializing Firebase with account:", error);
    throw error;
  }
}

/**
 * Get Firebase Storage instance
 */
export function getStorage(): admin.storage.Storage {
  if (!admin.apps.length) {
    initializeFirebase();
  }
  return admin.storage();
}

/**
 * Get Firebase Auth instance
 */
export function getAuth(): admin.auth.Auth {
  if (!admin.apps.length) {
    initializeFirebase();
  }
  return admin.auth();
}
