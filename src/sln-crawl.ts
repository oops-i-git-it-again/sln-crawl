import { execa } from "execa";
import { readFile } from "fs/promises";
import { EOL } from "os";
import { resolve } from "path";
import { Transform } from "stream";
import { finished } from "stream/promises";
import { DOMParser } from "@xmldom/xmldom";
import { select } from "xpath";
import search from "./search";

const slnCrawl = async (path: string) => {
  const csProjStream = search(path, /\.csproj$/);

  const dotNetPromises: Promise<void>[] = [];
  csProjStream.on("data", (csProjPathBuffer: Buffer) =>
    dotNetPromises.push(
      (async () => {
        const csProjPath = csProjPathBuffer.toString();
        const csProjFolder = resolve(
          csProjPath.split("/").slice(0, -1).join("/")
        );
        const logPrefix = `sln-crawl [${csProjPath}]: `;
        const csProjFileName = csProjPath.split("/").at(-1);
        if (!csProjFileName) {
          throw new Error(`Unable to find csproj: ${csProjPath}`);
        }
        const projectName = csProjFileName.replace(/(.*)\.csproj$/, "$1");

        await dotnet("new", "sln", "-n", projectName);
        const slnFileName = `${projectName}.sln`;
        await dotnet("sln", slnFileName, "add", csProjFileName);

        const referencesAdded = new Set<string>([csProjPath]);
        await addReferences(csProjPath);

        async function addReferences(csProjPath: string) {
          const csProjBuffer = await readFile(csProjPath);
          const csProjXml = new DOMParser().parseFromString(
            csProjBuffer.toString()
          );

          for (const projReference of select(
            "/Project/ItemGroup/ProjectReference",
            csProjXml
          )) {
            const referencePath = (projReference as Element)
              .getAttribute("Include")
              ?.replaceAll(/\\/g, "/");
            if (!referencePath) {
              throw new Error(
                `Could not retrieve path from Project reference node: ${
                  (projReference as Element).outerHTML
                }`
              );
            }
            const referenceAbsolutePath = resolve(
              csProjPath.split("/").slice(0, -1).join("/"),
              referencePath
            );
            if (referencesAdded.has(referenceAbsolutePath)) {
              continue;
            }
            await dotnet("sln", slnFileName, "add", referencePath);
            referencesAdded.add(referenceAbsolutePath);
            await addReferences(referenceAbsolutePath);
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
      })()
    )
  );

  await finished(csProjStream);

  const results = await Promise.allSettled(dotNetPromises);
  if (results.some((result) => result.status === "rejected")) {
    throw new Error(
      results
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason)
        .join(EOL)
    );
  }
};
export default slnCrawl;
