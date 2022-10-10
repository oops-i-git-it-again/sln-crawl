#!/usr/bin/env node

import { program } from "commander";

program.name("Sample CLI");

program
  .command("add")
  .argument("a")
  .argument("b")
  .action((a, b) => {
    console.log(a + b);
  });

program.parse();
