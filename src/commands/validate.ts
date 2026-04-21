import { readFileSync } from "fs";
import { resolve } from "path";
import { stackSchema } from "wetrack-dashboard";
import { printError, printStackSummary, printSuccess } from "../utils/ui";

export interface ValidateOptions {
  verbose: boolean;
}

export function validateCommand(
  filePath: string,
  options: ValidateOptions,
): void {
  const absolutePath = resolve(process.cwd(), filePath);

  let raw: string;
  try {
    raw = readFileSync(absolutePath, "utf-8");
  } catch {
    printError(`Datei nicht gefunden: ${absolutePath}`);
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    printError(`Ungültiges JSON in "${filePath}"`, (err as Error).message);
    process.exit(1);
  }

  const result = stackSchema.safeParse(json);

  if (!result.success) {
    printError(`Validierung fehlgeschlagen für "${filePath}":`);
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      console.error(`   • ${path} — ${issue.message}`);
    }
    process.exit(1);
  }

  const data = result.data;
  printSuccess(`"${filePath}" ist valide`);
  printStackSummary({
    key: data.key,
    environment: data.environment,
    dashboards: data.dashboards?.length ?? 0,
    dataSources: data.dataSources?.length ?? 0,
    queries: data.queries?.length ?? 0,
    charts: data.charts?.length ?? 0,
  });

  if (options.verbose) {
    console.log("\nValidiertes Objekt:");
    console.log(JSON.stringify(data, null, 2));
  }
}
