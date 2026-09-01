import { registerChatQualityTests } from "./chat-quality.tests.js";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
registerChatQualityTests(test);

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error?.stack || error);
  }
}

if (failed) {
  console.error(`${failed}/${tests.length} chat quality tests failed`);
  process.exit(1);
}
console.log(`${tests.length} chat quality tests passed`);
