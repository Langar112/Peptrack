const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Prevent Metro from watching vitest temp files — they're created and deleted
// during test runs and cause ENOENT crashes in the file watcher.
const vitestBlockPattern = /node_modules\/.pnpm\/@vitest[^/]*\/node_modules\/.*_tmp_\d+/;
const defaultBlockList = config.resolver?.blockList ?? [];
const blockListArray = Array.isArray(defaultBlockList) ? defaultBlockList : [defaultBlockList];
config.resolver = {
  ...config.resolver,
  blockList: [...blockListArray, vitestBlockPattern],
};

module.exports = config;
