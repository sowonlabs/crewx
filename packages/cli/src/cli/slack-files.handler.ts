import { Logger } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import { CliOptions } from '../cli-options';
import { SlackFileDownloadService } from '../slack/services/slack-file-download.service';
import { ConfigService } from '../services/config.service';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('SlackFilesHandler');

/**
 * Handle slack:files command: crewx slack:files [--thread <thread_ts>] [--list] [--clean]
 * Manual file download and management for Slack threads
 */
export async function handleSlackFiles(app: any, args: CliOptions) {
  logger.log('Slack files command received');

  try {
    const configService = app.get(ConfigService);
    const fileDownloadService = new SlackFileDownloadService(configService);

    // Get subcommand from process.argv
    const subCommand = getSlackFilesSubcommand();
    const threadId = getThreadOption();

    // Validate SLACK_BOT_TOKEN
    const botToken = process.env.SLACK_BOT_TOKEN;
    if (!botToken) {
      console.error('\n❌ Error: SLACK_BOT_TOKEN environment variable not found\n');
      console.log('Set your Slack bot token:');
      console.log('  export SLACK_BOT_TOKEN=xoxb-your-token\n');
      process.exit(1);
    }

    switch (subCommand) {
      case 'list':
        await handleListFiles(fileDownloadService, threadId);
        break;

      case 'clean':
        await handleCleanFiles(fileDownloadService, threadId);
        break;

      case 'download':
      default:
        await handleDownloadFiles(fileDownloadService, botToken, threadId);
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Slack files command failed:\n${errorMessage}\n`);
    logger.error(`Slack files command failed: ${errorMessage}`);
    process.exit(1);
  }
}

/**
 * Get slack:files subcommand from process.argv
 */
function getSlackFilesSubcommand(): string {
  const args = process.argv.slice(2);

  // Check for --list flag
  if (args.includes('--list') || args.includes('-l')) {
    return 'list';
  }

  // Check for --clean flag
  if (args.includes('--clean')) {
    return 'clean';
  }

  // Default: download
  return 'download';
}

/**
 * Get --thread option value
 */
function getThreadOption(): string | undefined {
  const args = process.argv.slice(2);

  // Find --thread or -t index
  const threadIndex = args.findIndex(arg => arg === '--thread' || arg === '-t');

  if (threadIndex !== -1 && threadIndex + 1 < args.length) {
    return args[threadIndex + 1];
  }

  return undefined;
}

/**
 * Download files from a Slack thread
 * Usage: crewx slack:files --thread <thread_ts>
 */
async function handleDownloadFiles(
  fileDownloadService: SlackFileDownloadService,
  botToken: string,
  threadId: string | undefined
) {
  if (!threadId) {
    console.error('\n❌ Error: --thread option is required for download\n');
    console.log('Usage: crewx slack:files --thread <thread_ts>\n');
    console.log('Example:');
    console.log('  crewx slack:files --thread 1234567890.123456\n');
    process.exit(1);
    return; // TypeScript guard - won't reach here
  }

  // TypeScript now knows threadId is string (not undefined)
  const validThreadId: string = threadId;

  console.log(`\n📥 Downloading files from thread: ${validThreadId}\n`);

  // Extract channel ID from thread timestamp (format: timestamp or channel.timestamp)
  const channelId: string = validThreadId.includes('.')
    ? (validThreadId.split('.')[0] || validThreadId)
    : validThreadId;

  // Create Slack client
  const client = new WebClient(botToken);

  try {

    // Get conversation history to find files
    const result = await client.conversations.history({
      channel: channelId,
      latest: validThreadId,
      inclusive: true,
      limit: 100,
    });

    if (!result.messages || result.messages.length === 0) {
      console.log('⚠️  No messages found in thread\n');
      return;
    }

    // Collect all files from messages
    const files: Array<{ id: string; name: string; userId: string }> = [];
    for (const message of result.messages) {
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

    // Download each file
    let downloadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      try {
        const metadata = await fileDownloadService.downloadFile(
          client,
          file.id,
          file.name,
          validThreadId,
          channelId, // Use extracted channel ID
          file.userId
        );

        // Check if file was newly downloaded or already existed
        const wasSkipped = fs.existsSync(metadata.filePath) &&
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

    // Summary
    console.log(`\n📊 Summary:`);
    if (downloadedCount > 0) {
      console.log(`  Downloaded: ${downloadedCount} file${downloadedCount > 1 ? 's' : ''}`);
    }
    if (skippedCount > 0) {
      console.log(`  Skipped: ${skippedCount} file${skippedCount > 1 ? 's' : ''} (already exists)`);
    }
    if (failedCount > 0) {
      console.log(`  Failed: ${failedCount} file${failedCount > 1 ? 's' : ''}`);
    }
    console.log('');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch thread history: ${errorMessage}`);
  }
}

