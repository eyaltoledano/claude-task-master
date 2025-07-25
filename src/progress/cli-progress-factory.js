import cliProgress from 'cli-progress';

export function newSingle(opts = {}) {
	return new cliProgress.SingleBar(
		{
			clearOnComplete: false,
			stopOnComplete: true,
			hideCursor: true,
			barsize: 40,
			...opts
		},
		cliProgress.Presets.shades_classic
	);
}

export function newMultiBar(opts = {}) {
	return new cliProgress.MultiBar(
		{
			clearOnComplete: false,
			stopOnComplete: true,
			hideCursor: true,
			barsize: 40,
			...opts
		},
		cliProgress.Presets.shades_classic
	);
}
