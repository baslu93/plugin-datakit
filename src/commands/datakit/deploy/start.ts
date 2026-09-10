import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { pollDeploymentStatus, TERMINAL_FAILURE } from '../../../helpers/deployPoller.js';
import { buildDeployPayload } from '../../../helpers/payloadBuilder.js';
import { DeployDataKitResponse } from '../../../types/datapackagedefinition.js';

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
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      char: 'p',
      required: true,
      exists: true,
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
    const { flags } = await this.parse(DatakitDeployStart);

    const org = flags['target-org'] as Org | undefined;
    if (!org) throw messages.createError('error.noTargetOrg');
    const developerName = flags['developer-name'] as string;
    const sourcePath = flags['source-path'] as string;
    const waitDuration = flags['wait'] as Duration;
    const connection = org.getConnection(flags['api-version'] as string | undefined);
    const orgId = org.getOrgId();

    // ── 1. Build deploy payload from local metadata ────────────────────────
    this.spinner.start('Reading metadata');

    const built = await buildDeployPayload(sourcePath, developerName);

    if (!built) {
      this.spinner.stop('not found');
      throw messages.createError('error.datakitNotFound', [developerName, sourcePath]);
    }

    this.spinner.stop(`${built.kitObjectCount} components`);

    if (built.kitObjectCount === 0) {
      this.warn(`DataPackageKitDefinition "${developerName}" has no components defined.`);
    }

    const { payload, definition } = built;

    // ── 5. Call the deploy API ──────────────────────────────────────────────
    const dataKitLabel = definition.masterLabel ?? developerName;
    this.spinner.start(`Deploying DataKit "${dataKitLabel}" to org "${org.getUsername() ?? orgId}"`);

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
      throw messages.createError('error.deployFailed', [dataKitLabel, errorMsg]);
    }

    this.spinner.stop('done');

    const interviewGuid = result.outputValues.Flow__InterviewGuid;
    this.log(`Interview GUID: ${interviewGuid}`);

    // ── 6. Poll DataKitDeploymentLog until terminal status ──────────────────
    this.spinner.start('Waiting for deployment to complete...');

    const { status, timedOut, errorMessage } = await pollDeploymentStatus(connection, interviewGuid, waitDuration);

    this.spinner.stop(timedOut ? 'timed out' : TERMINAL_FAILURE.has(status) ? 'failed' : 'done');

    if (timedOut) {
      this.warn(messages.getMessage('warning.deployTimeout', [dataKitLabel, interviewGuid]));
      return { developerName, dataKitName: dataKitLabel, orgId, interviewGuid, interviewStatus: 'InProgress' };
    }

    if (TERMINAL_FAILURE.has(status)) {
      throw messages.createError('error.deployFailed', [dataKitLabel, errorMessage ?? 'Unknown error']);
    }

    this.log(messages.getMessage('success', [dataKitLabel, org.getUsername() ?? orgId]));

    return { developerName, dataKitName: dataKitLabel, orgId, interviewGuid, interviewStatus: status };
  }
}
