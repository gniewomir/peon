#!/usr/bin/env node
import { Command } from 'commander';
import { registerExampleCommand } from './commands/example.js';
import { registerScrapeCommand } from './commands/scrape.js';

const program = new Command();

program.name('peon').description('Peon CLI').version('1.0.0');

registerExampleCommand(program);
registerScrapeCommand(program);

program.parse();
