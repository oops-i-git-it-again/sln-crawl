import { readdir } from "fs/promises";
import { join } from "path";

const search = (
  callback: (path: string) => unknown,
  path: string,
  matcher: RegExp
) =>
  new Promise<void>((resolve, reject) =>
    readdir(path)
      .then((contents) => {
        contents.forEach(
          (child) => matcher.test(child) && callback(join(path, child))
        );
        resolve();
      })
      .catch(reject)
  );
export default search;

export type Search = typeof search;
