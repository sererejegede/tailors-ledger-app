// WatermelonDB code (our models + the library) that needs the forced class-properties
// transform. A FUNCTION test (not a RegExp) is required: Expo's Metro transformer loads
// this config without a filename to compute a cache key, and Babel throws on a
// string/RegExp `test` when no filename is present — but a function is simply called
// (with undefined at cache-key time → false), so it's safe.
const WATERMELON_PATH = /[\\/](src[\\/]db[\\/]models|node_modules[\\/]@nozbe[\\/]watermelondb)[\\/]/;

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // WatermelonDB models use legacy decorators. (No-op for files without decorators,
      // e.g. all the UI/react-navigation code.)
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // Reanimated 4 uses the worklets babel plugin; it MUST be listed last.
      'react-native-worklets/plugin',
    ],
    // The class-properties tangle (see docs/PROGRESS.md):
    //  - WatermelonDB's decorators need the class-properties transform to RUN so the
    //    decorated field initializer is consumed; on Hermes, babel-preset-expo SKIPS it
    //    for those files, so without forcing it we get "Decorating class property failed".
    //  - But forcing class-properties GLOBALLY breaks other libraries: loose:false makes
    //    react-navigation throw "property is not configurable"; loose:true made a
    //    dependency throw "Cannot assign to read-only property 'NONE'".
    // So force it ONLY for WatermelonDB code (our models + the library), with the
    // define-semantics (loose:false) treatment under which the DB boots. Everything else
    // keeps Metro's default compilation, which react-navigation and friends expect.
    overrides: [
      {
        test: (filename) => typeof filename === 'string' && WATERMELON_PATH.test(filename),
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: false }],
          ['@babel/plugin-transform-private-methods', { loose: false }],
          ['@babel/plugin-transform-private-property-in-object', { loose: false }],
        ],
      },
    ],
  };
};
