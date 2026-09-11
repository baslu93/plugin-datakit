# summary

Check the status of an in-progress DataKit deployment.

# description

Polls the BackgroundOperation record for the given job ID until the deployment reaches a terminal status (Completed, Failed, Error, or Aborted).

# flags.job-id.summary

Job ID returned by the "sf datakit devops start" command.

# flags.target-org.summary

Username or alias of the target org.

# flags.wait.summary

Number of minutes to wait for the deployment to complete. If omitted, returns the current status immediately without waiting.

# examples

- Check deployment status:

  <%= config.bin %> <%= command.id %> --job-id 0BkXx000000xxxxx

- Check deployment status and return result as JSON:

  <%= config.bin %> <%= command.id %> --job-id 0BkXx000000xxxxx --json

# info.currentStatus

Current deployment status: %s

# error.noTargetOrg

No target org specified and no default org found. Use --target-org or set a default org with "sf org login".

# error.deployFailed

Deployment failed: %s

# warning.timeout

Deployment job "%s" is still in progress. Run this command again to continue waiting.

# success

Deployment completed successfully.
