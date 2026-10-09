const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
console.log("[Hermes] Invoked with args:", args.join(" "));

const hermesExe = path.resolve(
	__dirname,
	"../node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe"
);

if (fs.existsSync(hermesExe)) {
	const result = spawnSync(hermesExe, args, { stdio: "inherit" });
	process.exit(result.status ?? 0);
} else {
	console.error("[Hermes] hermesc.exe not found at:", hermesExe);
	process.exit(1);
}
