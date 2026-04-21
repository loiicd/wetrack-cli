#!/usr/bin/env bun
import { Command } from "commander";
import { synthCommand } from "./commands/synth";
import { deployCommand } from "./commands/deploy";
import { validateCommand } from "./commands/validate";
import { initCommand } from "./commands/init";
import { diffCommand } from "./commands/diff";

const program = new Command();

program
  .name("wetrack")
  .description("WeTrack Dashboard-as-Code CLI")
  .version("1.0.0");

// ---- wetrack synth <file.ts> ----
program
  .command("synth <file>")
  .description("TypeScript-Stack synthetisieren und JSON ausgeben")
  .option("-o, --output <path>", "JSON in Datei schreiben statt stdout")
  .option("-v, --verbose", "Zusammenfassung auch bei stdout-Ausgabe anzeigen", false)
  .action(async (file: string, options: { output?: string; verbose: boolean }) => {
    await synthCommand(file, options);
  });

// ---- wetrack deploy <file.ts> ----
program
  .command("deploy <file>")
  .description("TypeScript-Stack synthetisieren und deployen")
  .option(
    "-u, --url <url>",
    "API-URL des WeTrack Dashboards",
    process.env.WETRACK_URL ?? "https://app.wetrack.dev/api/dashboard",
  )
  .option(
    "-k, --api-key <key>",
    "Clerk API Key (alternativ: WETRACK_API_KEY env var)",
  )
  .option("--dry-run", "Synthetisiert, aber kein Deployment durchführen", false)
  .option("-v, --verbose", "Ausführliche Ausgabe", false)
  .action(
    async (
      file: string,
      options: { url: string; apiKey?: string; dryRun: boolean; verbose: boolean },
    ) => {
      await deployCommand(file, {
        ...options,
        apiKey: options.apiKey ?? process.env.WETRACK_API_KEY,
      });
    },
  );

// ---- wetrack diff <file.ts> ----
program
  .command("diff <file>")
  .description("Lokalen Stack mit deployed Stand vergleichen")
  .option(
    "-u, --url <url>",
    "API-URL",
    process.env.WETRACK_URL ?? "https://app.wetrack.dev/api/dashboard",
  )
  .option("-k, --api-key <key>", "Clerk API Key (alternativ: WETRACK_API_KEY env var)")
  .option("-v, --verbose", "Auch unveränderte Entitäten anzeigen", false)
  .action(async (file: string, options: { url: string; apiKey?: string; verbose: boolean }) => {
    await diffCommand(file, {
      ...options,
      apiKey: options.apiKey ?? process.env.WETRACK_API_KEY,
    });
  });

// ---- wetrack validate <file.json> ----
program
  .command("validate <file>")
  .description("JSON-Datei gegen das WeTrack-Schema validieren")
  .action((file: string) => {
    validateCommand(file);
  });

// ---- wetrack init ----
program
  .command("init")
  .description("Neuen WeTrack Stack initialisieren")
  .action(async () => {
    await initCommand();
  });

program.parse(process.argv);
