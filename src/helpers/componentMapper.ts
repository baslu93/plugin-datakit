import {
  DataPackageComponent,
  DataStreamBundleComponent,
  CalculatedInsightComponent,
  DataLakeObjectComponent,
  DataTransformComponent,
  DataGraphComponent,
  IdentityResolutionComponent,
  MarketSegmentComponent,
  SemanticModelComponent,
  DeployComponentInput,
} from '../types/datapackagedefinition.js';

function mapDataStreamBundle(c: DataStreamBundleComponent): DeployComponentInput {
  if (c.bundleConfig.connectorType === 'CRM') {
    return {
      orgId: c.bundleConfig.bundleCRMConfig?.orgId,
      bundleConfig: c.bundleConfig,
    };
  }
  return {
    componentType: 'DataStreamBundle',
    bundleConfig: c.bundleConfig,
  };
}

function mapCalculatedInsight(c: CalculatedInsightComponent): DeployComponentInput {
  return {
    componentType: 'CalculatedInsight',
    calculatedInsightsConfig: {
      publishInterval: 'NotScheduled',
      ...c.calculatedInsightsConfig,
    },
  };
}

function mapDataLakeObject(c: DataLakeObjectComponent): DeployComponentInput {
  return {
    componentType: 'DataLakeObject',
    dloConfig: c.dloConfig,
  };
}

function mapDataTransform(c: DataTransformComponent): DeployComponentInput {
  return {
    componentType: 'DataTransform',
    dataTransformConfig: c.dataTransformConfig,
  };
}

function mapDataGraph(c: DataGraphComponent): DeployComponentInput {
  return {
    componentType: 'DataGraph',
    dataGraphConfig: c.dataGraphConfig,
  };
}

function mapIdentityResolution(c: IdentityResolutionComponent): DeployComponentInput {
  return {
    componentType: 'IdentityResolution',
    identityResolutionConfig: c.identityResolutionConfig,
  };
}

function mapMarketSegment(c: MarketSegmentComponent): DeployComponentInput {
  return {
    componentType: 'MarketSegment',
    marketSegmentConfig: c.marketSegmentConfig,
  };
}

function mapSemanticModel(c: SemanticModelComponent): DeployComponentInput {
  return {
    componentType: 'SemanticModel',
    semanticModelConfig: c.semanticModelConfig,
  };
}

export function mapComponent(component: DataPackageComponent): DeployComponentInput {
  switch (component.componentType) {
    case 'DataStreamBundle':
      return mapDataStreamBundle(component);
    case 'CalculatedInsight':
      return mapCalculatedInsight(component);
    case 'DataLakeObject':
      return mapDataLakeObject(component);
    case 'DataTransform':
      return mapDataTransform(component);
    case 'DataGraph':
      return mapDataGraph(component);
    case 'IdentityResolution':
      return mapIdentityResolution(component);
    case 'MarketSegment':
      return mapMarketSegment(component);
    case 'SemanticModel':
      return mapSemanticModel(component);
  }
}

export function mapComponents(
  raw: DataPackageComponent | DataPackageComponent[] | undefined
): DeployComponentInput[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(mapComponent);
}
