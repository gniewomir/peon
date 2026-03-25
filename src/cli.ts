#!/usr/bin/env node
import { Command } from 'commander';
import { registerExampleCommand } from './commands/example.js';

const program = new Command();

program.name('peon').description('Peon CLI').version('1.0.0');

registerExampleCommand(program);

program.parse();
