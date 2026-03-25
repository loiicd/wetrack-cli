import { readFileSync } from "fs";
import { resolve } from "path";
import { stackSchema } from "dashboard_as_code";

export interface ValidateOptions {
  verbose: boolean;
}

export function validateCommand(
  filePath: string,
  options: ValidateOptions
): void {
  const absolutePath = resolve(process.cwd(), filePath);

  // Datei einlesen
  let raw: string;
  try {
    raw = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(`❌  Datei nicht gefunden: ${absolutePath}`);
    process.exit(1);
  }

  // JSON parsen
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`❌  Ungültiges JSON in "${filePath}":`, (err as Error).message);
    process.exit(1);
  }

  // Validierung mit Zod
  const result = stackSchema.safeParse(json);

  if (!result.success) {
    console.error(`❌  Validierung fehlgeschlagen für "${filePath}":`);
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      console.error(`   • ${path} — ${issue.message}`);
    }
    process.exit(1);
  }

  const data = result.data;
  console.log(`✅  "${filePath}" ist valide`);
  console.log(`   Key         : ${data.key}`);
  console.log(`   Environment : ${data.environment}`);
  console.log(`   Dashboards  : ${data.dashboards?.length ?? 0}`);
  console.log(`   DataSources : ${data.dataSources?.length ?? 0}`);
  console.log(`   Queries     : ${data.queries?.length ?? 0}`);
  console.log(`   Charts      : ${data.charts?.length ?? 0}`);

  if (options.verbose) {
    console.log("\nValidiertes Objekt:");
    console.log(JSON.stringify(data, null, 2));
  }
}
