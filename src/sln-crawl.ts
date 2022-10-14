import assert from "assert";
import { execa } from "execa";
import { relative, resolve } from "path";
import { cwd } from "process";
import { Transform } from "stream";
import { finished } from "stream/promises";
import getProjectMetadata from "./get-project-metadata";
import assertResultsFulfilled from "./assert-results-fulfilled";

const slnCrawl = async (path: string) => {
  const projectMetadata = await getProjectMetadata(path);

  assertResultsFulfilled(
    await Promise.allSettled(
      Object.keys(projectMetadata).map(async (targetPath) => {
        const csProjFolder = resolve(
          targetPath.split("/").slice(0, -1).join("/")
        );
        const logPrefix = `sln-crawl [${targetPath}]: `;
        const csProjFileName = targetPath.split("/").at(-1);
        assert(csProjFileName !== undefined);
        const projectName = csProjFileName.replace(/(.*)\.csproj$/, "$1");

        await dotnet("new", "sln", "-n", projectName);
        const slnFileName = `${projectName}.sln`;
        await dotnet("sln", slnFileName, "add", csProjFileName);

        const referencesAdded = new Set<string>([targetPath]);
        const targetFolder = resolve(
          targetPath.split("/").slice(0, -1).join("/")
        );
        await addReferences(targetPath);

        async function addReferences(path: string) {
          for (const relativePath of projectMetadata[path].values()) {
            const absolutePath = resolve(
              path.split("/").slice(0, -1).join("/"),
              relativePath
            );
            const relativePathToTarget = relative(targetFolder, absolutePath);
            const relativePathToCwd = relative(cwd(), absolutePath);
            if (referencesAdded.has(relativePathToCwd)) {
              continue;
            }
            await dotnet("sln", slnFileName, "add", relativePathToTarget);
            referencesAdded.add(relativePathToCwd);
            await addReferences(relativePathToCwd);
          }
        }

        async function dotnet(...command: string[]) {
          const process = execa("dotnet", command, {
            cwd: csProjFolder,
            stdout: "pipe",
            stderr: "pipe",
          });

          process.stdout?.pipe(createConsoleStream("log"));
          process.stderr?.pipe(createConsoleStream("error"));

          await process;
          process.stdout && (await finished(process.stdout));
          process.stderr && (await finished(process.stderr));

          function createConsoleStream(func: "log" | "error") {
            let currentLine = "";
            const transform = new Transform({
              transform: (chunk, encoding, done) => {
                transform.push(chunk, encoding);
                done();
              },
            });

            transform.on("data", (data) => {
              let dataString: string;
              if (typeof data === "string") {
                dataString = data;
              } else if (Object.getPrototypeOf(data) === Buffer.prototype) {
                dataString = (data as Buffer).toString();
              } else {
                throw new Error(
                  `Unexpected stream data type: ${typeof data}; ${Object.getPrototypeOf(
                    data
                  )}`
                );
              }
              const lines = dataString.split(/\r?\n/);
              lines.slice(0, -1).forEach((line, index) => {
                write(`${currentLine}${line}`);
                if (index === 0) {
                  currentLine = "";
                }
              });
              if (lines.length > 0) {
                currentLine = lines.at(-1) ?? "";
              }
            });

            transform.on("close", writeFinalLine);
            transform.on("end", writeFinalLine);

            return transform;

            function write(message: string) {
              if (message.trim() !== "") {
                console[func](`${logPrefix}${message}`);
              }
            }

            function writeFinalLine() {
              if (currentLine.trim() !== "") {
                write(currentLine);
                currentLine = "";
              }
            }
          }
        }
      })
    )
  );
};
export default slnCrawl;
