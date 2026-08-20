const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, '.expo-web-verification');
const metroCompatPath = path.join(
  projectRoot,
  'scripts',
  'image-size-metro-compat.cjs',
);

function getMetroNodeOptions() {
  const existing = process.env.NODE_OPTIONS || '';
  return existing.includes(metroCompatPath)
    ? existing
    : `${existing} --require=${metroCompatPath}`.trim();
}

function cleanOutput() {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

cleanOutput();

const expo = spawn(
  'pnpm',
  [
    'exec',
    'expo',
    'export',
    '--platform',
    'web',
    '--output-dir',
    outputDir,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_OPTIONS: getMetroNodeOptions(),
    },
    stdio: 'inherit',
  },
);

expo.on('exit', (code, signal) => {
  cleanOutput();
  if (signal) {
    console.error(`Web verification stopped by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

expo.on('error', (error) => {
  cleanOutput();
  console.error(`Unable to start web verification: ${error.message}`);
  process.exit(1);
});