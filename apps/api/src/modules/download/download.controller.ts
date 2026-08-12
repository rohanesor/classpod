import { Controller, Get, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@Controller('download')
export class DownloadController {
  @Get('apk')
  getApkDownload(@Res({ passthrough: true }) res: Response): StreamableFile {
    // Look for compiled ClassPod.apk in public or root assets directory
    const candidates = [
      join(process.cwd(), '../web/public/ClassPod.apk'),
      join(process.cwd(), 'public/ClassPod.apk'),
      join(process.cwd(), '../web/out/ClassPod.apk'),
      join(process.cwd(), 'ClassPod.apk'),
    ];

    let apkPath = '';
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        apkPath = candidate;
        break;
      }
    }

    if (!apkPath) {
      // Fallback: Redirect to GitHub Release latest CDN asset
      res.redirect(302, 'https://github.com/rohanesor/classpod/releases/latest/download/app-release.apk');
      return undefined as any;
    }

    res.set({
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="ClassPod.apk"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    const file = createReadStream(apkPath);
    return new StreamableFile(file);
  }
}
