#!/usr/bin/env node

import { program } from "commander";
import { add } from "./math";

program.name("Sample CLI");

program
  .command("add")
  .argument("a")
  .argument("b")
  .action((a, b) => {
    console.log(add(a, b));
  });

program.parse();
