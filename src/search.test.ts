import type { Dirent } from "fs";
import type { readdir, stat } from "fs/promises";
import { describe, expect, jest, test } from "@jest/globals";
import { join } from "path";
import type { Callback, Search } from "./search";
import { finished } from "stream/promises";

const mockReaddir = jest.fn<typeof readdir>();
const mockStat = jest.fn<typeof stat>();
jest.mock("fs/promises", () => {
  return { readdir: mockReaddir, stat: mockStat };
});

describe("search", () => {
  test("emits a file's full path when one is found", async () => {
    const search = await setupSearch([".", "sample.csproj", "Program.cs"]);
    const callback = jest.fn<Callback>();

    const searchStream = search(".", /\.csproj$/);
    searchStream.on("data", callback);

    await finished(searchStream);
    expectCalls(callback, ["sample.csproj"]);
  });

  test("searches recursively", async () => {
    const search = await setupSearch([
      ".",
      "sample.csproj",
      "siblingSample.csproj",
      ["subProject", "subProject.csproj"],
      ["deeperProject", ["subFolder", ["lib", "myLib.csproj"]]],
    ]);
    const callback = jest.fn<Callback>();

    const searchStream = search(".", /\.csproj$/);
    searchStream.on("data", callback);

    await finished(searchStream);
    expectCalls(callback, [
      "sample.csproj",
      "siblingSample.csproj",
      "subProject/subProject.csproj",
      "deeperProject/subFolder/lib/myLib.csproj",
    ]);
  });
});

async function setupSearch(setup: ReaddirSetup): Promise<Search> {
  const buildPathMap = (root: string, setup: ReaddirSetup): PathMap => {
    const [folderName, ...contents] = setup;
    const folderPath = join(root, folderName);
    return contents.reduce(
      (map, childItem) => {
        if (typeof childItem === "string") {
          return {
            ...map,
            [folderPath]: [...map[folderPath], childItem as unknown as Dirent],
          };
        } else {
          return {
            ...map,
            ...buildPathMap(folderPath, childItem),
            [folderPath]: [
              ...map[folderPath],
              childItem[0] as unknown as Dirent,
            ],
          };
        }
      },
      { [folderPath]: [] } as PathMap
    );
  };
  const map = buildPathMap(".", setup);

  mockReaddir.mockImplementation(((path: string) =>
    Promise.resolve(map[path])) as unknown as typeof readdir);
  mockStat.mockImplementation(((path: string) => ({
    isDirectory: () => path in map,
  })) as unknown as typeof stat);

  return (await import("./search")).default;
}
type ReaddirSetup = [string, ...(string | ReaddirSetup)[]];
type PathMap = { [path: string]: Dirent[] };

function expectCalls(callback: jest.Mock<Callback>, paths: string[]) {
  expect(callback.mock.calls.length).toBe(paths.length);
  callback.mock.calls.forEach((call) =>
    expect(paths.some((path) => call[0] === path))
  );
}
