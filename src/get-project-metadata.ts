import { DOMParser } from "@xmldom/xmldom";
import assert from "assert";
import { readFile } from "fs/promises";
import { finished } from "stream/promises";
import { select } from "xpath";
import search from "./search";

const getProjectMetadata = async (path: string): Promise<ProjectMetadata> => {
  const searchStream = search(path, /\.csproj$/);
  const metadata: ProjectMetadata = {};
  const processMetadataPromises: Promise<void>[] = [];
  searchStream.on("data", (pathBuffer: Buffer) =>
    processMetadataPromises.push(
      (async function processMetadata(path: string) {
        const projectXml = new DOMParser().parseFromString(
          (await readFile(path)).toString()
        );
        metadata[path] = new Set(
          select("/Project/ItemGroup/ProjectReference", projectXml).map(
            (element) => {
              assertIsElement(element);
              const referencePath = element.getAttribute("Include");
              assert(
                referencePath !== null,
                `ProjectReference missing Include attribute: ${element.outerHTML}`
              );
              return referencePath.replaceAll(/\\/g, "/");
            }
          )
        );
      })(pathBuffer.toString())
    )
  );
  await finished(searchStream);
  await Promise.all(processMetadataPromises);

  return metadata;
};
export default getProjectMetadata;

export type ProjectMetadata = { [path: string]: Set<string> };

function assertIsElement(
  element: string | number | boolean | Node | Attr
): asserts element is Element {
  assert(
    "getAttribute" in (element as object),
    `Expected value to be an element: ${element}`
  );
}
