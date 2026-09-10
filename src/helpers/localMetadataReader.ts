import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import fg from 'fast-glob';
import { parseStringPromise } from 'xml2js';
import {
  DataPackageDefinitionMetadata,
  DataPackageKitObjectRecord,
  DataKitObjectTemplateRecord,
  DataSourceBundleDefinitionMetadata,
} from '../types/datapackagedefinition.js';

async function parseXml(filePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(filePath, 'utf8');
  return parseStringPromise(content, { explicitArray: false, ignoreAttrs: true });
}

export async function readDefinition(
  sourcePath: string,
  developerName: string
): Promise<DataPackageDefinitionMetadata | null> {
  const files = await fg([
    `**/dataPackageKitDefinitions/${developerName}.dataPackageKitDefinition-meta.xml`,
    `**/dataPackageKitDefinitions/${developerName}.dataPackageKitDefinition`,
  ], { cwd: sourcePath, absolute: true, caseSensitiveMatch: false });

  if (files.length === 0) return null;

  const parsed = await parseXml(files[0]);
  const def = parsed['DataPackageKitDefinition'] as Record<string, string>;

  return {
    fullName: developerName,
    masterLabel: def.masterLabel ?? developerName,
    dataSpaceDefinitionDevName: def.dataSpaceDefinitionDevName,
    deploymentOrder: def.deploymentOrder,
  };
}

export async function readKitObjects(
  sourcePath: string,
  developerName: string
): Promise<DataPackageKitObjectRecord[]> {
  const files = await fg([
    '**/DataPackageKitObjects/*.DataPackageKitObject-meta.xml',
    '**/DataPackageKitObjects/*.DataPackageKitObject',
  ], { cwd: sourcePath, absolute: true, caseSensitiveMatch: false });

  const records: DataPackageKitObjectRecord[] = [];

  for (const file of files) {
    const parsed = await parseXml(file);
    const obj = parsed['DataPackageKitObject'] as Record<string, string>;

    if (obj?.parentDataPackageKitDefinitionName === developerName) {
      const fullName = basename(file).replace('.DataPackageKitObject-meta.xml', '').replace('.DataPackageKitObject', '');
      records.push({
        fullName,
        parentDataPackageKitDefinitionName: obj.parentDataPackageKitDefinitionName,
        referenceObjectName: obj.referenceObjectName,
        referenceObjectType: obj.referenceObjectType,
      });
    }
  }

  return records;
}

export async function readKitObjectTemplates(
  sourcePath: string,
  names: string[]
): Promise<DataKitObjectTemplateRecord[]> {
  const results: DataKitObjectTemplateRecord[] = [];

  for (const name of names) {
    const files = await fg([
      `**/dataKitObjectTemplates/${name}.dataKitObjectTemplate-meta.xml`,
      `**/dataKitObjectTemplates/${name}.dataKitObjectTemplate`,
    ], { cwd: sourcePath, absolute: true, caseSensitiveMatch: false });

    if (files.length === 0) continue;

    const parsed = await parseXml(files[0]);
    const tmpl = parsed['DataKitObjectTemplate'] as Record<string, string>;

    let entityPayload: Record<string, string> = {};
    if (tmpl?.entityPayload) {
      try {
        entityPayload = JSON.parse(tmpl.entityPayload) as Record<string, string>;
      } catch {
        // unparseable payload — skip
      }
    }

    results.push({ fullName: name, entityPayload });
  }

  return results;
}

export async function readBundleDefinitions(
  sourcePath: string,
  bundleNames: string[]
): Promise<DataSourceBundleDefinitionMetadata[]> {
  const results: DataSourceBundleDefinitionMetadata[] = [];

  for (const name of bundleNames) {
    const files = await fg([
      `**/dataSourceBundleDefinitions/${name}.dataSourceBundleDefinition-meta.xml`,
      `**/dataSourceBundleDefinitions/${name}.dataSourceBundleDefinition`,
    ], { cwd: sourcePath, absolute: true, caseSensitiveMatch: false });

    if (files.length === 0) continue;

    const parsed = await parseXml(files[0]);
    const def = parsed['DataSourceBundleDefinition'] as Record<string, string>;

    results.push({
      fullName: name,
      dataPlatform: def.dataPlatform ?? '',
    });
  }

  return results;
}
