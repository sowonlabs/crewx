/**
 * Lightweight Slack file downloader for CLI bot mode.
 * Ported from cli-bak SlackFileDownloadService, stripped of NestJS deps.
 * Uses Node.js built-in https for API calls.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export interface DownloadedFile {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  threadId: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function downloadInboundFiles(
  botToken: string,
  files: Array<{ url_private: string; mimetype: string; name: string }>,
  threadId: string,
): Promise<DownloadedFile[]> {
  if (!files || files.length === 0) return [];

  const results: DownloadedFile[] = [];
  const downloadDir = path.join(process.cwd(), '.crewx', 'slack-files');
  const safeThreadDir = threadId.replace(/:/g, '_');

  for (const file of files) {
    if (!file.url_private) continue;

    const sanitizedName = sanitizeFileName(file.name || 'unnamed_file');
    const saveDir = path.join(downloadDir, safeThreadDir);
    const savePath = path.join(saveDir, sanitizedName);

    try {
      if (fs.existsSync(savePath)) {
        const stats = fs.statSync(savePath);
        results.push({
          fileId: '',
          fileName: sanitizedName,
          filePath: savePath,
          fileSize: stats.size,
          threadId,
        });
        continue;
      }

      await fs.promises.mkdir(saveDir, { recursive: true });
      const buffer = await fetchUrl(botToken, file.url_private);

      if (buffer.length > MAX_FILE_SIZE) {
        console.error(`File too large: ${sanitizedName} (${formatSize(buffer.length)})`);
        continue;
      }

      await fs.promises.writeFile(savePath, buffer);
      results.push({
        fileId: '',
        fileName: sanitizedName,
        filePath: savePath,
        fileSize: buffer.length,
        threadId,
      });
    } catch (err) {
      console.error(`Failed to download file ${sanitizedName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return results;
}

function fetchUrl(token: string, url: string): Promise<Buffer> {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          fetchUrl(token, location).then(resolve).catch(reject);
          return;
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function sanitizeFileName(name: string): string {
  let safe = name.replace(/[/\\]/g, '_').replace(/\.\./g, '_');
  safe = safe.replace(/[\x00-\x1f\x80-\x9f<>:"|?*]/g, '_');
  safe = safe.replace(/^\.+|\.+$/g, '').trim();
  return safe || 'unnamed_file';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
