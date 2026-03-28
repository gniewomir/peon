import fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';
import { getPeonRepoRoot } from '../scrape/repoRoot.js';
import { ollamaChat } from '../llm/ollama.js';
import { stripHtmlToText, truncate } from '../llm/text.js';

type AnyRecord = Record<string, unknown>;

function parseOnlySlugs(only: string | undefined): Set<string> | null {
  if (!only || only.trim() === '') return null;
  return new Set(
    only
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const parts: string[] = [];
  for (const v of value) {
    const s = asString(v);
    if (s) parts.push(s);
  }
  return parts.length ? parts : null;
}

function buildEmploymentTypesSummary(employmentTypes: unknown): string | null {
  if (!Array.isArray(employmentTypes)) return null;
  const parts: string[] = [];

  for (const item of employmentTypes) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as AnyRecord;
    const from = obj.from;
    const to = obj.to;
    const currency = asString(obj.currency);
    const type = asString(obj.type);
    const gross = obj.gross;

    if (typeof from === 'number' && typeof to === 'number' && currency) {
      const grossPart = typeof gross === 'boolean' ? (gross ? 'gross' : 'net') : null;
      const typePart = type ? ` (${type})` : '';
      parts.push(`${from}-${to} ${currency}${typePart}${grossPart ? `, ${grossPart}` : ''}`.trim());
    }
  }

  return parts.length ? parts.join('; ') : null;
}

function normalizeToTwoParagraphs(output: string): string {
  const cleaned = output.replace(/\r/g, '').trim();
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length >= 2) {
    return `${paragraphs[0]}\n\n${paragraphs[1]}`;
  }

  if (paragraphs.length === 1) {
    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length >= 2) {
      const mid = Math.max(1, Math.floor(sentences.length / 2));
      const p1 = sentences.slice(0, mid).join(' ');
      const p2 = sentences.slice(mid).join(' ');
      return `${p1}\n\n${p2}`.trim();
    }
    // Fallback: duplicate into two paragraphs if the model gave a single blob.
    return `${cleaned}\n\n${cleaned}`;
  }

  return 'No summary generated.\n\nNo summary generated.';
}

function buildJobContext(job: AnyRecord, maxJobDescriptionChars: number): string {
  const title = asString(job.title);
  const companyName =
    asString(job.companyName) ?? asString(job.company) ?? asString(job.employer) ?? null;
  const location = asString(job.city) ?? null;
  const workplaceType = asString(job.workplaceType) ?? null;
  const workingTime = asString(job.workingTime) ?? null;
  const experienceLevel = asString(job.experienceLevel) ?? null;
  const requiredSkills = asStringArray(job.requiredSkills)?.join(', ') ?? null;
  const niceToHaveSkills = asStringArray(job.niceToHaveSkills)?.join(', ') ?? null;
  const languages =
    asStringArray(job.languages)?.join(', ') ??
    (Array.isArray(job.languages)
      ? job.languages
          .map((l) => (l && typeof l === 'object' ? (l as AnyRecord).code : null))
          .filter((x): x is string => typeof x === 'string')
          .join(', ') || null
      : null);

  const employmentTypesSummary = buildEmploymentTypesSummary(job.employmentTypes);
  const applyMethod = asString(job.applyMethod) ?? null;

  const html = asString(job.strategy_html_content) ?? '';
  const descriptionText = stripHtmlToText(html);
  const truncatedDescription = truncate(descriptionText, maxJobDescriptionChars);

  const context: AnyRecord = {
    title,
    companyName,
    location,
    workplaceType,
    workingTime,
    experienceLevel,
    requiredSkills,
    niceToHaveSkills,
    languages,
    employmentTypes: employmentTypesSummary,
    applyMethod,
  };

  // Keep prompt smaller by excluding null/undefined fields.
  const compactContext = Object.fromEntries(
    Object.entries(context).filter(([, v]) => v !== null && v !== undefined),
  );

  return `Job metadata:\n${JSON.stringify(compactContext, null, 2)}\n\nJob description text:\n${truncatedDescription}`;
}

