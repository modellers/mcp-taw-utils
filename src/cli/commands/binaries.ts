import { uploadBinaries } from "../../tools/binaries/index.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("cli:binaries");

export const binariesCommand = {
  async upload(options: {
    platform?: "mac" | "windows" | "linux" | "all";
    version?: string;
    directory?: string;
    dryRun?: boolean;
  }): Promise<void> {
    const result = await uploadBinaries(options);

    if (result.success && result.data) {
      console.log(`✓ ${result.message}`);
      console.log(`\nUploaded files:`);

      for (const file of result.data.files) {
        console.log(`\n  ${file.platform}/${file.filename}`);
        console.log(`    Size: ${formatBytes(file.size)}`);
        if (!options.dryRun) {
          console.log(`    URL: ${file.url}`);
        }
      }
    } else {
      console.error(`✗ ${result.error}`);
      process.exit(1);
    }
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
