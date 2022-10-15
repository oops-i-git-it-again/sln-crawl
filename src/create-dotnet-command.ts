import { execa } from "execa";
import { Transform } from "stream";
import { finished } from "stream/promises";

const createDotnetCommand =
  (options?: { cwd?: string; logPrefix?: string }) =>
  async (...command: string[]) => {
    const process = execa("dotnet", command, {
      cwd: options?.cwd,
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
          console[func](`${options?.logPrefix ?? ""}${message}`);
        }
      }

      function writeFinalLine() {
        if (currentLine.trim() !== "") {
          write(currentLine);
          currentLine = "";
        }
      }
    }
  };
export default createDotnetCommand;
