import { DataPackageKitObjectRecord, DeployComponentInput } from '../types/datapackagedefinition.js';

// dataPlatform (from DataSourceBundleDefinition) → connectorType (deploy API)
const CONNECTOR_TYPE: Record<string, string> = {
  Salesforce_Sales_and_Service_Cloud: 'CRM',
};

function mapBundle(bundleName: string, dataPlatform: string): DeployComponentInput {
  const connectorType = CONNECTOR_TYPE[dataPlatform] ?? 'MORECONNECTORS';

  if (connectorType === 'CRM') {
    return {
      componentType: 'DataStreamBundle',
      bundleConfig: {
        connectorType,
        bundleName,
        forceNoRefresh: false,
        // orgId is "ignore" for 1:1 orgs; multi-org companion org ID is not derivable from local metadata
        bundleCRMConfig: { orgId: 'ignore' },
      },
    };
  }

  return {
    componentType: 'DataStreamBundle',
    bundleConfig: {
      connectorType,
      bundleName,
      forceNoRefresh: false,
      bundleConnectorFrameworkConfig: { connectionName: dataPlatform },
    },
  };
}

function mapTemplate(name: string, payload: Record<string, string>): DeployComponentInput | null {
  const type = payload['type'];
  switch (type) {
    case 'DLO':
      return {
        componentType: 'DataLakeObject',
        dloConfig: { apiName: payload['developerName'] ?? name },
      };
    case 'SemanticModel':
      return {
        componentType: 'SemanticModel',
        semanticModelConfig: { apiName: payload['developerName'] ?? payload['apiName'] ?? name },
      };
    default:
      return null;
  }
}

export function mapComponents(
  kitObjects: DataPackageKitObjectRecord[],
  bundleDefMap: Map<string, string>,
  templatePayloadMap: Map<string, Record<string, string>>
): DeployComponentInput[] {
  const components: DeployComponentInput[] = [];

  for (const obj of kitObjects) {
    const { referenceObjectType, referenceObjectName } = obj;

    switch (referenceObjectType) {
      case 'DataSourceBundleDefinition':
        components.push(mapBundle(referenceObjectName, bundleDefMap.get(referenceObjectName) ?? ''));
        break;
      case 'DataKitObjectTemplate': {
        const payload = templatePayloadMap.get(referenceObjectName);
        if (payload) {
          const component = mapTemplate(referenceObjectName, payload);
          if (component) components.push(component);
        }
        break;
      }
    }
  }

  return components;
}
