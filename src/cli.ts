#!/usr/bin/env node
import { Command } from 'commander';
import { registerScrapeCommand } from './commands/scrape.js';
import { registerSummaryCommand } from './commands/summary.js';

const program = new Command();

program.name('peon').description('Peon CLI').version('1.0.0');

registerScrapeCommand(program);
registerSummaryCommand(program);

program.parse();
