const CircularDependencyPlugin = require("circular-dependency-plugin");
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');

const webpack = require("webpack");


const supportedLocales = require("./src/locales");
let codes = [];
for (const code in supportedLocales) {
	const locale = supportedLocales[code];
	codes.push(locale.fns.code);
}
process.env.VUE_APP_VERSION = require('./package.json').version

module.exports = {
	chainWebpack: config => {
		config.optimization.minimizer("terser").tap(args => {
			args[0].terserOptions.output = {
				...args[0].terserOptions.output,
				comments: false, // exclude all comments from output
				ascii_only: true
			};
			return args;
		});
	},
	pluginOptions: {
		webpackBundleAnalyzer: {
			analyzerMode: process.env.VUE_APP_MODE === "production" ? "disabled" : "static",
			// openAnalyzer: process.env.VUE_APP_MODE === "production" ? false : true,
			openAnalyzer: false,
		},
		i18n: {
			locale: "en",
			fallbackLocale: "en",
			localeDir: "locales",
			enableInSFC: true,
		},
	},
	configureWebpack: {
		plugins: [
			new webpack.ContextReplacementPlugin(
				/date\-fns[\/\\]/,
				new RegExp(`[/\\\\\](${codes.join("|")})[/\\\\\]index\.js$`)
			),
			new CircularDependencyPlugin({
				exclude: /a\.js|node_modules/,
				failOnError: true,
				allowAsyncCycles: false,
				cwd: process.cwd(),
			}),
			new ReplaceInFileWebpackPlugin([{
				dir: 'dist/static/img',
				files: ['sheet.json', 'sheet_holiday.json'],
				rules: [
				{
					search: '"image": "sheet.png"',
					replace: '"image": "sheet.png?v=' + process.env.VUE_APP_VERSION + '"'
				},
				{
					search: '"image": "characters.png"',
					replace: '"image": "characters.png?v=' + process.env.VUE_APP_VERSION + '"'
				},
				{
					search: '"image": "mall.png"',
					replace: '"image": "mall.png?v=' + process.env.VUE_APP_VERSION + '"'
				},
				{
					search: '"image": "sheet_holiday.png"',
					replace: '"image": "sheet_holiday.png?v=' + process.env.VUE_APP_VERSION + '"'
				}]
			}])
		],
	},
	publicPath: "/",
	outputDir: "dist",
	runtimeCompiler: true,
	assetsDir: "static",
	productionSourceMap: false,
};
