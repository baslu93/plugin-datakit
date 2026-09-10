# summary

Clean a DataKit by removing generated fields from its DLM objects.

# description

Deletes KeyQualifier fields and rel_<number>_end relationship fields from the DLM object field files under the source path. Also checks all dataKitObjectTemplate entityPayload JSON for any references to the removed fields and strips those objects. Use this before deploying to a target org when those generated fields are not required.

See https://help.salesforce.com/s/articleView?id=005224006&type=1 for the Salesforce guidance this command is based on.

# flags.developer-name.summary

Developer name of the DataPackageKitDefinition whose DLM objects should be cleaned. If omitted, all __dlm objects under the source path are cleaned.

# flags.source-path.summary

Path to the local directory containing the DataKit metadata.

# examples

- Clean a specific DataKit:

  <%= config.bin %> <%= command.id %> --developer-name MyDataKit --source-path ./force-app

- Clean all DLM objects under a path:

  <%= config.bin %> <%= command.id %> --source-path ./force-app

# error.datakitNotFound

DataPackageKitDefinition with developer name "%s" not found in source path "%s".

# success

Deleted %d field(s) and updated %d template(s).
