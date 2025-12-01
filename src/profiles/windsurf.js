// Windsurf conversion profile for rule-transformer
import { COMMON_TOOL_MAPPINGS, createProfile } from './base-profile.js';

// Create and export windsurf profile using the base factory
export const windsurfProfile = createProfile({
	name: 'windsurf',
	displayName: 'Windsurf',
	url: 'windsurf.com',
	docsUrl: 'docs.windsurf.com'
});
