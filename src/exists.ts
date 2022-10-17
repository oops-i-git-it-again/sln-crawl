import { PathLike } from "fs";
import { stat } from "fs/promises";

const exists = (path: PathLike) =>
  stat(path)
    .then(() => true)
    .catch((error: NodeError) => {
      if (error.code === "ENOENT") {
        return false;
      }
      throw error;
    });
export default exists;

interface NodeError extends Error {
  code?: string;
}
