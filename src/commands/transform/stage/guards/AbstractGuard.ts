import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export abstract class AbstractGuard {
  abstract name(): string;
  abstract guard(result: string): Promise<AbstractGuardDecision>;

  protected toCheerio(input: string): CheerioAPI {
    return cheerio.load(input);
  }
}
