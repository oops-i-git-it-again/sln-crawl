import { cp, readdir, readFile, rm, stat } from "fs/promises";
import { describe, expect, jest, test } from "@jest/globals";
import { join } from "path";
import { finished } from "stream/promises";
import slnCrawl from "./sln-crawl";
import search from "./search";

describe("sln-crawl", () => {
  jest.setTimeout(1 << 30);
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
  /*test(
    "adds test projects that reference sln projects and does not make sln files for test projects",
    runSlnCrawlTest("test-projects")
  );*/
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

    expect(await getDirectoryContents(tempDir)).toEqual(
      await getDirectoryContents(outputDir)
    );
  };
}

function rmDir(...path: string[]) {
  return rm(join(...path), { recursive: true }).catch((error) => {
    if (!("code" in error && error.code === "ENOENT")) {
      throw error;
    }
  });
}

async function getDirectoryContents(
  path: string,
  excludeName = true
): Promise<DirectoryContents> {
  return {
    ...(excludeName ? {} : { name: path.at(-1) }),
    type: "directory",
    contents: (
      await Promise.all(
        (
          await readdir(path)
        ).map(async (childItem) => {
          return (await stat(join(path, childItem))).isDirectory()
            ? getDirectoryContents(join(path, childItem), false)
            : {
                name: childItem,
                type: "file",
                contents: await (async () => {
                  const lines = (await readFile(join(path, childItem)))
                    .toString()
                    .split(/\r?\n/);
                  if (/\.sln$/.test(childItem)) {
                    const internalProjectIds: { id: string; name: string }[] =
                      [];
                    lines
                      .filter((line) => line.startsWith("Project("))
                      .forEach((line) => {
                        const regex =
                          /^Project\("{[^}]*}"\) = "([^"]+)", "[^"]+", "{([^}]*)}"$/.exec(
                            line
                          );
                        if (!regex) {
                          throw new Error(
                            `Could not parse project line: ${line}`
                          );
                        }
                        internalProjectIds.push({
                          name: regex[1],
                          id: regex[2],
                        });
                      });
                    lines.forEach((line, index) => {
                      const newLine = internalProjectIds.reduce(
                        (newLine, internalProjectId) =>
                          newLine.replaceAll(
                            internalProjectId.id,
                            `{{ ${internalProjectId.name} INTERNAL ID }}`
                          ),
                        line
                      );
                      if (line !== newLine) {
                        lines[index] = newLine;
                      }
                    });
                  }
                  return lines;
                })(),
              };
        })
      )
    ).reduce(
      (contents, item) => ({ ...contents, [item.name ?? ""]: item }),
      {}
    ),
  };
}

type DirectoryContents =
  | {
      name?: string;
      type: "directory";
      contents: { [name: string]: DirectoryContents };
    }
  | { name: string; type: "file"; contents: string[] };
