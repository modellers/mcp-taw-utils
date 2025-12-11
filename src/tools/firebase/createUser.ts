import { getFirestore } from "../../utils/firebase.js";
import { createLogger } from "../../utils/logger.js";
import type { ToolResult } from "../../types/index.js";
import admin from "firebase-admin";

const logger = createLogger("tools:firebase:createUser");

export interface CreateUserOptions {
  email: string;
  password: string;
  dryRun?: boolean;
}

export interface CreateUserResult {
  userId: string;
  email: string;
  profileCreated: boolean;
  actorCreated: boolean;
}

/**
 * Create Firebase user with profile and actor documents
 * Converts bin/models/tasking_agents_add_user.py to TypeScript
 */
export async function createUser(
  options: CreateUserOptions
): Promise<ToolResult<CreateUserResult>> {
  const { email, password, dryRun = false } = options;

  try {
    logger.info(`Creating Firebase user: ${email}`);

    // Validate password length
    if (password.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters",
      };
    }

    if (dryRun) {
      logger.warn("=== DRY RUN MODE - No user will be created ===");
      logger.info(`Would create user: ${email}`);
      logger.info("Would create documents:");
      logger.info("  - profile/{userId}");
      logger.info("  - actor/{userId}");

      return {
        success: true,
        data: {
          userId: "dry-run-user-id",
          email,
          profileCreated: false,
          actorCreated: false,
        },
        message: "Dry run completed - no user created",
      };
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
    });

    logger.info(`Successfully created user: ${userRecord.uid}`);

    const db = getFirestore();
    const timestamp = admin.firestore.Timestamp.now();
    const userId = userRecord.uid;

    // Create profile document
    const profileDoc = {
      id: userId,
      email,
      name: email,
      alias: email,
      bio: "New user",
      activeProjects: [],
      read: {
        [userId]: timestamp,
      },
    };

    await db.collection("profile").doc(userId).set(profileDoc);
    logger.info(`Profile document created for user: ${userId}`);

    // Create actor document
    const actorDoc = {
      id: userId,
      alias: email,
      name: email,
      role: "",
      capabilities: [],
      status: "active",
      read: {
        [userId]: timestamp,
      },
      write: {
        [userId]: timestamp,
      },
    };

    await db.collection("actor").doc(userId).set(actorDoc);
    logger.info(`Actor document created for user: ${userId}`);

    return {
      success: true,
      data: {
        userId,
        email,
        profileCreated: true,
        actorCreated: true,
      },
      message: `User created successfully: ${userId}`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create user: ${errorMessage}`);
    return {
      success: false,
      error: `Failed to create user: ${errorMessage}`,
    };
  }
}
