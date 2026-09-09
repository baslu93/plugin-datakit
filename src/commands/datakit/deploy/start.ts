import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { mapComponents } from '../../../helpers/componentMapper.js';
import { pollDeploymentStatus, TERMINAL_FAILURE } from '../../../helpers/deployPoller.js';
import {
  DataPackageDefinitionMetadata,
  DataPackageKitObjectRecord,
  DataSourceBundleDefinitionMetadata,
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

    // ── 1. Read DataPackageKitDefinition ────────────────────────────────────
    this.spinner.start(`Reading DataPackageKitDefinition "${developerName}"`);

    const [definition] = await connection.metadata.read('DataPackageKitDefinition' as never, [developerName]) as DataPackageDefinitionMetadata[];

    if (!definition?.fullName) {
      this.spinner.stop('not found');
      throw messages.createError('error.datakitNotFound', [developerName, org.getUsername() ?? orgId]);
    }

    this.spinner.stop('done');

    // ── 2. Query DataPackageKitObject components via Tooling API ────────────
    this.spinner.start('Reading DataPackageKitObjects');

    const { records: kitObjects } = await connection.tooling.query<DataPackageKitObjectRecord>(
      `SELECT Metadata FROM DataPackageKitObject WHERE ParentDataPackageKitDefinition.DeveloperName = '${developerName}'`
    );

    this.spinner.stop(`${kitObjects.length} found`);

    if (kitObjects.length === 0) {
      this.warn(`DataPackageKitDefinition "${developerName}" has no components defined.`);
    }

    // ── 3. Read DataSourceBundleDefinition for bundle objects ───────────────
    const bundleNames = kitObjects
      .filter(o => o.Metadata?.referenceObjectType === 'DataSourceBundleDefinition')
      .map(o => o.Metadata.referenceObjectName);

    const bundleDefMap = new Map<string, string>();

    if (bundleNames.length > 0) {
      this.spinner.start('Reading DataSourceBundleDefinitions');
      const raw = await connection.metadata.read('DataSourceBundleDefinition' as never, bundleNames);
      const bundleDefs = (Array.isArray(raw) ? raw : [raw]) as DataSourceBundleDefinitionMetadata[];
      for (const b of bundleDefs) {
        if (b?.fullName) bundleDefMap.set(b.fullName, b.dataPlatform);
      }
      this.spinner.stop('done');
    }

    // ── 4. Build deploy payload ─────────────────────────────────────────────
    const components = mapComponents(kitObjects, bundleDefMap, orgId);

    const payload: DeployDataKitRequest = {
      inputs: [
        {
          dataKitNameInput: developerName,
          ...(definition.dataSpaceDefinitionDevName ? { dataKitDataSpaceInput: definition.dataSpaceDefinitionDevName } : {}),
          dataKitComponentsInput: components,
        },
      ],
    };

    this.log('');
    this.log('Deploying with payload:');
    this.log(JSON.stringify(payload, null, 2));
    this.log('');

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
