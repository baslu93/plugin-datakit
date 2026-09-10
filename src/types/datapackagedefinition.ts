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

export type DeployComponentInput = Record<string, unknown>;

export interface DeployDataKitRequest {
  inputs: Array<{
    dataKitNameInput: string;
    dataKitDataSpaceInput?: string;
    dataKitComponentsInput: DeployComponentInput[];
  }>;
}

export interface DataKitDeploymentLogRecord {
  DeploymentStatus: string;
  DeploymentError?: string;
}

export interface DeployDataKitResponse {
  actionName: string;
  errors: string[] | null;
  isSuccess: boolean;
  outputValues: {
    Flow__InterviewGuid: string;
    Flow__InterviewStatus: string;
  };
}
