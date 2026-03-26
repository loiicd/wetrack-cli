import { resolve } from "path";
import type { Stack } from "wetrack-dashboard";

export interface DeployOptions {
  url: string;
  apiKey?: string;
  dryRun: boolean;
  verbose: boolean;
}

export async function deployCommand(
  filePath: string,
  options: DeployOptions,
): Promise<void> {
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
    typeof (stack as Stack).synthesize !== "function"
  ) {
    console.error(`❌  "${filePath}" hat keinen gültigen default-Export.`);
    console.error(`   Erwartet: export default new Stack(...)`);
    process.exit(1);
  }

  const typedStack = stack as Stack;
  const payload = typedStack.synthesize();

  console.log(
    `✅  Stack "${payload.key}" (${payload.environment}) synthetisiert`,
  );
  console.log(`   Dashboards  : ${payload.dashboards?.length ?? 0}`);
  console.log(`   DataSources : ${payload.dataSources?.length ?? 0}`);
  console.log(`   Queries     : ${payload.queries?.length ?? 0}`);
  console.log(`   Charts      : ${payload.charts?.length ?? 0}`);

  if (options.dryRun) {
    console.log("\n⚠️  Dry-run aktiv – kein Deployment durchgeführt.");
    if (options.verbose) {
      console.log("\nPayload:");
      console.log(JSON.stringify(payload, null, 2));
    }
    return;
  }

  console.log(`\n🚀  Deploying nach ${options.url} …`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(options.url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  const status = response.status;

  if (status >= 200 && status < 300) {
    console.log(`✅  Deployment erfolgreich (HTTP ${status})`);
    if (options.verbose && body) {
      console.log("Response:", body);
    }
  } else {
    console.error(`❌  Deployment fehlgeschlagen (HTTP ${status})`);
    try {
      const json = JSON.parse(body) as { error?: string; issues?: unknown[] };
      if (json.error) console.error(`   Fehler: ${json.error}`);
      if (json.issues?.length) {
        for (const issue of json.issues as { path?: unknown[]; message?: string }[]) {
          const path = issue.path?.join(".") ?? "<root>";
          console.error(`   • ${path}: ${issue.message}`);
        }
      }
    } catch {
      if (body) console.error("Response:", body);
    }
    process.exit(1);
  }
}
