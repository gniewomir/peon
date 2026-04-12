#!/usr/bin/env node
import { Command } from 'commander';
import { registerExtractCommand } from './commands/extract/index.js';
import { registerTransformCommand } from './commands/transform/index.js';

const program = new Command();

program.name('peon').description('Peon CLI').version('1.0.0');

registerExtractCommand(program);
registerTransformCommand(program);

program.parse();
