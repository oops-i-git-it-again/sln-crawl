import { cp, readdir, readFile, rm, stat } from "fs/promises";
import { describe, expect, test } from "@jest/globals";
import { join } from "path";
import slnCrawl from "./sln-crawl";

describe("sln-crawl", () => {
  test(
    "creates a sln for a simple, single project",
    runSlnCrawlTest("single-project")
  );
  test(
    "creates separate sln's for each project found in a single folder",
    runSlnCrawlTest("multiple-projects-in-same-dir")
  );
});

function runSlnCrawlTest(testName: string) {
  return async () => {
    const testDir = join("test", testName);
    const tempDir = join(testDir, "temp");
    const inputDir = join(testDir, "input");
    const outputDir = join(testDir, "output");

    await (async function setupTestDir() {
      await (function cleanup() {
        return Promise.all([
          rmDir(tempDir),
          ...[inputDir, outputDir].map((parentDir) =>
            ["bin", "obj"].map((dir) => rmDir(parentDir, dir))
          ),
        ]);
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
  return rm(join(...path), { recursive: true }).catch(() => {
    // dir may not exist
  });
}

async function getDirectoryContents(
  path: string,
  excludeName = true
): Promise<DirectoryContents> {
  return {
    ...(excludeName ? {} : { name: path.at(-1) }),
    type: "directory",
    contents: await Promise.all(
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
                  const internalProjectIds: { id: string; name: string }[] = [];
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
    ),
  };
}

type DirectoryContents =
  | {
      name?: string;
      type: "directory";
      contents: DirectoryContents[];
    }
  | { name: string; type: "file"; contents: string[] };
