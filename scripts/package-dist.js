const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function log(msg) {
  console.log(`\x1b[36m[DOMScope Packager]\x1b[0m ${msg}`);
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  fs.cpSync(src, dest, { recursive: true, dereference: true, force: true });
}

async function run() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const appDistDir = path.join(distDir, 'DOMScope');
  const zipPath = path.join(distDir, 'DOMScope-Windows-x64.zip');

  log('Starting packaging workflow...');

  // 1. Build Next.js
  log('Running production Next.js build...');
  execSync('npm.cmd run build', { cwd: rootDir, stdio: 'inherit' });

  const standaloneDir = path.join(rootDir, '.next', 'standalone');
  if (!fs.existsSync(standaloneDir)) {
    throw new Error('Standalone output directory not found at: ' + standaloneDir);
  }

  // 2. Prepare clean dist directory
  log('Preparing distribution directory: ' + appDistDir);
  if (fs.existsSync(appDistDir)) {
    fs.rmSync(appDistDir, { recursive: true, force: true });
  }
  fs.mkdirSync(appDistDir, { recursive: true });

  // 3. Copy standalone files
  log('Copying Next.js standalone application files...');
  copyDirRecursive(standaloneDir, appDistDir);

  // 4. Copy static assets (.next/static -> dist/DOMScope/.next/static)
  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(appDistDir, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    log('Copying static assets (.next/static)...');
    copyDirRecursive(staticSrc, staticDest);
  }

  // 5. Copy public folder if present
  const publicSrc = path.join(rootDir, 'public');
  const publicDest = path.join(appDistDir, 'public');
  if (fs.existsSync(publicSrc)) {
    log('Copying public assets...');
    copyDirRecursive(publicSrc, publicDest);
  }

  // 6. Ensure .env exists in dist
  const envSrc = path.join(rootDir, '.env');
  const envDest = path.join(appDistDir, '.env');
  if (fs.existsSync(envSrc) && !fs.existsSync(envDest)) {
    fs.copyFileSync(envSrc, envDest);
  }

  // 7. Compile DOMScope.exe using Windows .NET Framework csc.exe
  log('Compiling native Windows launcher (DOMScope.exe)...');
  const launcherSource = path.join(rootDir, 'scripts', 'Launcher.cs');
  const launcherExe = path.join(appDistDir, 'DOMScope.exe');
  const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

  if (!fs.existsSync(cscPath)) {
    throw new Error('csc.exe not found at: ' + cscPath);
  }

  const cscCmd = `"${cscPath}" /nologo /optimize /target:exe /out:"${launcherExe}" "${launcherSource}"`;
  execSync(cscCmd, { stdio: 'inherit' });
  log('Compiled DOMScope.exe successfully.');

  // 8. Bundle portable node.exe
  const nodeExeSrc = process.execPath;
  const nodeExeDest = path.join(appDistDir, 'node.exe');
  log(`Bundling portable Node runtime from: ${nodeExeSrc}`);
  fs.copyFileSync(nodeExeSrc, nodeExeDest);

  // 9. Create README.txt in dist
  const readmeContent = `========================================================================
  [🔬] DOMScope - Website Intelligence Platform (Windows x64)
========================================================================

QUICK START:
1. Double-click "DOMScope.exe" to launch DOMScope.
2. The server will initialize and your default web browser will
   automatically open to: http://localhost:3000
3. To stop the application, press Ctrl+C in the console window or close it.

PORT CONFIGURATION:
- By default, DOMScope runs on port 3000.
- If port 3000 is occupied, it automatically picks the next available port.
- You can also specify a custom port in the console:
    set PORT=8080
    DOMScope.exe

DATABASE (OPTIONAL):
- DOMScope runs fully standalone out-of-the-box.
- If you wish to store analysis history or share snapshots with PostgreSQL,
  configure DATABASE_URL in the .env file.
========================================================================
`;
  fs.writeFileSync(path.join(appDistDir, 'README.txt'), readmeContent, 'utf8');

  // 10. Audit dist folder to ensure NO source code leaked
  log('Auditing package to verify absence of source code...');
  function auditDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'src' || entry.name === 'tests') {
          throw new Error(`Forbidden source directory found in dist: ${fullPath}`);
        }
        if (entry.name !== 'node_modules') {
          auditDir(fullPath);
        }
      } else {
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          throw new Error(`Forbidden TypeScript source file found in dist: ${fullPath}`);
        }
      }
    }
  }
  auditDir(appDistDir);
  log('Audit passed: Zero source code in distribution directory.');

  // 11. Create Distributable Zip
  log('Compressing distributable into ZIP archive: ' + zipPath);
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  // Use powershell Compress-Archive
  const psZipCmd = `powershell -Command "Compress-Archive -Path '${appDistDir}' -DestinationPath '${zipPath}' -Force"`;
  execSync(psZipCmd, { stdio: 'inherit' });

  const zipStats = fs.statSync(zipPath);
  const zipMb = (zipStats.size / (1024 * 1024)).toFixed(2);
  log(`ZIP archive created successfully (${zipMb} MB): ${zipPath}`);
  log('Distributable package is ready!');
}

run().catch((err) => {
  console.error('\x1b[31mPackaging failed:\x1b[0m', err);
  process.exit(1);
});
