import type { Dirent } from "fs";
import { readdir } from "fs/promises";
import { describe, expect, jest, test } from "@jest/globals";
import { join } from "path";
import type { Search } from "./search";

describe("search", () => {
  test("emits a file's full path when one is found", async () => {
    const [search, callback] = await setupSearch([
      ".",
      "sample.csproj",
      "Program.cs",
    ]);

    await search(callback, ".", /\.csproj$/);

    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toBe("sample.csproj");
  });

  test("searches recursively", async () => {
    const [search, callback] = await setupSearch([
      ".",
      "sample.csproj",
      ["subProject", "subProject.csproj"],
    ]);

    await search(callback, ".", /\.csproj$/);

    expect(callback.mock.calls.length).toBe(1);
    expect(callback.mock.calls[0][0]).toBe("sample.csproj");
  });
});

async function setupSearch(
  setup: ReaddirSetup
): Promise<[Search, jest.Mock<(path: string) => void>]> {
  const mock = jest.fn<typeof readdir>();

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
          return { ...map, ...buildPathMap(folderPath, childItem) };
        }
      },
      { [folderPath]: [] } as PathMap
    );
  };
  const map = buildPathMap(".", setup);

  mock.mockImplementation(((path: string) =>
    Promise.resolve(map[path])) as unknown as typeof readdir);
  jest.mock("fs/promises", () => {
    return { readdir: mock };
  });
  return [
    (await import("./search")).default,
    jest.fn<(path: string) => void>(),
  ];
}

type ReaddirSetup = [string, ...(string | ReaddirSetup)[]];
type PathMap = { [path: string]: Dirent[] };
