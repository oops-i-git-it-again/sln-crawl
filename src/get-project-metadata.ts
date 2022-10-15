import { DOMParser } from "@xmldom/xmldom";
import assert from "assert";
import { readFile } from "fs/promises";
import { dirname, relative, resolve } from "path";
import { cwd } from "process";
import { finished } from "stream/promises";
import { select } from "xpath";
import search from "./search";

const getProjectMetadata = async (path: string): Promise<ProjectMetadata> => {
  const searchStream = search(path, /\.csproj$/);
  const metadata: ProjectMetadata = {};
  const processMetadataPromises: Promise<void>[] = [];
  searchStream.on("data", (pathBuffer: Buffer) =>
    processMetadataPromises.push(
      (async function processMetadata(csProjPath: string) {
        const projectFileContents = (await readFile(csProjPath)).toString();
        const projectXml = new DOMParser().parseFromString(projectFileContents);

        const dependencies = select(
          "/Project/ItemGroup/ProjectReference/@Include",
          projectXml
        ).map((referencePath) => {
          assertIsAttribute(referencePath);
          return relative(
            cwd(),
            resolve(
              dirname(csProjPath),
              referencePath.value.replaceAll(/\\/g, "/")
            )
          );
        });
        if (
          (function isTestProject() {
            return (
              select(
                '/Project/ItemGroup/PackageReference[@Include="Microsoft.NET.Test.Sdk"]',
                projectXml
              ).length > 0
            );
          })()
        ) {
          for (const dependency of dependencies) {
            if (!(dependency in metadata)) {
              metadata[dependency] = { testProjects: new Set() };
            } else if (!("testProjects" in metadata[dependency])) {
              metadata[dependency].testProjects = new Set();
            }
            metadata[dependency].testProjects?.add(csProjPath);
          }
        }
        if (dependencies.length > 0) {
          if (csProjPath in metadata) {
            metadata[csProjPath].dependencies = new Set(dependencies);
          } else {
            metadata[csProjPath] = {
              dependencies: new Set(dependencies),
            };
          }
        } else if (!(csProjPath in metadata)) {
          metadata[csProjPath] = {};
        }
      })(pathBuffer.toString())
    )
  );
  await finished(searchStream);
  await Promise.all(processMetadataPromises);

  return metadata;
};
export default getProjectMetadata;

export type ProjectMetadata = {
  [path: string]: { dependencies?: Set<string>; testProjects?: Set<string> };
};

function assertIsAttribute(
  attribute: string | number | boolean | Node | Attr
): asserts attribute is Attr {
  assert(
    "value" in (attribute as object),
    `Expected value to be an attribute: ${attribute}`
  );
}
