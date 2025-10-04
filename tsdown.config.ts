import { defineConfig } from 'tsdown';
import { baseConfig, mergeConfig } from '@tm/build-config';
import 'dotenv/config';

// Get all TM_PUBLIC_* env variables for build-time injection
const getBuildTimeEnvs = () => {
	const envs: Record<string, string> = {};

	// Inject package.json version at build time
	try {
		const packageJson = JSON.parse(
			require('fs').readFileSync('package.json', 'utf8')
		);
		envs['TM_PUBLIC_VERSION'] = packageJson.version || 'unknown';
	} catch (error) {
		console.warn('Could not read package.json version during build:', error);
		envs['TM_PUBLIC_VERSION'] = 'unknown';
	}

	// Debug logging for sensitive env vars
	const maskValue = (val: string | undefined, key: string) => {
		if (!val) return 'UNDEFINED';
		// Show more of BASE_DOMAIN to distinguish tux.tryhamster.com vs tryhamster.com
		if (key === 'TM_PUBLIC_BASE_DOMAIN') {
			if (val.length <= 10) return val; // Show short domains fully
			return `${val.slice(0, 20)}...${val.slice(-8)}`;
		}
		if (val.length <= 6) return '***';
		return `${val.slice(0, 3)}...${val.slice(-3)}`;
	};

	console.log('\n🔍 Build-time Environment Variables Debug:');
	console.log('NODE_ENV:', process.env.NODE_ENV);
	console.log('TM_PUBLIC_BASE_DOMAIN:', maskValue(process.env.TM_PUBLIC_BASE_DOMAIN, 'TM_PUBLIC_BASE_DOMAIN'));
	console.log('TM_PUBLIC_SUPABASE_URL:', maskValue(process.env.TM_PUBLIC_SUPABASE_URL, 'TM_PUBLIC_SUPABASE_URL'));
	console.log('TM_PUBLIC_SUPABASE_ANON_KEY:', maskValue(process.env.TM_PUBLIC_SUPABASE_ANON_KEY, 'TM_PUBLIC_SUPABASE_ANON_KEY'));

	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith('TM_PUBLIC_')) {
			// Return the actual value, not JSON.stringify'd
			envs[key] = value || '';
			console.log(`  ✓ ${key}: ${maskValue(value, key)}`);
		}
	}

	console.log('Total TM_PUBLIC_* vars found:', Object.keys(envs).filter(k => k.startsWith('TM_PUBLIC_')).length);
	console.log('');

	return envs;
};

export default defineConfig(
	mergeConfig(baseConfig, {
		entry: {
			'task-master': 'scripts/dev.js',
			'mcp-server': 'mcp-server/server.js'
		},
		outDir: 'dist',
		copy: ['assets'],
		ignoreWatch: ['node_modules', 'dist', 'tests', 'apps/extension'],
		// Bundle only our workspace packages, keep npm dependencies external
		noExternal: [/^@tm\//],
		env: getBuildTimeEnvs()
	})
);
