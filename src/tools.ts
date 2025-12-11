import { getFirestore } from "./firebase.js";

const COLLECTION_NAME = "config";

/**
 * List all documents in the Firebase 'config' collection
 */
export async function listCollection() {
  try {
    const db = getFirestore();
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    const documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(documents, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to list collection: ${error}`);
  }
}

/**
 * Get a local copy of a document from the 'config' collection by ID
 */
export async function getCollection(id: string) {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        content: [
          {
            type: "text",
            text: `Document with ID '${id}' not found`,
          },
        ],
      };
    }

    const data = {
      id: doc.id,
      data: doc.data(),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to get document: ${error}`);
  }
}

/**
 * Add or create a document in the 'config' collection
 */
export async function setCollection(id: string, data: any) {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(id);
    
    await docRef.set(data, { merge: true });

    return {
      content: [
        {
          type: "text",
          text: `Document '${id}' successfully created/updated`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to set document: ${error}`);
  }
}

/**
 * Extract Git MCP config from a URI
 * This parses a Git URI and extracts configuration information
 */
export async function getItemFromGit(uri: string) {
  try {
    // Parse the Git URI to extract repository information
    const gitConfig = parseGitUri(uri);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(gitConfig, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to extract Git config from URI: ${error}`);
  }
}

/**
 * Update Git MCP config by ID in the 'config' collection
 */
export async function setCollectionItem(id: string, gitConfig: any) {
  try {
    const db = getFirestore();
    const docRef = db.collection(COLLECTION_NAME).doc(id);
    
    // Get existing document
    const doc = await docRef.get();
    
    const updateData = {
      gitConfig,
      updatedAt: new Date().toISOString(),
    };
    
    if (doc.exists) {
      // Update existing document
      await docRef.update(updateData);
    } else {
      // Create new document
      await docRef.set({
        ...updateData,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      content: [
        {
          type: "text",
          text: `Git MCP config for '${id}' successfully updated`,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Failed to update Git config: ${error}`);
  }
}

/**
 * Parse Git URI to extract configuration
 * Supports various Git URI formats:
 * - https://github.com/user/repo.git
 * - git@github.com:user/repo.git
 * - https://github.com/user/repo
 */
function parseGitUri(uri: string): any {
  const config: any = {
    uri,
    type: "git",
    parsedAt: new Date().toISOString(),
  };

  try {
    // Handle SSH format: git@github.com:user/repo.git
    if (uri.startsWith("git@")) {
      const sshMatch = uri.match(/git@([^:]+):(.+?)(\.git)?$/);
      if (sshMatch) {
        config.host = sshMatch[1];
        config.path = sshMatch[2];
        config.protocol = "ssh";
      }
    }
    // Handle HTTPS format: https://github.com/user/repo.git
    else if (uri.startsWith("http://") || uri.startsWith("https://")) {
      const url = new URL(uri);
      config.host = url.hostname;
      config.path = url.pathname.replace(/^\//, "").replace(/\.git$/, "");
      config.protocol = url.protocol.replace(":", "");
    }
    // Handle bare format: github.com/user/repo
    else {
      const parts = uri.split("/");
      if (parts.length >= 2) {
        config.host = parts[0];
        config.path = parts.slice(1).join("/").replace(/\.git$/, "");
        config.protocol = "https";
      }
    }

    // Extract user/org and repo name if possible
    if (config.path) {
      const pathParts = config.path.split("/");
      if (pathParts.length >= 2) {
        config.owner = pathParts[0];
        config.repo = pathParts[1];
      }
    }
  } catch (error) {
    console.error("Error parsing Git URI:", error);
  }

  return config;
}
