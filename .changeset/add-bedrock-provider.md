---
"task-master-ai": minor
---

Add AWS Bedrock provider support with comprehensive testing and integration

- Added new AWS Bedrock provider with support for Claude models via AWS Bedrock service
- Integrated Bedrock provider into unified AI services layer with proper authentication 
- Added comprehensive test coverage for all Bedrock provider functions
- Updated configuration management to handle AWS credentials (access key, secret key, region)
- Added support for multiple AWS authentication methods including credential providers
- Enhanced unified AI services to properly handle Bedrock-specific parameters
- Installed @ai-sdk/amazon-bedrock dependency for AWS Bedrock integration 