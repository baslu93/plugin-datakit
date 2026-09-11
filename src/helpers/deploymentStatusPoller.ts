import { Connection, PollingClient, StatusResult } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { BackgroundOperationRecord } from '../types/datapackagedefinition.js';

export const TERMINAL_SUCCESS = new Set(['Completed']);
export const TERMINAL_FAILURE = new Set(['Failed', 'Error', 'Aborted']);

export type DeploymentStatusPollResult = {
  jobId: string;
  jobStatus: string;
  timedOut: boolean;
  errorMessage?: string;
};

export async function getBackgroundOperationStatus(
  connection: Connection,
  jobId: string
): Promise<Omit<DeploymentStatusPollResult, 'timedOut'>> {
  const { records } = await connection.query<BackgroundOperationRecord>(
    `SELECT Id, Status, Error FROM BackgroundOperation WHERE Id = '${jobId}' LIMIT 1`
  );

  if (records.length === 0) return { jobId, jobStatus: 'Unknown' };

  return { jobId, jobStatus: records[0].Status, errorMessage: records[0].Error };
}

export async function pollBackgroundOperation(
  connection: Connection,
  jobId: string,
  waitDuration: Duration
): Promise<DeploymentStatusPollResult> {
  let jobStatus = '';
  let errorMessage: string | undefined;

  const pollingClient = await PollingClient.create({
    frequency: Duration.seconds(3),
    timeout: waitDuration,
    timeoutErrorName: 'DeploymentStatusTimeoutError',
    poll: async (): Promise<StatusResult> => {
      const { records } = await connection.query<BackgroundOperationRecord>(
        `SELECT Id, Status, Error FROM BackgroundOperation WHERE Id = '${jobId}' LIMIT 1`
      );

      if (records.length === 0) return { completed: false };

      jobStatus = records[0].Status;
      errorMessage = records[0].Error;

      return { completed: TERMINAL_SUCCESS.has(jobStatus) || TERMINAL_FAILURE.has(jobStatus) };
    },
  });

  try {
    await pollingClient.subscribe();
  } catch (err) {
    if ((err as Error).name === 'DeploymentStatusTimeoutError') {
      return { jobId, jobStatus, timedOut: true };
    }
    throw err;
  }

  return { jobId, jobStatus, timedOut: false, errorMessage };
}
