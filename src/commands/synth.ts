import { resolve } from "path";
import { writeFileSync } from "fs";
import chalk from "chalk";
import type { Stack } from "wetrack-dashboard";
import { printError, printStackSummary, printSuccess } from "../utils/ui";

export interface SynthOptions {
  output?: string;
  verbose: boolean;
}

export async function synthCommand(
  filePath: string,
  options: SynthOptions,
): Promise<{ stack: Stack; json: string } | null> {
  const absolutePath = resolve(process.cwd(), filePath);

  let mod: { default?: Stack };
  try {
    mod = await import(`file://${absolutePath}`);
  } catch (err) {
    printError(`Fehler beim Laden von "${filePath}"`, (err as Error).message);
    process.exit(1);
  }

  const stack = mod.default;

  if (
    !stack ||
    typeof stack !== "object" ||
    typeof stack.synthesize !== "function"
  ) {
    printError(
      `"${filePath}" hat keinen gültigen default-Export.`,
      "Erwartet: export default new Stack(...)",
    );
    process.exit(1);
  }

  const payload = stack.synthesize();
  const json = JSON.stringify(payload, null, 2);

  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    writeFileSync(outputPath, json, "utf-8");
    printSuccess("Stack synthetisiert");
    printStackSummary({
      key: payload.key,
      environment: payload.environment,
      dashboards: payload.dashboards?.length ?? 0,
      dataSources: payload.dataSources?.length ?? 0,
      queries: payload.queries?.length ?? 0,
      charts: payload.charts?.length ?? 0,
    });
    console.log(chalk.dim(`\n📄  Ausgabe: ${outputPath}`));
  } else {
    // Ohne -o: JSON direkt nach stdout (pipeable)
    if (options.verbose) {
      process.stderr.write(chalk.green("✔  Stack synthetisiert\n"));
      printStackSummary({
        key: payload.key,
        environment: payload.environment,
        dashboards: payload.dashboards?.length ?? 0,
        dataSources: payload.dataSources?.length ?? 0,
        queries: payload.queries?.length ?? 0,
        charts: payload.charts?.length ?? 0,
      });
    }
    process.stdout.write(json + "\n");
  }

  return { stack, json };
}
