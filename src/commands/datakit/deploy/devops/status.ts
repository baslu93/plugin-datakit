import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import {
  getBackgroundOperationStatus,
  pollBackgroundOperation,
  DEVOPS_TERMINAL_FAILURE,
} from '../../../../helpers/deploymentStatusPoller.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-datakit', 'datakit.deploy.devops.status');

export type DatakitDevopsStatusResult = {
  jobId: string;
  jobStatus: string;
  errorMessage?: string;
};

export default class DatakitDeployDevopsStatus extends SfCommand<DatakitDevopsStatusResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'job-id': Flags.string({
      summary: messages.getMessage('flags.job-id.summary'),
      char: 'i',
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
      min: 1,
    }),
  };

  public async run(): Promise<DatakitDevopsStatusResult> {
    const { flags } = await this.parse(DatakitDeployDevopsStatus);

    const org = flags['target-org'] as Org | undefined;
    if (!org) throw messages.createError('error.noTargetOrg');
    const jobId = flags['job-id'] as string;
    const waitDuration = flags['wait'] as Duration | undefined;
    const connection = org.getConnection(flags['api-version'] as string | undefined);

    if (!waitDuration) {
      const { jobStatus, errorMessage } = await getBackgroundOperationStatus(connection, jobId);
      this.log(messages.getMessage('info.currentStatus', [jobStatus]));
      return { jobId, jobStatus, errorMessage };
    }

    this.spinner.start('Waiting for deployment to complete...');

    const { jobStatus, timedOut, errorMessage } = await pollBackgroundOperation(connection, jobId, waitDuration);

    this.spinner.stop(timedOut ? 'timed out' : DEVOPS_TERMINAL_FAILURE.has(jobStatus) ? 'failed' : 'done');

    if (timedOut) {
      this.warn(messages.getMessage('warning.timeout', [jobId]));
      return { jobId, jobStatus: 'InProgress' };
    }

    if (DEVOPS_TERMINAL_FAILURE.has(jobStatus)) {
      throw messages.createError('error.deployFailed', [errorMessage ?? 'Unknown error']);
    }

    this.log(messages.getMessage('success'));

    return { jobId, jobStatus };
  }
}
