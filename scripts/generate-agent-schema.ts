import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { agentStacksFileSchema } from "../src/schema/agent-stacks";

const schema = z.toJSONSchema(agentStacksFileSchema, {
	target: "draft-2020-12",
});

const outPath = path.resolve(import.meta.dirname ?? ".", "..", "data", "agent-stacks.schema.json");
fs.writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`);
