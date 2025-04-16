import { describe, expect, it } from "vitest";
import { greet } from "../src";

describe("greet", () => {
    it("should greet correctly", () => {
        expect(greet("World")).toBe("Hello, World!");
    });
});
