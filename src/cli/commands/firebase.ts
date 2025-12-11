import { createUser, copyProjects } from "../../tools/firebase/index.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("cli:firebase");

export const firebaseCommand = {
  async createUser(options: {
    email: string;
    password: string;
    dryRun?: boolean;
  }): Promise<void> {
    const result = await createUser(options);

    if (result.success && result.data) {
      console.log(`✓ User created successfully`);
      console.log(`  User ID: ${result.data.userId}`);
      console.log(`  Email: ${result.data.email}`);
      console.log(`  Profile: ${result.data.profileCreated ? "✓" : "✗"}`);
      console.log(`  Actor: ${result.data.actorCreated ? "✓" : "✗"}`);
    } else {
      console.error(`✗ ${result.error}`);
      process.exit(1);
    }
  },

  async copyProjects(options: {
    source: string;
    dest: string;
    collections?: string;
    userIdMap?: string;
    dryRun?: boolean;
    verbose?: boolean;
  }): Promise<void> {
    const collections = options.collections
      ? options.collections.split(",")
      : undefined;

    const result = await copyProjects({
      sourceServiceAccountPath: options.source,
      destServiceAccountPath: options.dest,
      collections,
      userIdMapFile: options.userIdMap,
      dryRun: options.dryRun,
      verbose: options.verbose,
    });

    if (result.success && result.data) {
      console.log(`✓ ${result.message}`);
      console.log(`\nSummary:`);
      console.log(`  Collections: ${result.data.collections.join(", ")}`);
      console.log(`  Documents copied: ${result.data.documentsCopied}`);
      console.log(`  User IDs replaced: ${result.data.userIdsReplaced}`);
    } else {
      console.error(`✗ ${result.error}`);
      process.exit(1);
    }
  },
};
