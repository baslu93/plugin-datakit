import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { buildDeployPayload } from '../../../helpers/payloadBuilder.js';
import { DeployDataKitRequest } from '../../../types/datapackagedefinition.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-datakit', 'datakit.deploy.preview');

export type DatakitDeployPreviewResult = DeployDataKitRequest;

export default class DatakitDeployPreview extends SfCommand<DatakitDeployPreviewResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'developer-name': Flags.string({
      summary: messages.getMessage('flags.developer-name.summary'),
      char: 'n',
      required: true,
    }),
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      char: 'p',
      required: true,
      exists: true,
    }),
  };

  public async run(): Promise<DatakitDeployPreviewResult> {
    const { flags } = await this.parse(DatakitDeployPreview);

    const developerName = flags['developer-name'] as string;
    const sourcePath = flags['source-path'] as string;

    const built = await buildDeployPayload(sourcePath, developerName);

    if (!built) {
      throw messages.createError('error.datakitNotFound', [developerName, sourcePath]);
    }

    this.log(JSON.stringify(built.payload, null, 2));

    return built.payload;
  }
}
