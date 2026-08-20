const fs = require('fs');
const Module = require('module');

const originalLoad = Module._load;

/**
 * Metro 0.83 supplies asset file paths to image-size, whereas image-size 2.x
 * accepts binary data. Apply a narrow adapter before Metro or its transform
 * workers load the module. NODE_OPTIONS preloads this file in both processes.
 */
Module._load = function loadWithImageSizePathSupport(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);

  if (request !== 'image-size' || !loaded?.default || loaded.default.__metroPathCompat) {
    return loaded;
  }

  const imageSize = loaded.default;
  const compatibleImageSize = (input, ...options) =>
    imageSize(typeof input === 'string' ? fs.readFileSync(input) : input, ...options);

  Object.defineProperty(compatibleImageSize, '__metroPathCompat', { value: true });
  loaded.default = compatibleImageSize;
  loaded.imageSize = compatibleImageSize;

  return loaded;
};