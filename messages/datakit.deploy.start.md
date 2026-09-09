# summary

Deploy a DataKit to the target org.

# description

Reads a DataPackageDefinition by developer name via the Metadata API, builds the component payload, and calls the sfdatakit__DeployDataKitComponents flow API to deploy all components to the connected Salesforce org.

# flags.developer-name.summary

Developer name of the DataPackageDefinition to deploy.

# flags.target-org.summary

Username or alias of the target org.

# flags.wait.summary

Number of minutes to wait for the deployment to complete before timing out.

# examples

- Deploy a DataKit to the default org:

  <%= config.bin %> <%= command.id %> --developer-name MyDataKit

- Deploy a DataKit to a specific org:

  <%= config.bin %> <%= command.id %> --developer-name MyDataKit --target-org myOrg

- Deploy using a specific API version:

  <%= config.bin %> <%= command.id %> --developer-name MyDataKit --target-org myOrg --api-version 62.0

# error.noTargetOrg

No target org specified and no default org found. Use --target-org or set a default org with "sf org login".

# error.datakitNotFound

DataPackageDefinition with developer name "%s" not found in org "%s".

# error.deployFailed

Deployment of DataKit "%s" failed: %s

# warning.deployTimeout

Deployment of DataKit "%s" is still in progress. Run the following command to check its status:

  sf datakit deploy report --interview-guid %s

# success

DataKit "%s" deployed successfully to org "%s".
