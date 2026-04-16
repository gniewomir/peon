import { AbstractTransformation } from '../AbstractTransformation.js';
import { convert } from '@kreuzberg/html-to-markdown-node';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';

export class HtmlToMdConverterAll extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const content = input.get(KnownArtifactsEnum.CLEAN_JOB_HTML) || '';
    let markdown = convert(content, {
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      headingStyle: 'Atx',
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      codeBlockStyle: 'Backticks',
      list_indent_type: 'tab',
      whitespace_mode: 'normalized',
      wrap: false,
      strip_newlines: true,
    });

    // Normalize line endings
    markdown = markdown.replace(/\r\n/g, '\n');

    // Drop leading/trailing SPACES (not tabs) on each line.
    markdown = markdown
      .split('\n')
      .map((line) => line.replace(/^[ ]+/, '').replace(/[ ]+$/, ''))
      .join('\n');

    // Collapse multiple whitespace-only blank lines to a single blank line.
    markdown = markdown.replace(/(\n[ \t]*\n)(?:[ \t]*\n)+/g, '$1');

    return markdown;
  }
}
