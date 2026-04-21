import { input, select } from "@inquirer/prompts";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { printSuccess, printError, printWarning } from "../utils/ui";
import chalk from "chalk";

function stackTemplate(name: string): string {
  return `import { Stack, Dashboard, DataSource, Query, Chart } from "wetrack-dashboard";

export default new Stack("${name}", "PRODUCTION")
  .addDashboard(new Dashboard("overview", { label: "Overview" }))
  .addDataSource(
    new DataSource("api", {
      type: "rest",
      config: { url: "https://api.example.com/data", method: "get" },
    })
  )
  .addQuery(
    new Query("items", {
      type: "jsonpath",
      dataSource: "api",
      jsonPath: "$[*]",
    })
  )
  .addChart(
    new Chart("chart-1", {
      dashboard: "overview",
      source: { _entity: "query", key: "items" },
      label: "Items",
      type: "bar",
      config: { categoryField: "name", valueFields: ["value"] },
    })
  );
`;
}

function githubActionsTemplate(ordner: string, name: string): string {
  return `name: Deploy WeTrack Dashboards
on:
  push:
    branches: [main]
    paths: ["${ordner}/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx wetrack-cli deploy ${ordner}/${name}.ts
        env:
          WETRACK_API_KEY: \${{ secrets.WETRACK_API_KEY }}
`;
}

function gitlabCiTemplate(ordner: string, name: string): string {
  return `deploy-dashboards:
  image: node:20
  stage: deploy
  only:
    changes:
      - ${ordner}/**
  script:
    - npx wetrack-cli deploy ${ordner}/${name}.ts
  variables:
    WETRACK_API_KEY: $WETRACK_API_KEY
`;
}

async function shouldOverwrite(filePath: string): Promise<boolean> {
  printWarning(`Datei existiert bereits: ${filePath}`);
  const answer = await select({
    message: "Überschreiben?",
    choices: [
      { name: "Yes", value: "yes" },
      { name: "No", value: "no" },
    ],
  });
  return answer === "yes";
}

async function writeFileSafe(
  filePath: string,
  content: string,
  createdFiles: string[],
): Promise<void> {
  if (existsSync(filePath)) {
    const overwrite = await shouldOverwrite(filePath);
    if (!overwrite) {
      printWarning(`Übersprungen: ${filePath}`);
      return;
    }
  }
  writeFileSync(filePath, content, "utf-8");
  createdFiles.push(filePath);
}

export async function initCommand(): Promise<void> {
  let name: string;
  try {
    name = await input({
      message: "Stack-Name:",
      default: "my-stack",
      validate: (value) => {
        if (!value.trim()) return "Name darf nicht leer sein.";
        if (!/^[a-zA-Z0-9-]+$/.test(value))
          return "Nur alphanumerische Zeichen und Bindestriche erlaubt.";
        return true;
      },
    });

    const ordner = await input({
      message: "Output-Ordner:",
      default: "dashboards",
    });

    const ci = await select({
      message: "CI-Provider:",
      choices: [
        { name: "GitHub Actions", value: "github" },
        { name: "GitLab CI", value: "gitlab" },
        { name: "Skip", value: "skip" },
      ],
    });

    const createdFiles: string[] = [];

    mkdirSync(ordner, { recursive: true });
    const stackFilePath = join(ordner, `${name}.ts`);
    await writeFileSafe(stackFilePath, stackTemplate(name), createdFiles);

    if (ci === "github") {
      mkdirSync(".github/workflows", { recursive: true });
      const workflowPath = ".github/workflows/deploy-dashboards.yml";
      await writeFileSafe(
        workflowPath,
        githubActionsTemplate(ordner, name),
        createdFiles,
      );
    } else if (ci === "gitlab") {
      const gitlabPath = ".gitlab-ci.yml";
      await writeFileSafe(
        gitlabPath,
        gitlabCiTemplate(ordner, name),
        createdFiles,
      );
    }

    console.log();
    for (const f of createdFiles) {
      printSuccess(`${ciLabel(ci, f)}erstellt: ${f}`);
    }

    console.log(chalk.bold("\nNächste Schritte:"));
    console.log(`  1. export WETRACK_API_KEY=sk_...`);
    console.log(`  2. wetrack deploy ${ordner}/${name}.ts`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).name === "ExitPromptError") {
      printWarning("Abgebrochen.");
      process.exit(0);
    }
    printError("Fehler beim Initialisieren", (err as Error).message);
    process.exit(1);
  }
}

function ciLabel(ci: string, filePath: string): string {
  if (filePath.includes(".github")) return "GitHub Actions Workflow ";
  if (filePath.includes(".gitlab")) return "GitLab CI ";
  return "Stack-Datei ";
}
