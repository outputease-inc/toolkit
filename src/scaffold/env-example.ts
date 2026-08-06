import type { DevStackEntry, DevStackRoute } from "../schema/dev-stacks";
import type { ResolvedStack } from "../schema/scaffold";

/**
 * Framework public-var prefix for the project's primary leaf route.
 * Total over the DevStackRoute enum; keyed on the PROJECT route
 * (stack.route), never a tool's own entry.route.
 */
export function clientPrefix(route: DevStackRoute): string {
  switch (route) {
    case "framework:nextjs":
      return "NEXT_PUBLIC_";
    case "framework:astro":
      return "PUBLIC_";
    case "platform:capacitor":
    case "platform:tauri":
      return "VITE_";
    default:
      return "";
  }
}

const PREAMBLE = `# Environment Variables
# Reference catalog of the env vars this project uses.
# Put real values in .env.local (git-ignored); never commit real secrets.

# Application
# APP_ENV=development
# PORT=3000`;

/**
 * Build a stack-aware environment example file from the resolved stack.
 * Always non-empty: the preamble + Application block ship even for a
 * zero-env stack, so the scaffold always writes a valid file.
 */
export function buildEnvExample(stack: ResolvedStack): string {
  const prefix = clientPrefix(stack.route);
  const emitted = new Set<string>();
  const blocks: string[] = [];

  const withEnv = stack.tools
    .filter(
      (t): t is DevStackEntry & { env: NonNullable<DevStackEntry["env"]> } =>
        Array.isArray(t.env) && t.env.length > 0,
    )
    .sort((a, b) => a.tool.localeCompare(b.tool));

  for (const t of withEnv) {
    const lines = [`# ${t.tool}`];
    let wrote = false;
    for (const v of t.env) {
      const name = `${v.clientExposed ? prefix : ""}${v.name}`;
      if (emitted.has(name)) continue;
      emitted.add(name);
      lines.push(`# ${v.purpose}`);
      if (v.whereToGet) lines.push(`# where to get: ${v.whereToGet}`);
      lines.push(`${name}=`);
      wrote = true;
    }
    if (wrote) blocks.push(lines.join("\n"));
  }

  return blocks.length > 0 ? `${PREAMBLE}\n\n${blocks.join("\n\n")}\n` : `${PREAMBLE}\n`;
}
