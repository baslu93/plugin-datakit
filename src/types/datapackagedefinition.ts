export interface DataPackageDefinitionMetadata {
  fullName: string;
  masterLabel: string;
  dataSpaceDefinitionDevName?: string;
  deploymentOrder?: string;
}

export interface DataPackageKitObjectRecord {
  fullName: string;
  parentDataPackageKitDefinitionName: string;
  referenceObjectName: string;
  referenceObjectType: string;
}

export interface DataSourceBundleDefinitionMetadata {
  fullName: string;
  dataPlatform: string;
}

export interface DataKitObjectTemplateRecord {
  fullName: string;
  entityPayload: Record<string, string>;
}

export interface DatakitDevopsDeployResponse {
  jobId: string;
}

export interface BackgroundOperationRecord {
  Id: string;
  Status: string;
  Error?: string;
}
