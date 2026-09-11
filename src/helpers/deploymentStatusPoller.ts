import { Connection, PollingClient, StatusResult } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { BackgroundOperationRecord } from '../types/datapackagedefinition.js';

export const DEVOPS_TERMINAL_SUCCESS = new Set(['Completed']);
export const DEVOPS_TERMINAL_FAILURE = new Set(['Failed', 'Error', 'Aborted']);

export type DevopsPollResult = {
  jobId: string;
  jobStatus: string;
  timedOut: boolean;
  errorMessage?: string;
};

export async function getBackgroundOperationStatus(
  connection: Connection,
  jobId: string
): Promise<Omit<DevopsPollResult, 'timedOut'>> {
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
): Promise<DevopsPollResult> {
  let jobStatus = '';
  let errorMessage: string | undefined;

  const pollingClient = await PollingClient.create({
    frequency: Duration.seconds(3),
    timeout: waitDuration,
    timeoutErrorName: 'DevopsTimeoutError',
    poll: async (): Promise<StatusResult> => {
      const { records } = await connection.query<BackgroundOperationRecord>(
        `SELECT Id, Status, Error FROM BackgroundOperation WHERE Id = '${jobId}' LIMIT 1`
      );

      if (records.length === 0) return { completed: false };

      jobStatus = records[0].Status;
      errorMessage = records[0].Error;

      return { completed: DEVOPS_TERMINAL_SUCCESS.has(jobStatus) || DEVOPS_TERMINAL_FAILURE.has(jobStatus) };
    },
  });

  try {
    await pollingClient.subscribe();
  } catch (err) {
    if ((err as Error).name === 'DevopsTimeoutError') {
      return { jobId, jobStatus, timedOut: true };
    }
    throw err;
  }

  return { jobId, jobStatus, timedOut: false, errorMessage };
}
