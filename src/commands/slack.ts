/**
 * Slack files command — crewx slack:files [--thread <thread_ts>] [--list] [--clean]
 *
 * Ported 1:1 from packages/cli-bak/src/cli/slack-files.handler.ts.
 * Implements download/list/clean operations without NestJS or @slack/web-api.
 * Uses Node.js built-in https and fetch for Slack API calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { SlackAdapter } from '@crewx/adapter-slack';
import { createCliCrewx } from '../bootstrap/crewx-cli';
import { markdownToMrkdwn } from '../slack/markdown';
import { downloadInboundFiles } from '../slack/file-download';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SlackFileMetadata {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  threadId: string;
  channelId: string;
  downloadedAt: Date;
}

// ─── Entry point ──────────────────────────────────────────────────────────

/**
 * Handle `crewx slack` / `crewx slack:files` commands.
 * Subcommand is determined by flags: --list → list, --clean → clean, default → download.
 */
export async function handleSlack(args: string[]): Promise<void> {
  if (args.includes('--mode') || args.includes('--agent')) {
    return await handleBotMode(args);
  }

  try {
    const subCommand = getSubcommand(args);
    const threadId = getThreadOption(args);

    const botToken = process.env.SLACK_BOT_TOKEN;
    if (!botToken && subCommand === 'download') {
      console.error('\n❌ Error: SLACK_BOT_TOKEN environment variable not found\n');
      console.log('Set your Slack bot token:');
      console.log('  export SLACK_BOT_TOKEN=xoxb-your-token\n');
      process.exit(1);
    }

    switch (subCommand) {
      case 'list':
        await handleListFiles(threadId);
        break;

      case 'clean':
        await handleCleanFiles(threadId);
        break;

      case 'download':
      default:
        await handleDownloadFiles(botToken!, threadId);
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Slack files command failed:\n${errorMessage}\n`);
    process.exit(1);
  }
}

// ─── Subcommand resolution ───────────────────────────────────────────────

function getSubcommand(args: string[]): string {
  if (args.includes('--list') || args.includes('-l')) return 'list';
  if (args.includes('--clean')) return 'clean';
  return 'download';
}

function getThreadOption(args: string[]): string | undefined {
  const idx = args.findIndex(a => a === '--thread' || a === '-t');
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

// ─── Download ────────────────────────────────────────────────────────────

async function handleDownloadFiles(botToken: string, threadId: string | undefined): Promise<void> {
  if (!threadId) {
    console.error('\n❌ Error: --thread option is required for download\n');
    console.log('Usage: crewx slack:files --thread <thread_ts>\n');
    console.log('Example:');
    console.log('  crewx slack:files --thread 1234567890.123456\n');
    process.exit(1);
    return;
  }

  const validThreadId: string = threadId;
  console.log(`\n📥 Downloading files from thread: ${validThreadId}\n`);

  const channelId: string = validThreadId.includes('.')
    ? (validThreadId.split('.')[0] || validThreadId)
    : validThreadId;

  // Fetch conversation history from Slack API
  const messages = await slackConversationsHistory(botToken, channelId, validThreadId);

  if (!messages || messages.length === 0) {
    console.log('⚠️  No messages found in thread\n');
    return;
  }

  // Collect files from messages
  const files: Array<{ id: string; name: string; userId: string }> = [];
  for (const message of messages) {
    if ((message as any).files) {
      for (const file of (message as any).files) {
        files.push({
          id: file.id,
          name: file.name,
          userId: (message as any).user || 'unknown',
        });
      }
    }
  }

  if (files.length === 0) {
    console.log('ℹ️  No files found in thread\n');
    return;
  }

  console.log(`Found ${files.length} file${files.length > 1 ? 's' : ''} to download:\n`);

  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    try {
      const metadata = await downloadSlackFile(botToken, file.id, file.name, validThreadId, channelId, file.userId);

      const wasSkipped =
        fs.existsSync(metadata.filePath) &&
        fs.statSync(metadata.filePath).mtime < metadata.downloadedAt;

      if (wasSkipped) {
        console.log(`  ⏭️  ${file.name} (already exists)`);
        skippedCount++;
      } else {
        console.log(`  ✅ ${file.name} (${formatFileSize(metadata.fileSize)})`);
        downloadedCount++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ ${file.name} - ${errorMessage}`);
      failedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  if (downloadedCount > 0) console.log(`  Downloaded: ${downloadedCount} file${downloadedCount > 1 ? 's' : ''}`);
  if (skippedCount > 0) console.log(`  Skipped: ${skippedCount} file${skippedCount > 1 ? 's' : ''} (already exists)`);
  if (failedCount > 0) console.log(`  Failed: ${failedCount} file${failedCount > 1 ? 's' : ''}`);
  console.log('');
}

// ─── List ────────────────────────────────────────────────────────────────

async function handleListFiles(threadId: string | undefined): Promise<void> {
  const downloadDir = path.join(process.cwd(), '.crewx', 'slack-files');

  if (threadId) {
    console.log(`\n📋 Files in thread ${threadId}:\n`);

    const files = getThreadFilesMetadata(threadId, downloadDir);

    if (files.length === 0) {
      console.log('  No files downloaded for this thread\n');
      return;
    }

    for (const file of files) {
      console.log(`  📎 ${file.fileName}`);
      console.log(`     Size: ${formatFileSize(file.fileSize)}`);
      console.log(`     Path: ${file.filePath}`);
      console.log(`     Downloaded: ${file.downloadedAt.toLocaleString()}`);
      console.log('');
    }

    console.log(`Total: ${files.length} file${files.length > 1 ? 's' : ''}\n`);
  } else {
    console.log('\n📋 All downloaded Slack files:\n');

    if (!fs.existsSync(downloadDir)) {
      console.log('  No files downloaded yet\n');
      return;
    }

    const threadDirs = fs.readdirSync(downloadDir).filter(name =>
      fs.statSync(path.join(downloadDir, name)).isDirectory(),
    );

    if (threadDirs.length === 0) {
      console.log('  No files downloaded yet\n');
      return;
    }

    let totalFiles = 0;

    for (const threadDir of threadDirs) {
      const files = getThreadFilesMetadata(threadDir, downloadDir);

      if (files.length > 0) {
        console.log(`  Thread: ${threadDir}`);

        for (const file of files) {
          console.log(`    📎 ${file.fileName} (${formatFileSize(file.fileSize)})`);
          totalFiles++;
        }

        console.log('');
      }
    }

    console.log(
      `Total: ${totalFiles} file${totalFiles > 1 ? 's' : ''} in ${threadDirs.length} thread${threadDirs.length > 1 ? 's' : ''}\n`,
    );
  }
}

// ─── Clean ───────────────────────────────────────────────────────────────

async function handleCleanFiles(threadId: string | undefined): Promise<void> {
  const downloadDir = path.join(process.cwd(), '.crewx', 'slack-files');

  if (threadId) {
    console.log(`\n🧹 Cleaning files for thread ${threadId}...\n`);

    const safeThreadDir = threadId.replace(/:/g, '_');
    const threadDir = path.join(downloadDir, safeThreadDir);

    if (!fs.existsSync(threadDir)) {
      console.log('  No files to clean\n');
      return;
    }

    const files = fs.readdirSync(threadDir);

    for (const file of files) {
      fs.unlinkSync(path.join(threadDir, file));
    }

    fs.rmdirSync(threadDir);
    console.log(`✅ Cleaned ${files.length} file${files.length > 1 ? 's' : ''}\n`);
  } else {
    console.log('\n🧹 Cleaning all downloaded files...\n');

    if (!fs.existsSync(downloadDir)) {
      console.log('  No files to clean\n');
      return;
    }

    let totalFiles = 0;
    let totalThreads = 0;

    const threadDirs = fs.readdirSync(downloadDir).filter(name =>
      fs.statSync(path.join(downloadDir, name)).isDirectory(),
    );

    for (const threadDir of threadDirs) {
      const threadPath = path.join(downloadDir, threadDir);
      const files = fs.readdirSync(threadPath);

      for (const file of files) {
        fs.unlinkSync(path.join(threadPath, file));
        totalFiles++;
      }

      fs.rmdirSync(threadPath);
      totalThreads++;
    }

    console.log(
      `✅ Cleaned ${totalFiles} file${totalFiles > 1 ? 's' : ''} from ${totalThreads} thread${totalThreads > 1 ? 's' : ''}\n`,
    );
  }
}

// ─── Slack API helpers ───────────────────────────────────────────────────

/**
 * Call Slack conversations.history API using Node.js https.
 * Returns array of message objects.
 */
async function slackConversationsHistory(
  token: string,
  channel: string,
  latest: string,
): Promise<any[]> {
  const params = new URLSearchParams({
    channel,
    latest,
    inclusive: 'true',
    limit: '100',
  });

  const data = await slackApiGet(token, `conversations.history?${params.toString()}`);

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? 'unknown_error'}`);
  }

  return data.messages ?? [];
}

/**
 * Download a single Slack file and save it to disk.
 */
async function downloadSlackFile(
  botToken: string,
  fileId: string,
  fileName: string,
  threadId: string,
  channelId: string,
  userId: string,
): Promise<SlackFileMetadata> {
  // Get file info
  const infoData = await slackApiGet(botToken, `files.info?file=${fileId}`);

  if (!infoData.ok) {
    throw new Error(`Failed to get file info: ${infoData.error ?? 'unknown_error'}`);
  }

  const fileInfo = infoData.file;
  if (!fileInfo?.url_private) {
    throw new Error('No private download URL available for this file');
  }

  // Build save path
  const sanitized = sanitizeFileName(fileName);
  const uniqueName = `${fileId}${path.extname(sanitized)}`;
  const safeThreadDir = threadId.replace(/:/g, '_');
  const downloadDir = path.join(process.cwd(), '.crewx', 'slack-files');
  const savePath = path.join(downloadDir, safeThreadDir, uniqueName);

  // Duplicate check
  if (fs.existsSync(savePath)) {
    const stats = fs.statSync(savePath);
    return {
      fileId,
      fileName: sanitized,
      filePath: savePath,
      fileSize: stats.size,
      mimeType: fileInfo.mimetype ?? 'application/octet-stream',
      uploadedBy: userId,
      uploadedAt: new Date((fileInfo.timestamp ?? 0) * 1000),
      threadId,
      channelId,
      downloadedAt: new Date(stats.mtime),
    };
  }

  // Fetch file content from Slack private URL
  const fileBuffer = await fetchPrivateUrl(botToken, fileInfo.url_private);

  // Save to disk
  await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
  await fs.promises.writeFile(savePath, fileBuffer);

  return {
    fileId,
    fileName: sanitized,
    filePath: savePath,
    fileSize: fileBuffer.length,
    mimeType: fileInfo.mimetype ?? 'application/octet-stream',
    uploadedBy: userId,
    uploadedAt: new Date((fileInfo.timestamp ?? 0) * 1000),
    threadId,
    channelId,
    downloadedAt: new Date(),
  };
}

/**
 * Make a GET request to a Slack API endpoint.
 */
async function slackApiGet(token: string, endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'slack.com',
      path: `/api/${endpoint}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Failed to parse Slack API response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Slack API request timed out'));
    });
    req.end();
  });
}

