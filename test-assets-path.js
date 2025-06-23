import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Test from project root ===');
console.log('__filename:', __filename);
console.log('__dirname:', __dirname);

// This is how convertAllRulesToProfileRules constructs assetsDir for simple profiles
const assetsDir = path.join(__dirname, '..', '..', 'assets');
console.log('Constructed assetsDir:', assetsDir);
console.log('Assets dir exists?', fs.existsSync(assetsDir));

console.log('\n=== Simulating from src/utils/rule-transformer.js ===');
// Simulate being in src/utils/rule-transformer.js location
const utilsDir = path.join(__dirname, 'src', 'utils');
const simulatedAssetsDir = path.join(utilsDir, '..', '..', 'assets');
console.log('Simulated __dirname (src/utils):', utilsDir);
console.log('Simulated assetsDir:', simulatedAssetsDir);
console.log('Simulated assets dir exists?', fs.existsSync(simulatedAssetsDir));

if (fs.existsSync(simulatedAssetsDir)) {
	console.log(
		'Contents of simulated assets dir:',
		fs.readdirSync(simulatedAssetsDir)
	);

	const claudeDir = path.join(simulatedAssetsDir, 'claude');
	console.log('Claude dir path:', claudeDir);
	console.log('Claude dir exists?', fs.existsSync(claudeDir));

	if (fs.existsSync(claudeDir)) {
		console.log('Contents of claude dir:', fs.readdirSync(claudeDir));
	}
}

// This is how the CLI constructs assetsDir
const cliAssetsDir = path.join(process.cwd(), 'assets');
console.log('\nCLI assetsDir:', cliAssetsDir);
console.log('CLI assets dir exists?', fs.existsSync(cliAssetsDir));

console.log('\nCurrent working directory:', process.cwd());
