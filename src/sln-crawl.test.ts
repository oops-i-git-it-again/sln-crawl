import { cp, rm } from "fs/promises";
import { describe, expect, jest, test } from "@jest/globals";
import { join, relative } from "path";
import { finished } from "stream/promises";
import slnCrawl from "./sln-crawl";
import search from "./search";
import isNodeError from "./is-node-error";
import parseSln, { Sln } from "./parse-sln";

describe("sln-crawl", () => {
  jest.setTimeout(20000);
  test(
    "creates a sln for a simple, single project",
    runSlnCrawlTest("single-project")
  );
  test(
    "creates separate sln files for each project found in a single folder",
    runSlnCrawlTest("multiple-projects-in-same-dir")
  );
  test(
    "includes project dependencies in each project's solution",
    runSlnCrawlTest("include-project-dependencies")
  );
  test(
    "recursively includes project dependencies",
    runSlnCrawlTest("recursively-crawl-dependencies")
  );
  test(
    "adds test projects that reference sln projects and does not make sln files for test projects",
    runSlnCrawlTest("test-projects")
  );
  test("updates existing sln files", runSlnCrawlTest("update-existing-sln"));
});

function runSlnCrawlTest(testName: string) {
  return async () => {
    const testDir = join("test", testName);
    const tempDir = join(testDir, "temp");
    const inputDir = join(testDir, "input");
    const outputDir = join(testDir, "output");

    await (async function setupTestDir() {
      await (async function cleanup() {
        await rmDir(tempDir);

        const searchStream = search(testDir, /^(?:(?:bin)|(?:obj))$/);
        const rmPromises: Promise<void>[] = [];
        searchStream.on("data", (path: string) =>
          rmPromises.push(rmDir(path.toString()))
        );

        await finished(searchStream);
        await Promise.allSettled(rmPromises);
      })();

      await cp(inputDir, tempDir, { recursive: true });
    })();

    await slnCrawl(tempDir);

    expect(await getParsedSlns(tempDir)).toEqual(
      await getParsedSlns(outputDir)
    );
  };
}

async function rmDir(...path: string[]) {
  try {
    return await rm(join(...path), { recursive: true });
  } catch (error: unknown) {
    if (!(isNodeError(error) && error.code === "ENOENT")) {
      throw error;
    }
  }
}

async function getParsedSlns(path: string) {
  const parseSlnPromises: Promise<void>[] = [];
  const parsedSlns: { [path: string]: Sln } = {};
  const slnSearch = search(path, /\.sln$/);
  slnSearch.on("data", (slnPathBuffer: Buffer) =>
    parseSlnPromises.push(
      (async () => {
        const slnPath = slnPathBuffer.toString();
        parsedSlns[relative(path, slnPath)] = await parseSln(slnPath);
      })()
    )
  );
  await finished(slnSearch);
  await Promise.all(parseSlnPromises);
  return parsedSlns;
}
