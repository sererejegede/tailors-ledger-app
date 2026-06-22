// Metro config: turn .svg imports into React components via react-native-svg-transformer
// (so `import Icon from './x.svg'` gives a themeable <Icon color=… /> component).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts.push('svg');

module.exports = config;
