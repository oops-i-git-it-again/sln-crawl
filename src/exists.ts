import { PathLike } from "fs";
import { stat } from "fs/promises";
import isNodeError from "./is-node-error";

const exists = async (path: PathLike) => {
  try {
    await stat(path);
    return true;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};
export default exists;
