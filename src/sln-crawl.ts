import assert from "assert";
import { dirname, join, relative, resolve } from "path";
import { platform } from 'node:process';
import getProjectMetadata from "./get-project-metadata";
import assertResultsFulfilled from "./assert-results-fulfilled";
import createDotnetCommand from "./create-dotnet-command";
import exists from "./exists";

const pathDelim = platform === 'win32' ? "\\" : "/";

const slnCrawl = async (path: string) => {
  const projectMetadata = await getProjectMetadata(path);

  assertResultsFulfilled(
    await Promise.allSettled(
      Object.keys(projectMetadata).map(async (targetPath) => {
        if (projectMetadata[targetPath].isTestProject) {
          return;
        }

        
        const csProjFolder = resolve(
          targetPath.split(pathDelim).slice(0, -1).join(pathDelim)
        );
        const logPrefix = `sln-crawl [${targetPath}]: `;
        const dotnet = createDotnetCommand({ cwd: csProjFolder, logPrefix });
        const csProjFileName = targetPath.split(pathDelim).at(-1);
        assert(csProjFileName !== undefined);
        const projectName = csProjFileName.replace(/(.*)\.csproj$/, "$1");

        const slnFileName = `${projectName}.sln`;

        if (!(await exists(join(csProjFolder, slnFileName)))) {
          await dotnet("new", "sln", "-n", projectName);
        }
        await dotnet("sln", slnFileName, "add", csProjFileName);

        const referencesAdded = new Set<string>([targetPath]);
        const targetFolder = dirname(targetPath);
        await addReferences(targetPath);

        async function addReferences(path: string) {
          for (const referencePath of [
            ...(projectMetadata[path].dependencies?.values() ?? []),
            ...(projectMetadata[path].testProjects?.values() ?? []),
          ]) {
            if (referencesAdded.has(referencePath)) {
              continue;
            }
            const relativePath = relative(targetFolder, referencePath);
            await dotnet("sln", slnFileName, "add", relativePath);
            referencesAdded.add(referencePath);
            await addReferences(referencePath);
          }
        }
      })
    )
  );
};
export default slnCrawl;
