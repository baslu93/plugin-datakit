# summary

Check the status of an in-progress DataKit deployment.

# description

Polls the DataKitDeploymentLog until the deployment identified by the interview GUID reaches a terminal status.

# flags.interview-guid.summary

Interview GUID returned by the original deploy command.

# flags.target-org.summary

Username or alias of the target org.

# flags.wait.summary

Number of minutes to wait for the deployment to complete before timing out.

# error.noTargetOrg

No target org specified and no default org found. Use --target-org or set a default org with "sf org login".

# error.deployFailed

Deployment failed: %s

# warning.deployTimeout

Deployment is still in progress. Run the following command to check its status again:

  sf datakit deploy report --interview-guid %s

# success

Deployment completed successfully.
