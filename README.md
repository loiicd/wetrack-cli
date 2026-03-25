# wetrack-cli

CLI tool for deploying **Dashboard-as-Code** stacks to a WeTrack instance.

## Installation

```bash
# with Bun (recommended)
bun add -g @wetrack/cli

# with npm
npm install -g @wetrack/cli
```

## Quick Start

```bash
# 1. Create a stack file
cat > mystack.ts << 'EOF'
import { Stack, Dashboard, DataSource, Query, Chart } from "dashboard_as_code";

const stack = new Stack("my-stack", "PRODUCTION")
  .addDashboard(new Dashboard("main", { label: "My Dashboard" }))
  .addDataSource(new DataSource("api", {
    type: "rest",
    config: { url: "https://api.example.com/data", method: "get" }
  }))
  .addQuery(new Query("items", {
    type: "jsonpath",
    dataSource: "api",
    jsonPath: "$.items[*]"
  }))
  .addChart(new Chart("chart1", {
    dashboard: "main",
    query: "items",
    label: "Items",
    type: "bar",
    config: { categoryField: "name", valueFields: ["count"] }
  }));

export default stack;
EOF

# 2. Deploy
export WETRACK_API_KEY=your_clerk_api_key
wetrack deploy mystack.ts --url https://your-wetrack-instance.com/api/dashboard
```

## Commands

### `wetrack synth <file>`

Synthesizes a TypeScript stack file to JSON without deploying.

```bash
wetrack synth mystack.ts                  # Output JSON to stdout
wetrack synth mystack.ts -o output.json   # Save to file
wetrack synth mystack.ts --verbose        # Show summary + JSON
```

**Options:**

| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Save JSON to file instead of stdout |
| `-v, --verbose` | Show summary even when outputting to stdout |

---

### `wetrack deploy <file>`

Synthesizes and deploys a stack to a WeTrack instance.

```bash
wetrack deploy mystack.ts
wetrack deploy mystack.ts --url https://app.wetrack.io/api/dashboard
wetrack deploy mystack.ts --api-key sk_live_xxx
wetrack deploy mystack.ts --dry-run      # Synth only, no deploy
```

**Options:**

| Flag | Description |
|------|-------------|
| `-u, --url <url>` | API URL (default: `http://localhost:3000/api/dashboard`) |
| `-k, --api-key <key>` | Clerk API Key for authentication |
| `--dry-run` | Synthesize but do not deploy |
| `-v, --verbose` | Verbose output |

---

### `wetrack validate <file>`

Validates a synthesized JSON stack file against the schema.

```bash
wetrack validate output.json
```

## Authentication

For remote deployments, you need a Clerk API Key from your WeTrack instance:

1. Go to **Settings → API Keys** in your WeTrack dashboard
2. Create a new API key
3. Use it via `--api-key` flag or `WETRACK_API_KEY` environment variable:

```bash
# Environment variable (recommended for CI/CD)
export WETRACK_API_KEY=sk_live_xxx
wetrack deploy mystack.ts --url https://app.wetrack.io/api/dashboard

# Flag
wetrack deploy mystack.ts --api-key sk_live_xxx
```

## CI/CD Example (GitHub Actions)

```yaml
- name: Deploy WeTrack Stack
  run: wetrack deploy stacks/production.ts --url ${{ vars.WETRACK_URL }}
  env:
    WETRACK_API_KEY: ${{ secrets.WETRACK_API_KEY }}
```

## Chart Types

| Type | Description | Required Config |
|------|-------------|-----------------|
| `bar` | Bar chart (vertical or horizontal) | `categoryField`, `valueFields` |
| `line` | Line chart (multi-series) | `xField`, `valueFields` |
| `stat` | Single value card | `valueField` |
| `clock` | Timezone-aware clock | `timeZone` (optional) |

## DataSource Types

| Type | Description |
|------|-------------|
| `rest` | HTTP REST API (GET/POST/PUT) |

## Development

```bash
bun install
bun run src/index.ts synth mystack.ts
```

