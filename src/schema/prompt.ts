import { toJSONSchema } from 'zod';

import { schema } from './schema.js';

type JsonSchemaNode = Record<string, unknown>;
type LeafField = {
  path: string;
  description: string;
  typeLabel: string;
  nullable: boolean;
  optional: boolean;
};

function asNode(value: unknown): JsonSchemaNode | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonSchemaNode;
}

function asNodeArray(value: unknown): JsonSchemaNode[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asNode(entry))
    .filter((entry): entry is JsonSchemaNode => entry !== null);
}

function getDescription(node: JsonSchemaNode): string | null {
  const description = node.description;
  return typeof description === 'string' && description.trim() ? description.trim() : null;
}

function isNullSchema(node: JsonSchemaNode): boolean {
  if (node.type === 'null') {
    return true;
  }
  if (!Array.isArray(node.type)) {
    return false;
  }
  return node.type.includes('null');
}

function allowsNull(node: JsonSchemaNode): boolean {
  if (isNullSchema(node)) {
    return true;
  }
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const variants = asNodeArray(node[key]);
    if (variants.some((variant) => allowsNull(variant))) {
      return true;
    }
  }
  return false;
}

function enumValues(node: JsonSchemaNode): string[] {
  const values = node.enum;
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .filter((value): value is string | number | boolean =>
      ['string', 'number', 'boolean'].includes(typeof value),
    )
    .map(String);
}

function primitiveTypes(node: JsonSchemaNode): Set<string> {
  const types = new Set<string>();

  if (typeof node.type === 'string' && node.type !== 'null') {
    types.add(node.type);
  }

  if (Array.isArray(node.type)) {
    for (const t of node.type) {
      if (typeof t === 'string' && t !== 'null') {
        types.add(t);
      }
    }
  }

  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const variants = asNodeArray(node[key]);
    for (const variant of variants) {
      for (const t of primitiveTypes(variant)) {
        if (t !== 'null') {
          types.add(t);
        }
      }
    }
  }

  return types;
}

function unwrapForObjectOrArray(node: JsonSchemaNode): JsonSchemaNode {
  if (asNode(node.properties) || asNode(node.items)) {
    return node;
  }

  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const variants = asNodeArray(node[key]).filter((variant) => !isNullSchema(variant));
    for (const variant of variants) {
      const unwrapped = unwrapForObjectOrArray(variant);
      if (asNode(unwrapped.properties) || asNode(unwrapped.items)) {
        return unwrapped;
      }
    }
  }

  return node;
}

function nodeTypeLabel(node: JsonSchemaNode): string {
  const values = enumValues(node);
  if (values.length > 0) {
    return `{${values.join(',')}}`;
  }

  const unwrapped = unwrapForObjectOrArray(node);
  if (asNode(unwrapped.properties)) {
    return 'object';
  }
  if (asNode(unwrapped.items)) {
    return 'array';
  }

  const types = [...primitiveTypes(node)];
  if (types.length > 0) {
    return types.join(' | ');
  }

  return 'unknown';
}

function requiredSet(node: JsonSchemaNode): Set<string> {
  const required = node.required;
  if (!Array.isArray(required)) {
    return new Set();
  }
  return new Set(required.filter((entry): entry is string => typeof entry === 'string'));
}

function collectLeafFields(
  node: JsonSchemaNode,
  path: string,
  isRequired: boolean,
  fields: LeafField[],
): void {
  const unwrapped = unwrapForObjectOrArray(node);
  const props = asNode(unwrapped.properties);
  const items = asNode(unwrapped.items);

  if (props) {
    const required = requiredSet(unwrapped);
    for (const [key, child] of Object.entries(props)) {
      const childNode = asNode(child);
      if (!childNode) {
        continue;
      }
      const nextPath = path ? `${path}.${key}` : key;
      collectLeafFields(childNode, nextPath, required.has(key), fields);
    }
    return;
  }

  if (items) {
    const description = getDescription(node);
    if (path && description) {
      fields.push({
        path,
        description,
        typeLabel: nodeTypeLabel(node),
        nullable: allowsNull(node),
        optional: !isRequired,
      });
    }

    const itemsPath = path ? `${path}[]` : '[]';
    collectLeafFields(items, itemsPath, true, fields);
    return;
  }

  const description = getDescription(node);
  if (path && description) {
    fields.push({
      path,
      description,
      typeLabel: nodeTypeLabel(node),
      nullable: allowsNull(node),
      optional: !isRequired,
    });
  }
}

function splitGroupAndField(path: string): { group: string; field: string } {
  const index = path.lastIndexOf('.');
  if (index < 0) {
    return { group: 'top-level', field: path };
  }
  return {
    group: path.slice(0, index),
    field: path.slice(index + 1),
  };
}

export function buildFullSystemPromptFromSchema(): string {
  const jsonSchema = asNode(toJSONSchema(schema, { target: 'draft-07' })) ?? {};
  const rootDescription = getDescription(jsonSchema);
  const lines: string[] = ['You extract structured data from job offers.'];

  if (rootDescription) {
    lines.push('', rootDescription);
  }

  lines.push(
    '',
    'Output contract:',
    '- Return only valid JSON matching the provided schema format.',
    '- Never hallucinate; use only information present in the input markdown.',
    '- Apply the field-level guidance below for extraction decisions.',
    '',
    'Field guidance:',
  );

  const leafFields: LeafField[] = [];
  collectLeafFields(jsonSchema, '', true, leafFields);

  let previousGroup: string | null = null;
  for (const leaf of leafFields) {
    const { group, field } = splitGroupAndField(leaf.path);
    if (group !== previousGroup) {
      lines.push('', `${group}:`);
      previousGroup = group;
    }

    const tags = [leaf.typeLabel];
    if (leaf.nullable) {
      tags.push('nullable');
    }
    if (leaf.optional) {
      tags.push('optional');
    }
    lines.push(`- ${field} (${tags.join(', ')}): ${leaf.description}`);
  }

  return lines.join('\n');
}

export const fullSystemPrompt = buildFullSystemPromptFromSchema();
export const basicSystemPrompt = `
You extract structured data from job offers.

Output contract:
- Return only valid JSON matching the provided schema format.
- Never hallucinate; use only information present in the input markdown.
- Apply the field-level guidance below for extraction decisions.

Rules:
- If a string value cannot be confidently inferred, output null.
- For booleans: true/false if clearly stated or strongly implied; otherwise null.
- For arrays: always output an array (use [] if none).
- Prefer short, canonical tokens in lists (e.g. "TypeScript", "PostgreSQL", "AWS", "Docker"). Keep original capitalization.
`;

export function buildUserPrompt(jobMarkdown: string): string {
  return ['Job offer (Markdown):', '<<<', jobMarkdown, '>>>'].join('\n');
}
