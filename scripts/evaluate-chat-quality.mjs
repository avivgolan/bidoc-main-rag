import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  evaluateChatQualitySuite,
  hashFixture,
  renderChatQualityMarkdown
} from "../src/qa/chatQualityBaseline.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const fixturePath = resolveInsideRoot(args.fixture || "test/fixtures/chat-quality-smoke.v1.json");
const fixtureText = fs.readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText);
const generatedAt = args.generatedAt || new Date().toISOString();
const date = generatedAt.slice(0, 10);
const outputPath = resolveInsideRoot(args.output || `docs/evaluations/chat-quality-baseline-${date}.md`);
const report = evaluateChatQualitySuite(fixture, {
  generatedAt,
  commit: args.commit || currentCommit(),
  fixtureHash: hashFixture(JSON.parse(fixtureText))
});
const markdown = renderChatQualityMarkdown(report);

if (!args.noWrite) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${markdown.trimEnd()}\n`, "utf8");
}

if (args.json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(`Chat quality smoke set: ${report.summary.passedCases}/${report.summary.totalCases} cases passed`);
  console.log(`Assertions: ${report.summary.passedAssertions}/${report.summary.totalAssertions} passed`);
  console.log(`Mode: ${report.scope.mode}; network=${report.scope.networkCalls}; database_writes=${report.scope.databaseWrites}`);
  console.log(args.noWrite ? "Report write skipped" : `Report: ${path.relative(root, outputPath)}`);
}

if (args.check && report.summary.failedCases > 0) process.exitCode = 1;

function parseArgs(values) {
  const parsed = { check: false, noWrite: false, json: false };
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (key === "--check") parsed.check = true;
    else if (key === "--no-write") parsed.noWrite = true;
    else if (key === "--json") parsed.json = true;
    else if (["--fixture", "--output", "--generated-at", "--commit"].includes(key)) {
      const value = values[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${key} requires a value`);
      parsed[toCamelCase(key.slice(2))] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }
  return parsed;
}

function resolveInsideRoot(value) {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path must stay inside the repository: ${value}`);
  }
  return resolved;
}

function currentCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/gu, (_match, character) => character.toUpperCase());
}
