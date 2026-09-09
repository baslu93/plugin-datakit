import { DataPackageKitObjectRecord, DeployComponentInput } from '../types/datapackagedefinition.js';

function mapBundle(bundleName: string, dataPlatform: string, orgId: string): DeployComponentInput {
  if (dataPlatform === 'Salesforce_Sales_and_Service_Cloud') {
    return {
      componentType: 'DataStreamBundle',
      bundleConfig: {
        connectorType: 'CRM',
        bundleName,
        forceNoRefresh: false,
        bundleCRMConfig: { orgId },
      },
    };
  }
  if (dataPlatform === 'UploadedFiles') {
    return {
      componentType: 'DataStreamBundle',
      bundleConfig: {
        connectorType: 'MORECONNECTORS',
        bundleName,
        forceNoRefresh: false,
        bundleConnectorFrameworkConfig: { connectionName: 'UploadedFiles' },
      },
    };
  }
  // Generic connector framework — use dataPlatform as the connection name
  return {
    componentType: 'DataStreamBundle',
    bundleConfig: {
      connectorType: 'MORECONNECTORS',
      bundleName,
      forceNoRefresh: false,
      bundleConnectorFrameworkConfig: { connectionName: dataPlatform },
    },
  };
}

export function mapComponents(
  kitObjects: DataPackageKitObjectRecord[],
  bundleDefMap: Map<string, string>,
  orgId: string
): DeployComponentInput[] {
  const components: DeployComponentInput[] = [];

  for (const obj of kitObjects) {
    const { referenceObjectType, referenceObjectName } = obj;

    switch (referenceObjectType) {
      case 'DataSourceBundleDefinition':
        components.push(mapBundle(referenceObjectName, bundleDefMap.get(referenceObjectName) ?? '', orgId));
        break;
      case 'DLO':
        components.push({
          componentType: 'DataLakeObject',
          dloConfig: { dataSourceObjectDevName: referenceObjectName, apiName: referenceObjectName },
        });
        break;
      case 'DataTransform':
        components.push({
          componentType: 'DataTransform',
          dataTransformConfig: { dataTransformType: 'BATCH', dataTransformDevName: referenceObjectName, apiName: referenceObjectName },
        });
        break;
      case 'CalculatedInsight':
        components.push({
          componentType: 'CalculatedInsight',
          calculatedInsightsConfig: { apiName: referenceObjectName, publishInterval: 'NotScheduled' },
        });
        break;
      case 'IdentityResolution':
        components.push({
          componentType: 'IdentityResolution',
          identityResolutionConfig: { templateDevName: referenceObjectName },
        });
        break;
      case 'DataGraph':
        components.push({
          componentType: 'DataGraph',
          dataGraphConfig: { templateDevName: referenceObjectName },
        });
        break;
    }
  }

  return components;
}
