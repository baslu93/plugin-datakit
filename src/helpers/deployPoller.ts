import { Connection, PollingClient, StatusResult } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { DataKitDeploymentLogRecord } from '../types/datapackagedefinition.js';

export const TERMINAL_SUCCESS = new Set(['Completed']);
export const TERMINAL_FAILURE = new Set(['Failed', 'Error']);

export type PollResult = {
  status: string;
  timedOut: boolean;
  errorMessage?: string;
};

export async function pollDeploymentStatus(
  connection: Connection,
  interviewGuid: string,
  waitDuration: Duration
): Promise<PollResult> {
  let status = '';
  let errorMessage: string | undefined;

  const pollingClient = await PollingClient.create({
    frequency: Duration.seconds(3),
    timeout: waitDuration,
    timeoutErrorName: 'DeployTimeoutError',
    poll: async (): Promise<StatusResult> => {
      const { records } = await connection.query<DataKitDeploymentLogRecord>(
        `SELECT sfdatakit__Status__c, sfdatakit__ErrorMessage__c FROM sfdatakit__DataKitDeploymentLog__c WHERE sfdatakit__InterviewGuid__c = '${interviewGuid}' LIMIT 1`
      );

      if (records.length === 0) return { completed: false };

      status = records[0].sfdatakit__Status__c;
      errorMessage = records[0].sfdatakit__ErrorMessage__c;

      return { completed: TERMINAL_SUCCESS.has(status) || TERMINAL_FAILURE.has(status) };
    },
  });

  try {
    await pollingClient.subscribe();
  } catch (err) {
    if ((err as Error).name === 'DeployTimeoutError') {
      return { status, timedOut: true };
    }
    throw err;
  }

  return { status, timedOut: false, errorMessage };
}
