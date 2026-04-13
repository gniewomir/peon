import { AbstractTransformation } from '../AbstractTransformation.js';
import { convert } from '@kreuzberg/html-to-markdown-node';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';

export class HtmlToMarkdownConverter extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const content = input.get(KnownArtifactsEnum.CLEAN_JOB_HTML) || '';
    return convert(content, {
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      headingStyle: 'Atx',
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      codeBlockStyle: 'Backticks',
      list_indent_type: 'tab',
      whitespace_mode: 'normalized',
      wrap: false,
      strip_newlines: true,
    });
  }
}
