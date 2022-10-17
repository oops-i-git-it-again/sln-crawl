import NodeError from "./types/node-error";

const isNodeError = (error: unknown): error is NodeError => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return "code" in error;
};
export default isNodeError;
