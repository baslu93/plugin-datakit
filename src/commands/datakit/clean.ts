import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { readKitObjects } from '../../helpers/localMetadataReader.js';
import { cleanDataKit, CleanStats } from '../../helpers/datakitCleaner.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-datakit', 'datakit.clean');

export type DatakitCleanResult = CleanStats;

export default class DatakitClean extends SfCommand<DatakitCleanResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'developer-name': Flags.string({
      summary: messages.getMessage('flags.developer-name.summary'),
      char: 'n',
    }),
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      char: 'p',
      required: true,
      exists: true,
    }),
  };

  public async run(): Promise<DatakitCleanResult> {
    const { flags } = await this.parse(DatakitClean);

    const sourcePath = flags['source-path'] as string;
    const developerName = flags['developer-name'] as string | undefined;

    // Resolve which DLM objects to clean
    let dlmObjectNames: string[] = [];

    if (developerName) {
      this.spinner.start(`Resolving DLM objects for "${developerName}"`);
      const kitObjects = await readKitObjects(sourcePath, developerName);
      dlmObjectNames = kitObjects
        .filter(o => o.referenceObjectType === 'MktDataModelObject')
        .map(o => o.referenceObjectName);
      this.spinner.stop(`${dlmObjectNames.length} DLM object(s)`);
    }

    this.spinner.start('Cleaning fields and templates');
    const stats = await cleanDataKit(sourcePath, dlmObjectNames);
    this.spinner.stop('done');

    for (const f of stats.deletedFields) {
      this.log(`deleted  ${f.reason === 'KeyQualifier' ? 'KQ  ' : 'rel '} ${f.apiName}`);
    }
    for (const t of stats.updatedTemplates) {
      this.log(`updated template  ${t}`);
    }

    this.log('');
    this.log(messages.getMessage('success', [stats.deletedFields.length, stats.updatedTemplates.length]));

    return stats;
  }
}
