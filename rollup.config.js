import { defineConfig } from "rollup";
import { babel } from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import shebang from "rollup-plugin-preserve-shebang";

export default defineConfig({
  external: ["commander"],
  input: "src/cli.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  plugins: [
    shebang(),
    babel({
      babelHelpers: "bundled",
      extensions: [".ts"],
      presets: [
        ["@babel/preset-env", { targets: { node: "current" } }],
        "@babel/preset-typescript",
      ],
    }),
    nodeResolve({ extensions: [".ts"] }),
  ],
});
