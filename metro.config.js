const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure platform-specific extensions are resolved in the correct order
config.resolver.sourceExts = ['tsx', 'ts', 'jsx', 'js', 'json'];
config.resolver.platforms = ['ios', 'android', 'web'];

module.exports = config;
