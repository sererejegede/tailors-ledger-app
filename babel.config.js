module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // WatermelonDB models use legacy decorators on class-field properties
      // (e.g. `@text('name') name: string`). The class-properties transform MUST run
      // AFTER the decorators plugin to consume the field initializer; otherwise the
      // legacy decorator emits a fallback that throws at runtime: "Decorating class
      // property failed. Please ensure that transform-class-properties is enabled and
      // runs after the decorators transform." We list class-properties explicitly so it
      // always runs (don't rely on the preset's engine-dependent inclusion).
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      // All three class-feature transforms must be enabled with the SAME `loose` value
      // or Babel errors ("'loose' mode configuration must be the same for ...") on any
      // file that uses private fields/methods — which WatermelonDB's own internals do.
      // Use loose:false (standard *define* semantics): what running class-properties
      // here achieves is consuming the legacy decorator's field initializer (fixing the
      // "Decorating class property failed" runtime error) — and the decorator transform
      // handles decorated fields regardless of loose mode. loose:true was WRONG: it
      // forces global *assignment* semantics on every class field, which clobbers a
      // read-only inherited property in a dependency at runtime ("Cannot assign to
      // read-only property 'NONE'"). define semantics is what libraries expect.
      ['@babel/plugin-transform-class-properties', { loose: false }],
      ['@babel/plugin-transform-private-methods', { loose: false }],
      ['@babel/plugin-transform-private-property-in-object', { loose: false }],
    ],
  };
};
