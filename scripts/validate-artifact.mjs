import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
const manifestPath = resolve(projectRoot, "dist/.openai/hosting.json");

const [source, manifest] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);
JSON.parse(manifest);

// A data URL forces ESM parsing even though the generated output has no package.json.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const workerModule = await import(moduleUrl);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${pathToFileURL(workerPath)} must export default.fetch`,
);

const session=await workerModule.default.fetch(new Request('https://artifact.test/api/session',{headers:{'oai-authenticated-user-id':'test-id','oai-authenticated-user-email':'owner@example.test'}}),{AUTH_MODE:'sites',MANAGER_EMAILS:'owner@example.test'});
assert.equal(session.status,200);assert.equal((await session.json()).data.canWrite,true);
const denied=await workerModule.default.fetch(new Request('https://artifact.test/api/session',{headers:{'oai-authenticated-user-id':'test-id','oai-authenticated-user-email':'stranger@example.test'}}),{AUTH_MODE:'sites',MANAGER_EMAILS:'owner@example.test'});
assert.equal(denied.status,403);
console.log("Artifact is valid ESM; bundled session route authorizes manager and rejects unknown identity.");