/**
 * List downloaded files
 * Usage: crewx slack:files --list [--thread <thread_ts>]
 */
async function handleListFiles(
  fileDownloadService: SlackFileDownloadService,
  threadId: string | undefined
) {
  if (threadId) {
    // List files for specific thread
    console.log(`\n📋 Files in thread ${threadId}:\n`);

    const files = await fileDownloadService.getThreadFilesMetadata(threadId);

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
    // List all downloaded files across all threads
    console.log('\n📋 All downloaded Slack files:\n');

    const downloadDir = path.join(process.cwd(), '.crewx', 'slack-files');

    if (!fs.existsSync(downloadDir)) {
      console.log('  No files downloaded yet\n');
      return;
    }

    const threadDirs = fs.readdirSync(downloadDir).filter(name => {
      return fs.statSync(path.join(downloadDir, name)).isDirectory();
    });

    if (threadDirs.length === 0) {
      console.log('  No files downloaded yet\n');
      return;
    }

    let totalFiles = 0;

    for (const threadDir of threadDirs) {
      const files = await fileDownloadService.getThreadFilesMetadata(threadDir);

      if (files.length > 0) {
        console.log(`  Thread: ${threadDir}`);

        for (const file of files) {
          console.log(`    📎 ${file.fileName} (${formatFileSize(file.fileSize)})`);
          totalFiles++;
        }

        console.log('');
      }
    }

    console.log(`Total: ${totalFiles} file${totalFiles > 1 ? 's' : ''} in ${threadDirs.length} thread${threadDirs.length > 1 ? 's' : ''}\n`);
  }
}

/**
 * Clean old files
 * Usage: crewx slack:files --clean [--thread <thread_ts>]
 */
async function handleCleanFiles(
  fileDownloadService: SlackFileDownloadService,
  threadId: string | undefined
) {
  if (threadId) {
    // Clean specific thread
    console.log(`\n🧹 Cleaning files for thread ${threadId}...\n`);

    const threadDir = path.join(process.cwd(), '.crewx', 'slack-files', threadId);

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
    // Clean all files
    console.log('\n🧹 Cleaning all downloaded files...\n');

    const downloadDir = path.join(process.cwd(), '.crewx', 'slack-files');

    if (!fs.existsSync(downloadDir)) {
      console.log('  No files to clean\n');
      return;
    }

    let totalFiles = 0;
    let totalThreads = 0;

    const threadDirs = fs.readdirSync(downloadDir).filter(name => {
      return fs.statSync(path.join(downloadDir, name)).isDirectory();
    });

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

    console.log(`✅ Cleaned ${totalFiles} file${totalFiles > 1 ? 's' : ''} from ${totalThreads} thread${totalThreads > 1 ? 's' : ''}\n`);
  }
}

/**
 * Format file size for human-readable display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Show help for slack:files command
 */
function showSlackFilesHelp() {
  console.log('\nUsage: crewx slack:files [options]\n');
  console.log('Download and manage files from Slack threads\n');
  console.log('Options:');
  console.log('  --thread, -t <thread_ts>    Slack thread timestamp');
  console.log('  --list, -l                  List downloaded files');
  console.log('  --clean                     Clean/delete downloaded files\n');
  console.log('Examples:');
  console.log('  # Download files from a thread');
  console.log('  crewx slack:files --thread 1234567890.123456\n');
  console.log('  # List all downloaded files');
  console.log('  crewx slack:files --list\n');
  console.log('  # List files from specific thread');
  console.log('  crewx slack:files --list --thread 1234567890.123456\n');
  console.log('  # Clean all files');
  console.log('  crewx slack:files --clean\n');
  console.log('  # Clean files from specific thread');
  console.log('  crewx slack:files --clean --thread 1234567890.123456\n');
}