/**
 * Download content from a Slack private URL using Bearer auth.
 */
async function fetchPrivateUrl(token: string, url: string): Promise<Buffer> {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const req = https.request(options, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        const location = res.headers.location;
        if (!location) {
          reject(new Error('Redirect without location header'));
          return;
        }
        fetchPrivateUrl(token, location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} while downloading file`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('File download timed out'));
    });
    req.end();
  });
}

// ─── Local file helpers ───────────────────────────────────────────────────

function getThreadFilesMetadata(threadId: string, downloadDir: string): SlackFileMetadata[] {
  const safeThreadDir = threadId.replace(/:/g, '_');
  const threadDir = path.join(downloadDir, safeThreadDir);

  if (!fs.existsSync(threadDir)) return [];

  const files = fs.readdirSync(threadDir);
  const metadata: SlackFileMetadata[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(threadDir, file);
      const stats = fs.statSync(filePath);

      metadata.push({
        fileId: '',
        fileName: file,
        filePath,
        fileSize: stats.size,
        mimeType: guessMimeType(file),
        uploadedBy: '',
        uploadedAt: new Date(stats.birthtime),
        threadId,
        channelId: '',
        downloadedAt: new Date(stats.mtime),
      });
    } catch {
      // ignore unreadable files
    }
  }

  return metadata;
}

function sanitizeFileName(fileName: string): string {
  let safeName = fileName.replace(/[/\\]/g, '_');
  safeName = safeName.replace(/\.\./g, '_');
  safeName = safeName.replace(/[\x00-\x1f\x80-\x9f<>:"|?*]/g, '_');
  safeName = safeName.replace(/^\.+|\.+$/g, '');
  safeName = safeName.trim();
  if (!safeName) safeName = 'unnamed_file';
  return safeName;
}

function guessMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Bot mode ────────────────────────────────────────────────────────────

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  const prefix = `${flag}=`;
  const found = args.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function handleBotMode(args: string[]): Promise<void> {
  const mode = parseFlag(args, '--mode') ?? 'query';
  const agent = parseFlag(args, '--agent');

  if (!agent) {
    console.error('Error: --agent required for bot mode');
    console.error('Usage: crewx slack --mode <query|execute> --agent <agent-id>');
    process.exit(1);
  }

  if (mode !== 'query' && mode !== 'execute') {
    console.error(`Error: invalid mode "${mode}" — must be query or execute`);
    process.exit(1);
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (!botToken || !appToken) {
    console.error('Error: SLACK_BOT_TOKEN and SLACK_APP_TOKEN environment variables required');
    process.exit(1);
  }

  const configPath = process.env.CREWX_CONFIG ?? './crewx.yaml';

  let crewx;
  try {
    crewx = await createCliCrewx(configPath);
  } catch (err) {
    console.error(`Failed to load config: ${configPath}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const adapter = new SlackAdapter();

  await crewx.registerChannelAdapter({
    adapter,
    instanceId: `slack-${agent}`,
    config: { mode: 'socket', botToken, appToken, myAgentId: agent },
    defaultMode: mode as 'query' | 'execute',
    defaultAgent: agent,
    onInbound: async (msg) => {
      if (msg.attachments && msg.attachments.length > 0) {
        try {
          await downloadInboundFiles(
            botToken,
            msg.attachments.map(a => ({
              url_private: a.url,
              mimetype: a.mimeType ?? 'application/octet-stream',
              name: a.name ?? 'unnamed',
            })),
            msg.threadId,
          );
        } catch (err) {
          console.error('File download failed:', err instanceof Error ? err.message : String(err));
        }
      }

      const fn = mode === 'execute' ? crewx.execute.bind(crewx) : crewx.query.bind(crewx);
      const result = await fn(`@${agent}`, msg.text, { threadId: msg.threadId, platform: adapter.manifest.platform as any });
      const rawOutput = result.ok
        ? result.data
        : (result.error?.message ?? 'Error');

      return { accepted: true, output: markdownToMrkdwn(rawOutput) };
    },
  });

  console.log(`Slack bot started (agent=${agent}, mode=${mode}, instance=slack-${agent})`);
  console.log('Press Ctrl+C to shut down.');

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      console.log('\nShutting down...');
      try {
        await crewx.stopAllAdapters({ timeoutMs: 5000 });
      } catch (err) {
        console.error('Shutdown error:', err instanceof Error ? err.message : String(err));
      }
      resolve();
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });

  process.exit(0);
}
