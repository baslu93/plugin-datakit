import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { pollBackgroundOperation, DEVOPS_TERMINAL_FAILURE } from '../../../../helpers/deploymentStatusPoller.js';
import { DatakitDevopsDeployResponse } from '../../../../types/datapackagedefinition.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('plugin-datakit', 'datakit.deploy.devops.start');

export type DatakitDevopsStartResult = {
  developerName: string;
  jobId: string;
  jobStatus: string;
  errorMessage?: string;
};

export default class DatakitDeployDevopsStart extends SfCommand<DatakitDevopsStartResult> {
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

  public async run(): Promise<DatakitDevopsStartResult> {
    const { flags } = await this.parse(DatakitDeployDevopsStart);

    const org = flags['target-org'] as Org | undefined;
    if (!org) throw messages.createError('error.noTargetOrg');
    const developerName = flags['developer-name'] as string;
    const waitDuration = flags['wait'] as Duration;
    const connection = org.getConnection(flags['api-version'] as string | undefined);

    this.spinner.start(`Deploying DataKit "${developerName}" to org "${org.getUsername() ?? org.getOrgId()}"`);

    const response = await connection.request<DatakitDevopsDeployResponse>({
      method: 'POST',
      url: `/ssot/data-kits/${developerName}?asyncMode=true`,
      body: JSON.stringify({ developerName }),
      headers: { 'Content-Type': 'application/json' },
    });

    const { jobId } = response;
    this.spinner.stop('started');
    this.log(messages.getMessage('info.jobId', [jobId]));

    this.spinner.start('Waiting for deployment to complete...');

    const { jobStatus, timedOut, errorMessage } = await pollBackgroundOperation(connection, jobId, waitDuration);

    this.spinner.stop(timedOut ? 'timed out' : DEVOPS_TERMINAL_FAILURE.has(jobStatus) ? 'failed' : 'done');

    if (timedOut) {
      this.warn(messages.getMessage('warning.deployTimeout', [developerName, jobId]));
      return { developerName, jobId, jobStatus: 'InProgress' };
    }

    if (DEVOPS_TERMINAL_FAILURE.has(jobStatus)) {
      throw messages.createError('error.deployFailed', [developerName, errorMessage ?? 'Unknown error']);
    }

    this.log(messages.getMessage('success', [developerName, org.getUsername() ?? org.getOrgId()]));

    return { developerName, jobId, jobStatus };
  }
}
