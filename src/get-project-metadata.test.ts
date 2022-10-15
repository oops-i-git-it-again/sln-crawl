import { describe, expect, test } from "@jest/globals";
import { join } from "path";
import getProjectMetadata, { ProjectMetadata } from "./get-project-metadata";

describe("getProjectMetadata", () => {
  testGetProjectMetadata("single-project", {
    "ConsoleApp.csproj": {},
  });
  testGetProjectMetadata("include-project-dependencies", {
    "ConsoleApp/ConsoleApp.csproj": {
      dependencies: new Set(["ClassLib/ClassLib.csproj"]),
    },
    "ClassLib/ClassLib.csproj": {},
  });
  testGetProjectMetadata("test-projects", {
    "ConsoleApp/ConsoleApp.csproj": {
      testProjects: new Set([
        "ConsoleApp.MsTest/ConsoleApp.MsTest.csproj",
        "ConsoleApp.NUnit/ConsoleApp.NUnit.csproj",
        "ConsoleApp.XUnit/ConsoleApp.XUnit.csproj",
      ]),
    },
    "ConsoleApp.MsTest/ConsoleApp.MsTest.csproj": {
      dependencies: new Set(["ConsoleApp/ConsoleApp.csproj"]),
    },
    "ConsoleApp.NUnit/ConsoleApp.NUnit.csproj": {
      dependencies: new Set(["ConsoleApp/ConsoleApp.csproj"]),
    },
    "ConsoleApp.XUnit/ConsoleApp.XUnit.csproj": {
      dependencies: new Set(["ConsoleApp/ConsoleApp.csproj"]),
    },
  });
});

function testGetProjectMetadata(testName: string, expected: ProjectMetadata) {
  test(testName, async () =>
    expect(await getProjectMetadata(join("test", testName, "input"))).toEqual(
      Object.fromEntries(
        Object.entries(expected).map(([path, metadata]) => [
          join("test", testName, "input", path),
          {
            ...prependPathsToSet(metadata, "dependencies"),
            ...prependPathsToSet(metadata, "testProjects"),
          },
        ])
      )
    )
  );

  function prependPathsToSet(
    metadata: ProjectMetadata[string],
    property: keyof ProjectMetadata[string]
  ) {
    const paths = metadata[property];
    return paths
      ? {
          [property]: new Set(
            [...paths.values()].map((path) =>
              join("test", testName, "input", path)
            )
          ),
        }
      : {};
  }
}
