import { resolve } from "path";
import { writeFileSync } from "fs";
import type { Stack } from "wetrack-dashboard";

export interface SynthOptions {
  output?: string;
  verbose: boolean;
}

export async function synthCommand(
  filePath: string,
  options: SynthOptions,
): Promise<{ stack: Stack; json: string } | null> {
  const absolutePath = resolve(process.cwd(), filePath);

  // Dynamischer Import – Bun verarbeitet TypeScript nativ
  let mod: { default?: Stack };
  try {
    mod = await import(`file://${absolutePath}`);
  } catch (err) {
    console.error(`❌  Fehler beim Laden von "${filePath}":`);
    console.error(`   ${(err as Error).message}`);
    process.exit(1);
  }

  const stack = mod.default;

  if (
    !stack ||
    typeof stack !== "object" ||
    typeof stack.synthesize !== "function"
  ) {
    console.error(`❌  "${filePath}" hat keinen gültigen default-Export.`);
    console.error(`   Erwartet: export default new Stack(...)`);
    process.exit(1);
  }

  const payload = stack.synthesize();
  const json = JSON.stringify(payload, null, 2);

  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    writeFileSync(outputPath, json, "utf-8");
    console.log(
      `✅  Stack "${payload.key}" (${payload.environment}) synthetisiert`,
    );
    console.log(`   Dashboards  : ${payload.dashboards?.length ?? 0}`);
    console.log(`   DataSources : ${payload.dataSources?.length ?? 0}`);
    console.log(`   Queries     : ${payload.queries?.length ?? 0}`);
    console.log(`   Charts      : ${payload.charts?.length ?? 0}`);
    console.log(`\n📄  Ausgabe geschrieben nach: ${outputPath}`);
  } else {
    // Ohne -o: JSON direkt nach stdout (pipeable)
    if (options.verbose) {
      console.error(
        `✅  Stack "${payload.key}" (${payload.environment}) synthetisiert`,
      );
      console.error(`   Dashboards  : ${payload.dashboards?.length ?? 0}`);
      console.error(`   DataSources : ${payload.dataSources?.length ?? 0}`);
      console.error(`   Queries     : ${payload.queries?.length ?? 0}`);
      console.error(`   Charts      : ${payload.charts?.length ?? 0}`);
    }
    process.stdout.write(json + "\n");
  }

  return { stack, json };
}
