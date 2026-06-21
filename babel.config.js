module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // WatermelonDB models use legacy decorators (@field, @date, @children …)
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  };
};
