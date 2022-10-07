import { describe, expect, test } from "@jest/globals";
import { add } from "./math";

describe("addition", () =>
  test("1 + 1 = 2", () => expect(add(1, 1)).toEqual(2)));
