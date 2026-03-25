import type { Command } from 'commander';

export function registerExampleCommand(program: Command): void {
  program
    .command('example')
    .description('Placeholder subcommand')
    .action(() => {
      console.log('example: ok');
    });
}
