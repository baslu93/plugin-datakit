# summary

Generate the deploy payload for a DataKit without deploying it.

# description

Reads the DataPackageKitDefinition, DataPackageKitObjects, and DataSourceBundleDefinitions from a local metadata directory and prints the JSON payload that would be sent to the sfdatakit__DeployDataKitComponents flow API. Use this to validate the payload against the debug log produced when deploying the same DataKit from the org.

# flags.developer-name.summary

Developer name of the DataPackageKitDefinition to preview.

# flags.source-path.summary

Path to the local directory containing the DataKit metadata (dataPackageKitDefinitions, DataPackageKitObjects, dataSourceBundleDefinitions).

# examples

- Preview the deploy payload for a DataKit:

  <%= config.bin %> <%= command.id %> --developer-name MyDataKit --source-path ./force-app

# error.datakitNotFound

DataPackageKitDefinition with developer name "%s" not found in source path "%s".
