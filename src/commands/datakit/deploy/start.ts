import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { mapComponents } from '../../../helpers/componentMapper.js';
import { pollDeploymentStatus, TERMINAL_FAILURE } from '../../../helpers/deployPoller.js';
import {
  DataPackageKitDefinitionMetadata,
  DeployDataKitRequest,
  DeployDataKitResponse,
} from '../../../types/datapackagedefinition.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-datakit', 'datakit.deploy.start');

export type DatakitDeployStartResult = {
  developerName: string;
  dataKitName: string;
  orgId: string;
  interviewGuid: string;
  interviewStatus: string;
};

const DEPLOY_FLOW_API = '/services/data/v62.0/actions/custom/flow/sfdatakit__DeployDataKitComponents';

export default class DatakitDeployStart extends SfCommand<DatakitDeployStartResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'developer-name': Flags.string({
      summary: messages.getMessage('flags.developer-name.summary'),
      char: 'n',
      required: true,
    }),
    'target-org': Flags.optionalOrg({
      summary: messages.getMessage('flags.target-org.summary'),
    }),
    'api-version': Flags.orgApiVersion(),
    wait: Flags.duration({
      summary: messages.getMessage('flags.wait.summary'),
      char: 'w',
      unit: 'minutes',
      defaultValue: 10,
      min: 1,
    }),
  };

  public async run(): Promise<DatakitDeployStartResult> {
    type ParsedFlags = { 'developer-name': string; 'target-org': Org | undefined; 'api-version': string | undefined; wait: Duration };
    const { flags } = await this.parse(DatakitDeployStart) as { flags: ParsedFlags };

    const org = flags['target-org'];
    if (!org) throw messages.createError('error.noTargetOrg');
    const developerName = flags['developer-name'];
    const waitDuration = flags['wait'];
    const connection = org.getConnection(flags['api-version']);
    const orgId = org.getOrgId();

    // ── 1. Read DataPackageKitDefinition via Metadata API ──────────────────────
    this.spinner.start(`Reading DataPackageKitDefinition "${developerName}"`);

    // 'DataPackageKitDefinition' is not yet in @salesforce/core's MetadataType union
    const [definition] = await connection.metadata.read('DataPackageKitDefinition' as never, [developerName]) as DataPackageKitDefinitionMetadata[];

    if (!definition?.fullName) {
      this.spinner.stop('not found');
      throw messages.createError('error.datakitNotFound', [developerName, org.getUsername() ?? orgId]);
    }

    this.spinner.stop('done');

    // ── 2. Build deploy payload ──────────────────────────────────────────────
    const components = mapComponents(definition.dataPackageComponents);

    if (components.length === 0) {
      this.warn(`DataPackageKitDefinition "${developerName}" has no components defined.`);
    }

    const payload: DeployDataKitRequest = {
      inputs: [
        {
          dataKitNameInput: definition.dataKitName,
          ...(definition.dataSpace ? { dataKitDataSpaceInput: definition.dataSpace } : {}),
          dataKitComponentsInput: components,
        },
      ],
    };

    this.log('');
    this.log('Deploying with payload:');
    this.log(JSON.stringify(payload, null, 2));
    this.log('');

    // ── 3. Call the deploy API ───────────────────────────────────────────────
    this.spinner.start(`Deploying DataKit "${definition.dataKitName}" to org "${org.getUsername() ?? orgId}"`);

    const response = await connection.request<DeployDataKitResponse[]>({
      method: 'POST',
      url: DEPLOY_FLOW_API,
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = Array.isArray(response) ? response[0] : response;

    if (!result.isSuccess) {
      this.spinner.stop('failed');
      const errorMsg = result.errors?.join(', ') ?? 'Unknown error';
      throw messages.createError('error.deployFailed', [definition.dataKitName, errorMsg]);
    }

    this.spinner.stop('done');

    const interviewGuid = result.outputValues.Flow__InterviewGuid;
    this.log(`Interview GUID: ${interviewGuid}`);

    // ── 4. Poll DataKitDeploymentLog until terminal status ───────────────────
    this.spinner.start('Waiting for deployment to complete...');

    const { status, timedOut, errorMessage } = await pollDeploymentStatus(connection, interviewGuid, waitDuration);

    this.spinner.stop(timedOut ? 'timed out' : TERMINAL_FAILURE.has(status) ? 'failed' : 'done');

    if (timedOut) {
      this.warn(messages.getMessage('warning.deployTimeout', [definition.dataKitName, interviewGuid]));
      return { developerName, dataKitName: definition.dataKitName, orgId, interviewGuid, interviewStatus: 'InProgress' };
    }

    if (TERMINAL_FAILURE.has(status)) {
      throw messages.createError('error.deployFailed', [definition.dataKitName, errorMessage ?? 'Unknown error']);
    }

    this.log(messages.getMessage('success', [definition.dataKitName, org.getUsername() ?? orgId]));

    return {
      developerName,
      dataKitName: definition.dataKitName,
      orgId,
      interviewGuid,
      interviewStatus: status,
    };
  }
}
