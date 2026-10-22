module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === "production";
  const plugins = [
    [
      "module-resolver",
      {
        root: ["."],
        alias: {
          "@": "./",
        },
      },
    ],
    "react-native-worklets/plugin",
  ];

  if (isProduction) {
    plugins.push([
      "transform-remove-console",
      { exclude: ["error"] },
    ]);
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
