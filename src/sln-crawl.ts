import { execa } from "execa";
import { EOL } from "os";
import { resolve } from "path";
import { Transform } from "stream";
import { finished } from "stream/promises";
import search from "./search";

const slnCrawl = async (path: string) => {
  const csProjStream = search(path, /\.csproj$/);

  const dotNetPromises: Promise<void>[] = [];
  csProjStream.on("data", (csProjPathBuffer: Buffer) => {
    const csProjPath = csProjPathBuffer.toString();
    const logPrefix = `sln-crawl [${csProjPath}]: `;
    const csProjFileName = csProjPath.split("/").at(-1);
    if (!csProjFileName) {
      throw new Error(`Unable to find csproj: ${csProjPath}`);
    }
    const projectName = csProjFileName.replace(/(.*)\.csproj$/, "$1");

    const folder = resolve(csProjPath.split("/").slice(0, -1).join("/"));
    dotNetPromises.push(
      (async () => {
        await dotnet("new", "sln", "-n", projectName);
        const slnFileName = `${projectName}.sln`;
        await dotnet("sln", slnFileName, "add", csProjFileName);

        async function dotnet(...command: string[]) {
          const process = execa("dotnet", command, {
            cwd: folder,
            stdout: "pipe",
            stderr: "pipe",
          });

          let lastPipeWasOut = true;
          let currentOutLine = "";
          process.stdout?.pipe(
            new Transform({
              transform: (chunk: Buffer, encoding: string, done) => {
                const output = chunk.toString(
                  encoding === "buffer"
                    ? undefined
                    : (encoding as BufferEncoding)
                );
                const outputLines = output.split(/\r?\n/);
                outputLines.slice(0, -1).forEach((line) => {
                  const totalLine = `${currentOutLine}${line}`;
                  if (totalLine.trim() !== "") {
                    console.log(`${logPrefix}${totalLine}`);
                  }
                });
                currentOutLine = outputLines.at(-1) ?? "";
                lastPipeWasOut = true;
                done();
              },
            })
          );
          let currentErrLine = "";
          const errorTransform = new Transform({
            transform: (chunk: Buffer, encoding: string, done) => {
              const output = chunk.toString(
                encoding === "buffer" ? undefined : (encoding as BufferEncoding)
              );
              const outputLines = output.split(/\r?\n/);
              outputLines.slice(0, -1).forEach((line) => {
                const totalLine = `${currentErrLine}${line}`;
                if (totalLine.trim() !== "") {
                  console.error(`${logPrefix}${totalLine}`);
                }
              });
              currentErrLine = outputLines.at(-1) ?? "";
              lastPipeWasOut = false;
              done();
            },
          });
          process.stderr?.pipe(errorTransform);

          try {
            await process;
          } finally {
            if (process.stderr) {
              await finished(process.stderr);
            }
            if (process.stdout) {
              await finished(process.stdout);
            }
            if (lastPipeWasOut) {
              if (currentErrLine.trim() !== "") {
                console.error(`${logPrefix}${currentErrLine}`);
              }
              if (currentOutLine.trim() !== "") {
                console.log(`${logPrefix}${currentOutLine}`);
              }
            } else {
              if (currentOutLine.trim() !== "") {
                console.log(`${logPrefix}${currentOutLine}`);
              }
              if (currentErrLine.trim() !== "") {
                console.error(`${logPrefix}${currentErrLine}`);
              }
            }
          }
        }
      })()
    );
  });

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
