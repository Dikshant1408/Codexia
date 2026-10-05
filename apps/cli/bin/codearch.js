#!/usr/bin/env node
import { runCli } from '../dist/index.js';

runCli(process.argv.slice(2)).catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err.message);
  process.exit(1);
});
