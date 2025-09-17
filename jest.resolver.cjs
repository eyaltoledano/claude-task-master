const { defaultResolver } = require('jest-resolve');
module.exports = function customResolver(request, options) {
	const resolve = options.defaultResolver || defaultResolver;

	try {
		return resolve(request, options);
	} catch (error) {
		if (request.startsWith('.') && request.endsWith('.js')) {
			try {
				return resolve(request.replace(/\.js$/, '.ts'), options);
			} catch (tsError) {
				tsError.cause = tsError.cause ?? error;
				throw tsError;
			}
		}

		throw error;
	}
};
