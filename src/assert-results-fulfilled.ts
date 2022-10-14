import { EOL } from "os";

export default function assertResultsFulfilled<T>(
  results: PromiseSettledResult<T>[]
): asserts results is PromiseFulfilledResult<T>[] {
  if (results.some((result) => result.status === "rejected")) {
    throw new Error(
      results
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason)
        .join(EOL)
    );
  }
}
