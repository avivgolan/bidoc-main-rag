import fs from "node:fs";
import { MEMORY_LOG_PATH } from "../src/memoryLogger.js";

const requested = Number(process.argv[2] || 100);
const limit = Number.isFinite(requested) ? Math.min(1000, Math.max(1, Math.round(requested))) : 100;

if (!fs.existsSync(MEMORY_LOG_PATH)) {
  console.log(`No memory log exists yet: ${MEMORY_LOG_PATH}`);
  process.exit(0);
}

const lines = fs.readFileSync(MEMORY_LOG_PATH, "utf8").split(/\r?\n/).filter(Boolean).slice(-limit);
for (const line of lines) {
  try {
    console.log(JSON.stringify(JSON.parse(line), null, 2));
  } catch {
    console.log(line);
  }
}

