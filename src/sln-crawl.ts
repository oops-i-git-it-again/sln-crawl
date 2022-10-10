import { execa } from "execa";
import { resolve } from "path";
import { finished } from "stream/promises";
import search from "./search";

const slnCrawl = async (path: string) => {
  const csProjStream = search(path, /\.csproj$/);

  const dotNetPromises: Promise<void>[] = [];
  csProjStream.on("data", (csProjPathBuffer: Buffer) => {
    const csProjPath = csProjPathBuffer.toString();
    const csProjFileName = csProjPath.split("/").at(-1);
    if (!csProjFileName) {
      throw new Error(`Unable to find csproj: ${csProjPath}`);
    }
    const projectName = csProjFileName.replace(/(.*)\.csproj$/, "$1");

    const folder = resolve(csProjPath.split("/").slice(0, -1).join("/"));
    dotNetPromises.push(
      (async () => {
        await dotnet("new", "sln", "-n", projectName);
        await dotnet("sln", "add", csProjFileName);

        function dotnet(...command: string[]) {
          return execa("dotnet", command, {
            cwd: folder,
          });
        }
      })()
    );
  });

  await finished(csProjStream);
  await Promise.all(dotNetPromises);
};
export default slnCrawl;
