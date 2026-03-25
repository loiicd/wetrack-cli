#!/usr/bin/env bun
import { Command } from "commander";
import { synthCommand } from "./commands/synth";
import { deployCommand } from "./commands/deploy";

const program = new Command();

program
  .name("wetrack")
  .description("WeTrack Dashboard-as-Code CLI")
  .version("0.1.0");

// ---- wetrack synth <file.ts> ----
program
  .command("synth <file>")
  .description("TypeScript-Stack synthetisieren und JSON ausgeben")
  .option("-o, --output <path>", "JSON in Datei schreiben statt stdout")
  .option(
    "-v, --verbose",
    "Zusammenfassung auch bei stdout-Ausgabe anzeigen",
    false,
  )
  .action(
    async (file: string, options: { output?: string; verbose: boolean }) => {
      await synthCommand(file, options);
    },
  );

// ---- wetrack deploy <file.ts> ----
program
  .command("deploy <file>")
  .description("TypeScript-Stack synthetisieren und deployen")
  .option(
    "-u, --url <url>",
    "API-URL des WeTrack Dashboards",
    "http://localhost:3000/api/dashboard",
  )
  .option(
    "-k, --api-key <key>",
    "Clerk API Key für Authentifizierung (alternativ: WETRACK_API_KEY env var)",
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

program.parse(process.argv);