async function discoverStrategySlugs(inDir: string): Promise<string[]> {
  const entries = await fs.readdir(inDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

function isJsonFile(name: string): boolean {
  return name.endsWith('.json');
}

export function registerSummaryCommand(program: Command): void {
  program
    .command('summary')
    .description('Summarize raw scraped jobs using a local Ollama LLM')
    .option('--in <dir>', 'Input directory with raw JSON (default: <repo>/data/raw)')
    .option('--out <dir>', 'Output directory (default: <repo>/data/summary)')
    .option('--only <slugs>', 'Comma-separated strategies to process (jji, nfj, bdj)')
    .option('--max-jobs <n>', 'Max jobs per run (0 = unlimited)', (v) => Number(v), 0)
    .option('--force', 'Overwrite existing summaries')
    .option('--dry-run', 'Do not call the LLM; only validate input & exit')
    .option('--model <model>', 'Ollama model (default: $OLLAMA_MODEL or qwen2.5:7b)')
    .option('--host <url>', 'Ollama host (default: $OLLAMA_HOST or http://127.0.0.1:11434)')
    .option('--temperature <n>', 'Sampling temperature', (v) => Number(v), 0.2)
    .option(
      '--max-job-description-chars <n>',
      'Truncate job description text sent to the model',
      (v) => Number(v),
      4000,
    )
    .action(
      async (opts: {
        in?: string;
        out?: string;
        only?: string;
        maxJobs?: number;
        force?: boolean;
        dryRun?: boolean;
        model?: string;
        host?: string;
        temperature?: number;
        maxJobDescriptionChars?: number;
      }) => {
        const root = getPeonRepoRoot();
        const inDir = path.resolve(opts.in ?? path.join(root, 'data', 'raw'));
        const outDir = path.resolve(opts.out ?? path.join(root, 'data', 'summary'));
        const strategyFilter = parseOnlySlugs(opts.only);

        const ollamaHost = opts.host ?? process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
        const ollamaModel = opts.model ?? process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';

        await fs.mkdir(outDir, { recursive: true });

        const slugs = await discoverStrategySlugs(inDir);
        const selectedSlugs = strategyFilter ? slugs.filter((s) => strategyFilter.has(s)) : slugs;

        if (!selectedSlugs.length) {
          throw new Error(`No strategy folders found in "${inDir}" (only=${opts.only ?? ''}).`);
        }

        const maxJobsLimit = opts.maxJobs ?? 0;
        let processedJobs = 0;
        for (const slug of selectedSlugs) {
          const inStrategyDir = path.join(inDir, slug);
          const outStrategyDir = path.join(outDir, slug);
          await fs.mkdir(outStrategyDir, { recursive: true });

          const entries = await fs.readdir(inStrategyDir, { withFileTypes: true });
          const jsonFiles = entries
            .filter((e) => e.isFile() && isJsonFile(e.name))
            .map((e) => e.name)
            .sort((a, b) => a.localeCompare(b));

          for (const fileName of jsonFiles) {
            const baseName = fileName.slice(0, -'.json'.length);
            const outFile = path.join(outStrategyDir, `${baseName}.md`);

            if (!opts.force) {
              try {
                await fs.access(outFile);
                continue; // Skip already summarized.
              } catch {
                // Not present; continue processing.
              }
            }

            const inFile = path.join(inStrategyDir, fileName);
            const raw = await fs.readFile(inFile, 'utf8');
            const job: AnyRecord = JSON.parse(raw) as AnyRecord;

            const context = buildJobContext(job, opts.maxJobDescriptionChars ?? 4000);

            const systemPrompt =
              'You summarize job offers for a human reader. Output exactly two short paragraphs separated by a blank line. ' +
              'Paragraph 1: the role and key responsibilities/what you will work on (mention relevant skills if present). ' +
              'Paragraph 2: location/work arrangement, employment type and compensation range if available, and how to apply. ' +
              'Do not use bullet lists, headings, quotes, or markdown. Use only the provided information; omit anything you cannot infer.';

            const userPrompt =
              `Summarize this job offer:\n\n${context}\n\n` + 'Remember: exactly two paragraphs.';

            if (opts.dryRun) {
              console.log(`dry-run: would write ${outFile}`);
              processedJobs += 1;
              if (maxJobsLimit > 0 && processedJobs >= maxJobsLimit) return;
              continue;
            }

            const ollamaText = await ollamaChat({
              host: ollamaHost,
              model: ollamaModel,
              systemPrompt,
              userPrompt,
              temperature: opts.temperature ?? 0.2,
            });

            const normalized = normalizeToTwoParagraphs(ollamaText);
            await fs.writeFile(outFile, normalized, 'utf8');

            processedJobs += 1;
            if (maxJobsLimit > 0 && processedJobs >= maxJobsLimit) return;
          }
        }
      },
    );
}
