# Changelog

## [0.9.30] - 2025-03-28
### Added
- Implemented full PRD generation workflow (contributed by [@ZyraV23](https://x.com/ZyraV23))
  - `ideate` command to transform raw ideas into structured concepts
  - `round-table` command to simulate expert discussions and generate insights
  - `refine-concept` command to improve concepts based on expert feedback
  - `generate-prd-file` command to create formal PRD documents
  - Support for various output formats and customization options
  - Detailed documentation and examples for Windows and Linux users
- Added `callAnthropicApi` function to support streaming API responses for concept generation
- Created comprehensive troubleshooting guide for PowerShell users
- Added interactive mode options for all PRD generation commands
- Updated README with step-by-step guides for PRD workflow

### Fixed
- Resolved PowerShell compatibility issues with long command lines using batch file approach
- Fixed API connectivity error handling for Anthropic API calls

## [0.9.29] - 2025-03-15 