# plugin-datakit

[![Version](https://img.shields.io/npm/v/@salesforce/plugin-datakit.svg)](https://npmjs.org/package/@salesforce/plugin-datakit)
[![License](https://img.shields.io/npm/l/@salesforce/plugin-datakit.svg)](https://github.com/salesforce/plugin-datakit/blob/main/LICENSE)

`plugin-datakit` is a Salesforce CLI plugin that automates the deployment of DataKit objects to a Salesforce org. A DataKit bundles a set of data components—defined in a `DataPackageDefinition` metadata record—that need to be provisioned together. This plugin reads that definition from the org's Metadata API, constructs the deployment payload, and invokes the `sfdatakit__DeployDataKitComponents` flow API to deploy all components in one step. Long-running deployments are polled automatically, and a separate `report` command lets you resume checking the status of any deployment that was still in progress when a prior run timed out.

## Installation

```sh
sf plugins install @salesforce/plugin-datakit
```

## Contributing

To work on this plugin locally, clone the repo and link it into your Salesforce CLI installation:

```sh
git clone https://github.com/salesforce/plugin-datakit.git
cd plugin-datakit
npm install
sf plugins link .
```

Changes to TypeScript source must be compiled before they take effect:

```sh
npm run build
```

## Commands

<!-- toc -->
* [plugin-datakit](#plugin-datakit)
<!-- tocstop -->

<!-- commands -->
* [`sf datakit deploy report`](#sf-datakit-deploy-report)
* [`sf datakit deploy start`](#sf-datakit-deploy-start)

## `sf datakit deploy report`

Check the status of an in-progress DataKit deployment.

```
USAGE
  $ sf datakit deploy report -i <value> [-o <value>] [--api-version <value>] [-w <value>]

FLAGS
  -i, --interview-guid=<value>  (required) Interview GUID returned by the original deploy command.
  -o, --target-org=<value>      Username or alias of the target org.
  -w, --wait=<value>            [default: 10 minutes] Number of minutes to wait for the deployment to complete before
                                timing out.
  --api-version=<value>         Override the api version used for api requests made by this command

DESCRIPTION
  Check the status of an in-progress DataKit deployment.

  Polls the DataKitDeploymentLog until the deployment identified by the interview GUID reaches a terminal status.
```

## `sf datakit deploy start`

Deploy a DataKit to the target org.

```
USAGE
  $ sf datakit deploy start -n <value> [-o <value>] [--api-version <value>] [-w <value>]

FLAGS
  -n, --developer-name=<value>  (required) Developer name of the DataPackageDefinition to deploy.
  -o, --target-org=<value>      Username or alias of the target org.
  -w, --wait=<value>            [default: 10 minutes] Number of minutes to wait for the deployment to complete before
                                timing out.
  --api-version=<value>         Override the api version used for api requests made by this command

DESCRIPTION
  Deploy a DataKit to the target org.

  Reads a DataPackageDefinition by developer name via the Metadata API, builds the component payload, and calls the
  sfdatakit__DeployDataKitComponents flow API to deploy all components to the connected Salesforce org.

EXAMPLES
  Deploy a DataKit to the default org:

    $ sf datakit deploy start --developer-name MyDataKit

  Deploy a DataKit to a specific org:

    $ sf datakit deploy start --developer-name MyDataKit --target-org myOrg

  Deploy using a specific API version:

    $ sf datakit deploy start --developer-name MyDataKit --target-org myOrg --api-version 62.0
```
<!-- commandsstop -->

## License

This plugin is licensed under the [Apache License 2.0](LICENSE).
