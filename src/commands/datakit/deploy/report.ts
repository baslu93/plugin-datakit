import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Org } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { pollDeploymentStatus, TERMINAL_FAILURE } from '../../../helpers/deployPoller.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-datakit', 'datakit.deploy.report');

export type DatakitDeployReportResult = {
  interviewGuid: string;
  interviewStatus: string;
};

export default class DatakitDeployReport extends SfCommand<DatakitDeployReportResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');

  public static readonly flags = {
    'interview-guid': Flags.string({
      summary: messages.getMessage('flags.interview-guid.summary'),
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
      defaultValue: 10,
      min: 1,
    }),
  };

  public async run(): Promise<DatakitDeployReportResult> {
    type ParsedFlags = { 'interview-guid': string; 'target-org': Org | undefined; 'api-version': string | undefined; wait: Duration };
    const { flags } = await this.parse(DatakitDeployReport) as { flags: ParsedFlags };

    const org = flags['target-org'];
    if (!org) throw messages.createError('error.noTargetOrg');
    const interviewGuid = flags['interview-guid'];
    const waitDuration = flags['wait'];
    const connection = org.getConnection(flags['api-version']);

    this.spinner.start('Checking deployment status...');

    const { status, timedOut, errorMessage } = await pollDeploymentStatus(connection, interviewGuid, waitDuration);

    this.spinner.stop(timedOut ? 'timed out' : TERMINAL_FAILURE.has(status) ? 'failed' : 'done');

    if (timedOut) {
      this.warn(messages.getMessage('warning.deployTimeout', [interviewGuid]));
      return { interviewGuid, interviewStatus: 'InProgress' };
    }

    if (TERMINAL_FAILURE.has(status)) {
      throw messages.createError('error.deployFailed', [errorMessage ?? 'Unknown error']);
    }

    this.log(messages.getMessage('success'));

    return { interviewGuid, interviewStatus: status };
  }
}
