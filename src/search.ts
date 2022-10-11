import { readdir, stat } from "fs/promises";
import { join } from "path";
import { Readable, Transform } from "stream";

const search = (path: string, matcher: RegExp) => {
  const stream = new Transform({
    transform: (chunk, _, done) => {
      stream.push(chunk);
      done();
    },
  });

  (async () => {
    await searchRecursively(path);
    stream.end();
  })();

  async function searchRecursively(path: string) {
    const contents = await readdir(path);
    await Promise.all(
      contents.map(async (childName) => {
        const childPath = join(path, childName);
        if ((await stat(childPath)).isDirectory()) {
          await searchRecursively(childPath);
        } else if (matcher.test(childName)) {
          stream.write(join(path, childName));
        }
      })
    );
  }

  return stream as Readable;
};
export default search;

export type Callback = (path: string) => unknown;
export type Search = typeof search;
