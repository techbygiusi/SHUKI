/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.shuki.app',
  productName: 'SHUKI',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'package.json',
  ],
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity',
  },
  win: {
    target: ['nsis', 'zip'],
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office',
  },
};
