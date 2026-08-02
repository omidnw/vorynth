/**
 * Jest config for the Vorynth core engine.
 *
 * The engine sources are ESM (`"type": "module"`, NodeNext, `.js` import
 * extensions). ts-jest transforms them to CommonJS for the test runner; the
 * moduleNameMapper strips the `.js` suffix so Jest resolves `./x.js` → `./x.ts`.
 * `isolatedModules` skips per-file type diagnostics — type checking is a
 * separate `pnpm typecheck` step — which is what makes the `.js`→`.ts`
 * resolution safe at transform time (no TS2307 from node10 resolution).
 */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	transform: {
		"^.+\\.ts$": [
			"ts-jest",
			{
				tsconfig: {
					module: "CommonJS",
					moduleResolution: "Node",
					target: "ES2022",
					esModuleInterop: true,
					experimentalDecorators: true,
					emitDecoratorMetadata: true,
					useDefineForClassFields: false,
					isolatedModules: true,
				},
			},
		],
	},
	testMatch: ["<rootDir>/test/**/*.(spec|test).ts"],
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "/dist-bundle/"],
	clearMocks: true,
};
