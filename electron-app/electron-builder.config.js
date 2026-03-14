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
    {
      from: 'dist',
      to: 'dist',
      filter: ['**/*'],
    },
    'package.json',
  ],
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity',
    icon: 'assets/icon.png',
  },
  win: {
    target: ['nsis', 'zip'],
    icon: 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'SHUKI',
    installerSidebar: 'assets/installer-sidebar.bmp',
    uninstallerSidebar: 'assets/installer-sidebar.bmp',
    include: 'assets/installer.nsh',
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office',
    icon: 'assets/icon.png',
  },
};
