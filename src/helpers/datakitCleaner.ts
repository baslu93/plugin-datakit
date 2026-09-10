import { readFile, writeFile, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import fg from 'fast-glob';
import { parseStringPromise } from 'xml2js';

const REL_END_PATTERN = /^rel_\d+_end$/;

export interface DeletedField {
  file: string;
  apiName: string;
  reason: 'KeyQualifier' | 'RelEnd';
}

export interface CleanStats {
  deletedFields: DeletedField[];
  updatedTemplates: string[];
}

async function parseXmlFile(filePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(filePath, 'utf8');
  return parseStringPromise(content, { explicitArray: false, ignoreAttrs: true });
}

async function shouldDelete(filePath: string): Promise<{ yes: true; apiName: string; reason: 'KeyQualifier' | 'RelEnd' } | { yes: false }> {
  try {
    const parsed = await parseXmlFile(filePath);
    const field = parsed['CustomField'] as Record<string, unknown>;
    if (!field) return { yes: false };

    const attrs = field['mktDataModelFieldAttributes'] as Record<string, string> | undefined;
    if (attrs?.usageTag === 'KeyQualifier') {
      return { yes: true, apiName: basename(filePath).replace('.field-meta.xml', ''), reason: 'KeyQualifier' };
    }

    const relName = field['relationshipName'] as string | undefined;
    if (relName && REL_END_PATTERN.test(relName)) {
      return { yes: true, apiName: basename(filePath).replace('.field-meta.xml', ''), reason: 'RelEnd' };
    }
  } catch {
    // unreadable file — skip
  }
  return { yes: false };
}

function containsFieldRef(obj: unknown, fieldNames: Set<string>): boolean {
  if (typeof obj === 'string') {
    return fieldNames.has(obj) || [...fieldNames].some(name => obj.includes(name));
  }
  if (Array.isArray(obj)) {
    return obj.some(item => containsFieldRef(item, fieldNames));
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).some(v => containsFieldRef(v, fieldNames));
  }
  return false;
}

function pruneArrayRefs(value: unknown, fieldNames: Set<string>): unknown {
  if (Array.isArray(value)) {
    return (value as unknown[])
      .filter(item => !containsFieldRef(item, fieldNames))
      .map(item => pruneArrayRefs(item, fieldNames));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, pruneArrayRefs(v, fieldNames)])
    );
  }
  return value;
}

async function cleanTemplateFile(filePath: string, fieldNames: Set<string>): Promise<boolean> {
  const raw = await readFile(filePath, 'utf8');

  const match = raw.match(/<entityPayload>(.*?)<\/entityPayload>/s);
  if (!match) return false;

  const decoded = match[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  let payload: unknown;
  try {
    payload = JSON.parse(decoded) as unknown;
  } catch {
    return false;
  }

  const pruned = pruneArrayRefs(payload, fieldNames);
  if (JSON.stringify(pruned) === JSON.stringify(payload)) return false;

  const reEncoded = JSON.stringify(pruned)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const updated = raw.replace(/<entityPayload>.*?<\/entityPayload>/s, `<entityPayload>${reEncoded}</entityPayload>`);
  await writeFile(filePath, updated, 'utf8');
  return true;
}

export async function cleanDataKit(sourcePath: string, dlmObjectNames: string[]): Promise<CleanStats> {
  const deletedFields: DeletedField[] = [];

  // ── 1. Find and delete KQ / rel_N_end field files ──────────────────────
  const patterns = dlmObjectNames.length > 0
    ? dlmObjectNames.map(name => `**/objects/${name}/fields/*.field-meta.xml`)
    : ['**/objects/*__dlm/fields/*.field-meta.xml'];

  const fieldFiles = await fg(patterns, { cwd: sourcePath, absolute: true });

  for (const file of fieldFiles) {
    const result = await shouldDelete(file);
    if (result.yes) {
      await unlink(file);
      deletedFields.push({ file, apiName: result.apiName, reason: result.reason });
    }
  }

  // ── 2. Clean entityPayload in dataKitObjectTemplates ───────────────────
  const updatedTemplates: string[] = [];

  if (deletedFields.length > 0) {
    const fieldNames = new Set(deletedFields.map(f => f.apiName));
    const templateFiles = await fg('**/dataKitObjectTemplates/*.dataKitObjectTemplate-meta.xml', {
      cwd: sourcePath,
      absolute: true,
    });

    for (const file of templateFiles) {
      const changed = await cleanTemplateFile(file, fieldNames);
      if (changed) updatedTemplates.push(file);
    }
  }

  return { deletedFields, updatedTemplates };
}
