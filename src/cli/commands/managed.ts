import { generateManagedServer, buildDockerImage } from "../../tools/managed/index.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("cli:managed");

export const managedCommand = {
  async generate(options: {
    directory: string;
    workstationId: string;
    organizationId: string;
    apiPort?: number;
    name?: string;
    dryRun?: boolean;
  }): Promise<void> {
    const result = await generateManagedServer(options);

    if (result.success && result.data) {
      console.log(`✓ ${result.message}`);
      console.log(`\nGenerated files:`);
      console.log(`  Directory: ${result.data.directory}`);
      console.log(`  Workstation ID: ${result.data.workstationId}`);
      console.log(`  Organization ID: ${result.data.organizationId}`);
      console.log(`  API Port: ${result.data.apiPort}`);
      console.log(`  Files created: ${result.data.filesCreated.length}`);

      if (!options.dryRun) {
        console.log(`\nNext steps:`);
        console.log(`  1. cd ${options.directory}`);
        console.log(`  2. Edit config/config.yaml (add credentials)`);
        console.log(`  3. docker-compose up -d`);
      }
    } else {
      console.error(`✗ ${result.error}`);
      process.exit(1);
    }
  },

  async build(options: { directory: string; dryRun?: boolean }): Promise<void> {
    const result = await buildDockerImage(options);

    if (result.success && result.data) {
      console.log(`✓ ${result.message}`);

      if (result.data.buildSuccess && !options.dryRun) {
        console.log(`\nDocker image built for: ${result.data.directory}`);
        console.log(`\nNext steps:`);
        console.log(`  1. cd ${options.directory}`);
        console.log(`  2. docker-compose up -d`);
        console.log(`  3. docker-compose logs -f`);
      }
    } else {
      console.error(`✗ ${result.error}`);
      if (result.data?.buildOutput) {
        console.error(`\nBuild output:\n${result.data.buildOutput}`);
      }
      process.exit(1);
    }
  },
};
