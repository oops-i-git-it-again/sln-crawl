import { describe, expect, test } from "@jest/globals";
import { join } from "path";
import getProjectMetadata, { ProjectMetadata } from "./get-project-metadata";

describe("getProjectMetadata", () => {
  testGetProjectMetadata("single-project", [
    {
      path: "test/single-project/input/ConsoleApp.csproj",
      dependencies: [],
    },
  ]);
  testGetProjectMetadata("include-project-dependencies", [
    {
      path: "test/include-project-dependencies/input/ConsoleApp/ConsoleApp.csproj",
      dependencies: ["../ClassLib/ClassLib.csproj"],
    },
    {
      path: "test/include-project-dependencies/input/ClassLib/ClassLib.csproj",
      dependencies: [],
    },
  ]);
});

function testGetProjectMetadata(testName: string, expected: ProjectMetadata[]) {
  test(testName, async () =>
    expect(
      convertMetadataToMap(
        await getProjectMetadata(join("test", testName, "input"))
      )
    ).toEqual(convertMetadataToMap(expected))
  );
}

function convertMetadataToMap(metadata: ProjectMetadata[]) {
  return metadata.reduce<ProjectMetadataMap>(
    (map, metadata) => ({
      ...map,
      [metadata.path]: {
        path: metadata.path,
        dependencies: new Set(metadata.dependencies),
      },
    }),
    {}
  );
}

type ProjectMetadataMap = {
  [path: string]: {
    path: ProjectMetadata["path"];
    dependencies: Set<ProjectMetadata["dependencies"][number]>;
  };
};
