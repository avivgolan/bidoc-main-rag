import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedMachineSecret } from "../src/apiSecurity.js";

const env = { BIDOC_API_SECRET: "web-secret-value", INGEST_API_SECRET: "engine-secret-value" };

test("accepts the web app's shared secret", () => {
  assert.equal(isTrustedMachineSecret("web-secret-value", env), true);
});

test("accepts the ingest engine's dedicated secret", () => {
  assert.equal(isTrustedMachineSecret("engine-secret-value", env), true);
});

test("rejects anything else, including an empty header", () => {
  assert.equal(isTrustedMachineSecret("wrong", env), false);
  assert.equal(isTrustedMachineSecret("", env), false);
  assert.equal(isTrustedMachineSecret(undefined, env), false);
});

test("an unset INGEST_API_SECRET never matches an empty header", () => {
  assert.equal(isTrustedMachineSecret("", { BIDOC_API_SECRET: "web-secret-value" }), false);
  assert.equal(isTrustedMachineSecret("web-secret-value", { BIDOC_API_SECRET: "web-secret-value" }), true);
});

test("takes the first value of a repeated header", () => {
  assert.equal(isTrustedMachineSecret(["engine-secret-value", "x"], env), true);
});
