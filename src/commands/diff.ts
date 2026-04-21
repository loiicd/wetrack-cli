import { resolve } from "path";
import chalk from "chalk";
import type { Stack, StackDefinition } from "wetrack-dashboard";
import { printError } from "../utils/ui";

export interface DiffOptions {
  url: string;
  apiKey?: string;
  verbose: boolean;
}

type EntityMap = Record<string, Record<string, unknown>>;

type DiffStatus = "NEU" | "ENTFERNT" | "GEÄNDERT" | "UNVERÄNDERT";

interface EntityDiff {
  key: string;
  status: DiffStatus;
}

interface SectionDiff {
  label: string;
  entries: EntityDiff[];
}

function buildEntityMap(
  entities: Array<{ key: string } & Record<string, unknown>> | undefined,
): EntityMap {
  const map: EntityMap = {};
  for (const entity of entities ?? []) {
    const { ...rest } = entity;
    map[entity.key] = rest;
  }
  return map;
}

function diffSection(
  localMap: EntityMap,
  remoteMap: EntityMap,
): EntityDiff[] {
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(remoteMap)]);
  const entries: EntityDiff[] = [];

  for (const key of allKeys) {
    const inLocal = key in localMap;
    const inRemote = key in remoteMap;

    if (inLocal && !inRemote) {
      entries.push({ key, status: "NEU" });
    } else if (!inLocal && inRemote) {
      entries.push({ key, status: "ENTFERNT" });
    } else {
      const localJson = JSON.stringify(localMap[key]);
      const remoteJson = JSON.stringify(remoteMap[key]);
      entries.push({
        key,
        status: localJson === remoteJson ? "UNVERÄNDERT" : "GEÄNDERT",
      });
    }
  }

  return entries;
}

function formatEntry(entry: EntityDiff, verbose: boolean): string | null {
  const pad = (s: string) => s.padEnd(30);

  switch (entry.status) {
    case "NEU":
      return chalk.green(`    + ${pad(entry.key)} [NEU]`);
    case "ENTFERNT":
      return chalk.red(`    - ${pad(entry.key)} [ENTFERNT]`);
    case "GEÄNDERT":
      return chalk.yellow(`    ~ ${pad(entry.key)} [GEÄNDERT]`);
    case "UNVERÄNDERT":
      return verbose ? chalk.dim(`    = ${pad(entry.key)} [unverändert]`) : null;
  }
}

function printDiff(
  payload: StackDefinition,
  remote: StackDefinition,
  verbose: boolean,
): void {
  console.log(`\nDiff: Stack ${chalk.bold(`"${payload.key}"`)} (${chalk.cyan(payload.environment)})\n`);

  const sections: SectionDiff[] = [
    {
      label: "Dashboards",
      entries: diffSection(
        buildEntityMap(payload.dashboards as Array<{ key: string } & Record<string, unknown>>),
        buildEntityMap(remote.dashboards as Array<{ key: string } & Record<string, unknown>>),
      ),
    },
    {
      label: "DataSources",
      entries: diffSection(
        buildEntityMap(payload.dataSources as Array<{ key: string } & Record<string, unknown>>),
        buildEntityMap(remote.dataSources as Array<{ key: string } & Record<string, unknown>>),
      ),
    },
    {
      label: "Queries",
      entries: diffSection(
        buildEntityMap(payload.queries as Array<{ key: string } & Record<string, unknown>>),
        buildEntityMap(remote.queries as Array<{ key: string } & Record<string, unknown>>),
      ),
    },
    {
      label: "Charts",
      entries: diffSection(
        buildEntityMap(payload.charts as Array<{ key: string } & Record<string, unknown>>),
        buildEntityMap(remote.charts as Array<{ key: string } & Record<string, unknown>>),
      ),
    },
  ];

  let totalNew = 0;
  let totalChanged = 0;
  let totalRemoved = 0;
  let totalUnchanged = 0;

  for (const section of sections) {
    const lines = section.entries
      .map((e) => formatEntry(e, verbose))
      .filter((l): l is string => l !== null);

    for (const e of section.entries) {
      if (e.status === "NEU") totalNew++;
      else if (e.status === "GEÄNDERT") totalChanged++;
      else if (e.status === "ENTFERNT") totalRemoved++;
      else totalUnchanged++;
    }

    if (lines.length > 0) {
      console.log(`  ${chalk.bold(section.label)}`);
      for (const line of lines) console.log(line);
      console.log();
    }
  }

  const hasDiff = totalNew > 0 || totalChanged > 0 || totalRemoved > 0;

  if (!hasDiff && totalUnchanged > 0) {
    console.log(chalk.green("✔  Kein Unterschied — deployed Stand ist aktuell."));
  } else {
    const parts: string[] = [];
    if (totalNew > 0) parts.push(chalk.green(`${totalNew} neu`));
    if (totalChanged > 0) parts.push(chalk.yellow(`${totalChanged} geändert`));
    if (totalRemoved > 0) parts.push(chalk.red(`${totalRemoved} entfernt`));
    if (totalUnchanged > 0 && verbose) parts.push(chalk.dim(`${totalUnchanged} unverändert`));
    console.log(`  Zusammenfassung: ${parts.join(" · ")}`);
  }
}

function printAllAsNew(
  payload: StackDefinition,
  verbose: boolean,
): void {
  console.log(`\nDiff: Stack ${chalk.bold(`"${payload.key}"`)} (${chalk.cyan(payload.environment)})\n`);
  console.log(chalk.yellow("⚠  Kein deployed Stack gefunden — alle Entitäten wären neu\n"));

  const allEntities = [
    { label: "Dashboards", items: payload.dashboards },
    { label: "DataSources", items: payload.dataSources },
    { label: "Queries", items: payload.queries },
    { label: "Charts", items: payload.charts },
  ];

  let total = 0;

  for (const { label, items } of allEntities) {
    if (!items?.length) continue;
    console.log(`  ${chalk.bold(label)}`);
    for (const item of items) {
      const key = (item as { key: string }).key;
      console.log(chalk.green(`    + ${key.padEnd(30)} [NEU]`));
      total++;
    }
    console.log();
  }

  console.log(`  Zusammenfassung: ${chalk.green(`${total} neu`)}`);
}

export async function diffCommand(
  filePath: string,
  options: DiffOptions,
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

  const payload = (stack as Stack).synthesize();
  const { key, environment } = payload;

  const url = `${options.url}?key=${encodeURIComponent(key)}&env=${encodeURIComponent(environment)}`;

  const headers: Record<string, string> = {};
  if (options.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers });
  } catch (err) {
    printError("Netzwerkfehler beim Abrufen des deployed Stacks", (err as Error).message);
    process.exit(1);
  }

  const status = response.status;

  if (status === 404) {
    printAllAsNew(payload, options.verbose);
    return;
  }

  if (status === 401 || status === 403) {
    printError(
      `Authentifizierungsfehler (HTTP ${status})`,
      "Bitte API-Key überprüfen (--api-key oder WETRACK_API_KEY).",
    );
    process.exit(1);
  }

  if (status < 200 || status >= 300) {
    const body = await response.text();
    printError(`Fehler beim Abrufen des deployed Stacks (HTTP ${status})`, body || undefined);
    process.exit(1);
  }

  let remote: StackDefinition;
  try {
    remote = (await response.json()) as StackDefinition;
  } catch (err) {
    printError("Ungültige JSON-Antwort vom Server", (err as Error).message);
    process.exit(1);
  }

  printDiff(payload, remote, options.verbose);
}
