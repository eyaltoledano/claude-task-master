#!/usr/bin/env node

/**
 * Task Master
 * Copyright (c) 2025 Eyal Toledano, Ralph Khreish
 *
 * This software is licensed under the MIT License with Commons Clause.
 * You may use this software for any purpose, including commercial applications,
 * and modify and redistribute it freely, subject to the following restrictions:
 *
 * 1. You may not sell this software or offer it as a service.
 * 2. The origin of this software must not be misrepresented.
 * 3. Altered source versions must be plainly marked as such.
 *
 * For the full license text, see the LICENSE file in the root directory.
 */

/**
 * Claude Task Master CLI
 * Main entry point for globally installed package
 */

// Direct imports instead of spawning child processes
import { runCLI } from '../scripts/modules/commands.js';

// Simply run the CLI directly
runCLI();
