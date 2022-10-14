import { describe, expect, test } from "@jest/globals";
import { join } from "path";
import getProjectMetadata, { ProjectMetadata } from "./get-project-metadata";

describe("getProjectMetadata", () => {
  testGetProjectMetadata("single-project", {
    "test/single-project/input/ConsoleApp.csproj": new Set(),
  });
  testGetProjectMetadata("include-project-dependencies", {
    "test/include-project-dependencies/input/ConsoleApp/ConsoleApp.csproj":
      new Set(["../ClassLib/ClassLib.csproj"]),
    "test/include-project-dependencies/input/ClassLib/ClassLib.csproj":
      new Set(),
  });
});

function testGetProjectMetadata(testName: string, expected: ProjectMetadata) {
  test(testName, async () =>
    expect(await getProjectMetadata(join("test", testName, "input"))).toEqual(
      expected
    )
  );
}
