import type { AbstractGuardDecision } from './outcomes/AbstractGuardDecision.js';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export abstract class AbstractGuard<T = string> {
  abstract name(): string;
  abstract guard(result: T): Promise<AbstractGuardDecision>;

  protected toCheerio(input: string): CheerioAPI {
    return cheerio.load(input);
  }
}
