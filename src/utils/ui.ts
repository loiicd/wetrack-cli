import chalk from "chalk";
import Table from "cli-table3";

export interface StackSummary {
  key: string;
  environment: string;
  dashboards: number;
  dataSources: number;
  queries: number;
  charts: number;
}

export function printStackSummary(summary: StackSummary): void {
  const table = new Table();
  table.push(
    [chalk.dim("Stack"), chalk.bold(summary.key)],
    [chalk.dim("Environment"), chalk.cyan(summary.environment)],
    [chalk.dim("Dashboards"), String(summary.dashboards)],
    [chalk.dim("DataSources"), String(summary.dataSources)],
    [chalk.dim("Queries"), String(summary.queries)],
    [chalk.dim("Charts"), String(summary.charts)],
  );
  console.log(table.toString());
}

export function printError(message: string, detail?: string): void {
  console.error(chalk.red(`✖  ${message}`));
  if (detail) console.error(chalk.dim(`   ${detail}`));
}

export function printWarning(message: string): void {
  console.warn(chalk.yellow(`⚠  ${message}`));
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`✔  ${message}`));
}
