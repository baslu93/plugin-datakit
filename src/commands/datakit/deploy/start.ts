import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { mapComponents } from '../../../helpers/componentMapper.js';
import { pollDeploymentStatus, TERMINAL_FAILURE } from '../../../helpers/deployPoller.js';
import { readDefinition, readKitObjects, readBundleDefinitions, readKitObjectTemplates } from '../../../helpers/localMetadataReader.js';
import { DeployDataKitRequest, DeployDataKitResponse } from '../../../types/datapackagedefinition.js';

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

    // ── 1. Read DataPackageKitDefinition ───────────────────────────────────
    this.spinner.start(`Reading DataPackageKitDefinition "${developerName}"`);

    const definition = await readDefinition(sourcePath, developerName);

    if (!definition) {
      this.spinner.stop('not found');
      throw messages.createError('error.datakitNotFound', [developerName, sourcePath]);
    }

    this.spinner.stop('done');

    // ── 2. Read DataPackageKitObjects and sort by deploymentOrder ──────────
    this.spinner.start('Reading DataPackageKitObjects');

    const kitObjects = await readKitObjects(sourcePath, developerName);

    this.spinner.stop(`${kitObjects.length} found`);

    if (kitObjects.length === 0) {
      this.warn(`DataPackageKitDefinition "${developerName}" has no components defined.`);
    }

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

    // ── 3. Read bundle definitions and templates in parallel ───────────────
    const bundleNames = kitObjects
      .filter(o => o.referenceObjectType === 'DataSourceBundleDefinition')
      .map(o => o.referenceObjectName);

    const templateNames = kitObjects
      .filter(o => o.referenceObjectType === 'DataKitObjectTemplate')
      .map(o => o.referenceObjectName);

    this.spinner.start('Reading component metadata');

    const [bundleDefs, templates] = await Promise.all([
      readBundleDefinitions(sourcePath, bundleNames),
      readKitObjectTemplates(sourcePath, templateNames),
    ]);

    this.spinner.stop('done');

    const bundleDefMap = new Map(bundleDefs.map(b => [b.fullName, b.dataPlatform]));
    const templatePayloadMap = new Map(templates.map(t => [t.fullName, t.entityPayload]));

    // ── 4. Build deploy payload ─────────────────────────────────────────────
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
