const appJson = require("./app.json");

module.exports = ({ config }) => {
	return { ...config, plugins: config.plugins || appJson.expo.plugins };
};
