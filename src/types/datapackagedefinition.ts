// Salesforce Metadata API representation of the DataPackageDefinition type.
// Returned by connection.metadata.read('DataPackageDefinition', developerName).

export interface BundleCRMConfig {
  orgId: string;
}

export interface BundleConnectorFrameworkConfig {
  connectionName: string;
}

export interface BundleIngestApiConfig {
  connectorName: string;
}

export interface BundleStreamingAppConfig {
  connectorName: string;
  streamingAppDataConnectorType: 'MobileApp' | 'WebApp';
}

export interface BundleCommerceConfig {
  instanceId: string;
}

export interface DataStreamBundleConfig {
  connectorType: 'CRM' | 'MORECONNECTORS' | 'INGESTAPI' | 'STREAMINGAPP' | 'COMMERCE';
  bundleName: string;
  forceNoRefresh?: boolean;
  bundleCRMConfig?: BundleCRMConfig;
  bundleConnectorFrameworkConfig?: BundleConnectorFrameworkConfig;
  bundleIngestApiConfig?: BundleIngestApiConfig;
  bundleStreamingAppConfig?: BundleStreamingAppConfig;
  bundleCommerceConfig?: BundleCommerceConfig;
}

export interface CalculatedInsightsConfig {
  apiName: string;
  apiNameOverride?: string;
  label?: string;
  publishInterval?: 'NotScheduled' | 'One' | 'Six' | 'Twelve' | 'TwentyFour';
}

export interface DloConfig {
  dataSourceObjectDevName: string;
  apiName?: string;
  label?: string;
}

export interface DataTransformConfig {
  dataTransformType: 'BATCH' | 'STREAMING';
  dataTransformDevName: string;
  apiName?: string;
  label?: string;
}

export interface DataGraphConfig {
  templateDevName: string;
  name?: string;
  label?: string;
}

export interface IdentityResolutionConfig {
  dataSpaceName?: string;
  templateDevName: string;
  dataKitDevName?: string;
}

export interface MarketSegmentConfig {
  name: string;
  dataKitName?: string;
}

export interface SemanticModelConfig {
  developerName: string;
  label?: string;
}

export interface DataStreamBundleComponent {
  componentType: 'DataStreamBundle';
  bundleConfig: DataStreamBundleConfig;
}

export interface CalculatedInsightComponent {
  componentType: 'CalculatedInsight';
  calculatedInsightsConfig: CalculatedInsightsConfig;
}

export interface DataLakeObjectComponent {
  componentType: 'DataLakeObject';
  dloConfig: DloConfig;
}

export interface DataTransformComponent {
  componentType: 'DataTransform';
  dataTransformConfig: DataTransformConfig;
}

export interface DataGraphComponent {
  componentType: 'DataGraph';
  dataGraphConfig: DataGraphConfig;
}

export interface IdentityResolutionComponent {
  componentType: 'IdentityResolution';
  identityResolutionConfig: IdentityResolutionConfig;
}

export interface MarketSegmentComponent {
  componentType: 'MarketSegment';
  marketSegmentConfig: MarketSegmentConfig;
}

export interface SemanticModelComponent {
  componentType: 'SemanticModel';
  semanticModelConfig: SemanticModelConfig;
}

export type DataPackageComponent =
  | DataStreamBundleComponent
  | CalculatedInsightComponent
  | DataLakeObjectComponent
  | DataTransformComponent
  | DataGraphComponent
  | IdentityResolutionComponent
  | MarketSegmentComponent
  | SemanticModelComponent;

// Shape returned by connection.metadata.read('DataPackageDefinition', developerName)
export interface DataPackageDefinitionMetadata {
  fullName: string;
  dataKitName: string;
  dataSpace?: string;
  // Salesforce metadata.read returns a single object when there's one child, or an array for many
  dataPackageComponents?: DataPackageComponent | DataPackageComponent[];
}

// Shape of one element in the deploy API's dataKitComponentsInput array
export type DeployComponentInput = Record<string, unknown>;

// Top-level deploy API request body
export interface DeployDataKitRequest {
  inputs: Array<{
    dataKitNameInput: string;
    dataKitDataSpaceInput?: string;
    dataKitComponentsInput: DeployComponentInput[];
  }>;
}

// Record returned when polling sfdatakit__DataKitDeploymentLog__c
export interface DataKitDeploymentLogRecord {
  sfdatakit__Status__c: string;
  sfdatakit__ErrorMessage__c?: string;
}

// Deploy API response
export interface DeployDataKitResponse {
  actionName: string;
  errors: string[] | null;
  isSuccess: boolean;
  outputValues: {
    Flow__InterviewGuid: string;
    Flow__InterviewStatus: string;
  };
}
