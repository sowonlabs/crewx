/**
 * CLI convenience wrapper for SqliteTracingPlugin.
 * Accepts a dbRoot string or an options object so existing CLI tests can pass
 * a temp directory path directly.
 */
import { SqliteTracingPlugin as SdkPlugin } from '@crewx/sdk/plugins';
export type { SqliteTracingPluginOptions } from '@crewx/sdk/plugins';

export class SqliteTracingPlugin extends SdkPlugin {
  constructor(dbRootOrOpts?: string | { dbRoot?: string; version?: string }) {
    if (typeof dbRootOrOpts === 'string') {
      super({ dbRoot: dbRootOrOpts });
    } else {
      super(dbRootOrOpts);
    }
  }
}
