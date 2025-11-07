import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { BaseAIProvider } from './base-provider.js';

export class BedrockAIProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'Bedrock';
	}

	isRequiredApiKey() {
		return false;
	}

	/**
	 * Returns the required API key environment variable name for Bedrock.
	 * Bedrock uses AWS credentials, so we return the AWS access key identifier.
	 * @returns {string} The environment variable name
	 */
	getRequiredApiKeyName() {
		return 'AWS_ACCESS_KEY_ID';
	}

	/**
	 * Override auth validation - Bedrock uses AWS credentials instead of API keys
	 * @param {object} params - Parameters to validate
	 */
	validateAuth(params) {}

	/**
	 * Creates and returns a Bedrock client instance.
	 * See https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html
	 * for AWS SDK environment variables and configuration options.
	 */
	getClient(params) {
		try {
			const credentialProvider = fromNodeProviderChain();

			return createAmazonBedrock({
				credentialProvider,
				fetch: this.createProxyFetch()
			});
		} catch (error) {
			this.handleError('client initialization', error);
		}
	}
}
