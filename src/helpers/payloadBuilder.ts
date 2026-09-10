import { mapComponents } from './componentMapper.js';
import { readDefinition, readKitObjects, readBundleDefinitions, readKitObjectTemplates } from './localMetadataReader.js';
import { DataPackageDefinitionMetadata, DeployDataKitRequest } from '../types/datapackagedefinition.js';

export interface PayloadBuildResult {
  payload: DeployDataKitRequest;
  definition: DataPackageDefinitionMetadata;
  kitObjectCount: number;
}

export async function buildDeployPayload(
  sourcePath: string,
  developerName: string
): Promise<PayloadBuildResult | null> {
  const definition = await readDefinition(sourcePath, developerName);
  if (!definition) return null;

  const kitObjects = await readKitObjects(sourcePath, developerName);

  if (definition.deploymentOrder) {
    try {
      const order = JSON.parse(definition.deploymentOrder) as {
        sequence?: Array<{ devName: string; type: string }>;
      };
      if (order.sequence && order.sequence.length > 0) {
        const seqIndex = new Map(order.sequence.map((s, i) => [s.devName, i]));
        kitObjects.sort((a, b) => {
          const ai = seqIndex.get(a.referenceObjectName) ?? Infinity;
          const bi = seqIndex.get(b.referenceObjectName) ?? Infinity;
          return ai - bi;
        });
      }
    } catch {
      // malformed deploymentOrder — deploy in discovery order
    }
  }

  const bundleNames = kitObjects
    .filter(o => o.referenceObjectType === 'DataSourceBundleDefinition')
    .map(o => o.referenceObjectName);

  const templateNames = kitObjects
    .filter(o => o.referenceObjectType === 'DataKitObjectTemplate')
    .map(o => o.referenceObjectName);

  const [bundleDefs, templates] = await Promise.all([
    readBundleDefinitions(sourcePath, bundleNames),
    readKitObjectTemplates(sourcePath, templateNames),
  ]);

  const bundleDefMap = new Map(bundleDefs.map(b => [b.fullName, b.dataPlatform]));
  const templatePayloadMap = new Map(templates.map(t => [t.fullName, t.entityPayload]));

  const components = mapComponents(kitObjects, bundleDefMap, templatePayloadMap);

  const payload: DeployDataKitRequest = {
    inputs: [
      {
        dataKitNameInput: developerName,
        ...(definition.dataSpaceDefinitionDevName ? { dataKitDataSpaceInput: definition.dataSpaceDefinitionDevName } : {}),
        dataKitComponentsInput: components,
      },
    ],
  };

  return { payload, definition, kitObjectCount: kitObjects.length };
}
