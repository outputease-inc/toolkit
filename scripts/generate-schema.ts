import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { devStacksFileSchema } from "../src/schema/dev-stacks";

const schema = z.toJSONSchema(devStacksFileSchema, {
  target: "draft-2020-12",
});

const outPath = path.resolve(import.meta.dirname ?? ".", "..", "data", "dev-stacks.schema.json");
fs.writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`);
