import { readdir, stat } from "fs/promises";
import { join } from "path";

const search = (callback: Callback, path: string, matcher: RegExp) =>
  new Promise<void>((resolve, reject) =>
    readdir(path)
      .then((contents) =>
        Promise.all(
          contents.map(async (childName) => {
            const childPath = join(path, childName);
            const childStat = await stat(childPath);
            if (childStat.isDirectory()) {
              await search(callback, childPath, matcher);
            } else if (matcher.test(childName)) {
              callback(join(path, childName));
            }
          })
        )
          .then(() => resolve())
          .catch(reject)
      )
      .catch(reject)
  );
export default search;

export type Callback = (path: string) => unknown;
export type Search = typeof search;
