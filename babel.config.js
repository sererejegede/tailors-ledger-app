module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // WatermelonDB models use legacy decorators on definite-assignment fields
    // (e.g. `@text('name') name!: string`). That requires class-field *set* (loose)
    // semantics, not *define* semantics — otherwise babel-transform-typescript rejects
    // the `!` assertion. setPublicClassFields enforces the loose semantics.
    assumptions: {
      setPublicClassFields: true,
    },
    plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
  };
};
