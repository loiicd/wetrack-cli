import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";
import type { Stack } from "wetrack-dashboard";
import { printError, printStackSummary, printSuccess, printWarning } from "../utils/ui";

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
    typeof (stack as Stack).synthesize !== "function"
  ) {
    printError(
      `"${filePath}" hat keinen gültigen default-Export.`,
      "Erwartet: export default new Stack(...)",
    );
    process.exit(1);
  }

  const typedStack = stack as Stack;
  const payload = typedStack.synthesize();

  printSuccess("Stack synthetisiert");
  printStackSummary({
    key: payload.key,
    environment: payload.environment,
    dashboards: payload.dashboards?.length ?? 0,
    dataSources: payload.dataSources?.length ?? 0,
    queries: payload.queries?.length ?? 0,
    charts: payload.charts?.length ?? 0,
  });

  if (options.dryRun) {
    printWarning("Dry-run aktiv – kein Deployment durchgeführt.");
    if (options.verbose) {
      console.log("\n" + chalk.dim(JSON.stringify(payload, null, 2)));
    }
    return;
  }

  const spinner = ora(
    `Deploying nach ${chalk.cyan(options.url)} …`,
  ).start();

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
    spinner.succeed(chalk.green(`Deployment erfolgreich (HTTP ${status})`));
    if (options.verbose && body) {
      console.log(chalk.dim("Response: " + body));
    }
  } else {
    spinner.fail(chalk.red(`Deployment fehlgeschlagen (HTTP ${status})`));
    try {
      const json = JSON.parse(body) as { error?: string; issues?: unknown[] };
      if (json.error) console.error(chalk.red(`   Fehler: ${json.error}`));
      if (json.issues?.length) {
        for (const issue of json.issues as { path?: unknown[]; message?: string }[]) {
          const path = issue.path?.join(".") ?? "<root>";
          console.error(chalk.dim(`   • ${path}: ${issue.message}`));
        }
      }
    } catch {
      if (body) console.error(chalk.dim("Response: " + body));
    }
    process.exit(1);
  }
}
