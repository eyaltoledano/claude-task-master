/**
 * @fileoverview Path constants for Task Master Core
 * Defines all file paths and directory structure constants
 */

// .taskmaster directory structure paths
export const TASKMASTER_DIR = '.taskmaster';
export const TASKMASTER_TASKS_DIR = '.taskmaster/tasks';
export const TASKMASTER_DOCS_DIR = '.taskmaster/docs';
export const TASKMASTER_REPORTS_DIR = '.taskmaster/reports';
export const TASKMASTER_TEMPLATES_DIR = '.taskmaster/templates';

// Task Master configuration files
export const TASKMASTER_CONFIG_FILE = '.taskmaster/config.json';
export const TASKMASTER_STATE_FILE = '.taskmaster/state.json';
export const LEGACY_CONFIG_FILE = '.taskmasterconfig';

// Task Master report files
export const COMPLEXITY_REPORT_FILE =
	'.taskmaster/reports/task-complexity-report.json';
export const LEGACY_COMPLEXITY_REPORT_FILE =
	'scripts/task-complexity-report.json';

// Task Master PRD file paths
export const PRD_FILE = '.taskmaster/docs/prd.txt';
export const LEGACY_PRD_FILE = 'scripts/prd.txt';

// Task Master template files
export const EXAMPLE_PRD_FILE = '.taskmaster/templates/example_prd.txt';
export const LEGACY_EXAMPLE_PRD_FILE = 'scripts/example_prd.txt';

// Task Master task file paths
export const TASKMASTER_TASKS_FILE = '.taskmaster/tasks/tasks.json';
export const LEGACY_TASKS_FILE = 'tasks/tasks.json';

// General project files (not Task Master specific but commonly used)
export const ENV_EXAMPLE_FILE = '.env.example';
export const GITIGNORE_FILE = '.gitignore';

// Task file naming pattern
export const TASK_FILE_PREFIX = 'task_';
export const TASK_FILE_EXTENSION = '.txt';

/**
 * Task Master specific markers (absolute highest priority)
 * ONLY truly Task Master-specific markers that uniquely identify a Task Master project
 */
export const TASKMASTER_PROJECT_MARKERS = [
	'.taskmaster', // Task Master directory
	TASKMASTER_CONFIG_FILE, // .taskmaster/config.json
	TASKMASTER_TASKS_FILE, // .taskmaster/tasks/tasks.json
	LEGACY_CONFIG_FILE // .taskmasterconfig (legacy but still Task Master-specific)
] as const;

/**
 * Project boundary markers - these indicate a project root and STOP upward traversal
 * during Task Master marker search. If we hit one of these without finding .taskmaster,
 * we shouldn't traverse beyond it (prevents finding .taskmaster in home directory).
 *
 * Ordered by reliability: VCS markers first, then platform-specific, then language-specific
 */
export const PROJECT_BOUNDARY_MARKERS = [
	// Version control (strongest indicators)
	'.git', // Git repository
	'.svn', // SVN repository
	'.hg', // Mercurial repository
	'.fossil', // Fossil repository
	// CI/CD and platform-specific directories (typically at project root)
	'.github', // GitHub Actions, configs
	'.gitlab', // GitLab CI configs
	'.circleci', // CircleCI configs
	'.travis.yml', // Travis CI config
	'.jenkins', // Jenkins configs
	'.buildkite', // Buildkite configs
	// Editor/IDE project markers (typically at project root)
	'.vscode', // VS Code workspace settings
	'.idea', // JetBrains IDE settings
	'.project', // Eclipse project
	'.devcontainer', // Dev containers config
	// Package manager lock files (strong indicators of project root)
	'package-lock.json', // npm
	'yarn.lock', // Yarn
	'pnpm-lock.yaml', // pnpm
	'bun.lockb', // Bun
	'bun.lock', // Bun (text format)
	'deno.lock', // Deno
	'deno.json', // Deno config
	'deno.jsonc', // Deno config (with comments)
	// Node.js/JavaScript project files
	'package.json', // Node.js project
	'lerna.json', // Lerna monorepo
	'nx.json', // Nx monorepo
	'turbo.json', // Turborepo
	'rush.json', // Rush monorepo
	'pnpm-workspace.yaml', // pnpm workspace
	// Rust project files
	'Cargo.toml', // Rust project
	'Cargo.lock', // Rust lock file
	// Go project files
	'go.mod', // Go project
	'go.sum', // Go checksum file
	'go.work', // Go workspace
	// Python project files
	'pyproject.toml', // Python project (modern)
	'setup.py', // Python project (legacy)
	'setup.cfg', // Python setup config
	'poetry.lock', // Poetry lock file
	'Pipfile', // Pipenv
	'Pipfile.lock', // Pipenv lock file
	'uv.lock', // uv lock file
	// Ruby project files
	'Gemfile', // Ruby project
	'Gemfile.lock', // Ruby lock file
	// PHP project files
	'composer.json', // PHP project
	'composer.lock', // PHP lock file
	// Java/JVM project files
	'build.gradle', // Gradle (Java/Kotlin)
	'build.gradle.kts', // Gradle Kotlin DSL
	'settings.gradle', // Gradle settings
	'settings.gradle.kts', // Gradle settings (Kotlin)
	'pom.xml', // Maven (Java)
	'build.sbt', // sbt (Scala)
	'project.clj', // Leiningen (Clojure)
	'deps.edn', // Clojure deps
	// Elixir/Erlang project files
	'mix.exs', // Elixir project
	'rebar.config', // Erlang rebar
	// Other language project files
	'pubspec.yaml', // Dart/Flutter project
	'Package.swift', // Swift package
	'CMakeLists.txt', // CMake project
	'Makefile', // Generic project indicator
	'meson.build', // Meson build system
	'BUILD.bazel', // Bazel build
	'WORKSPACE', // Bazel workspace
	'flake.nix', // Nix flake
	'shell.nix', // Nix shell
	'default.nix', // Nix expression
	// Container/deployment files (typically at project root)
	'Dockerfile', // Docker
	'docker-compose.yml', // Docker Compose
	'docker-compose.yaml', // Docker Compose
	'Containerfile', // Podman/OCI container
	'kubernetes.yml', // Kubernetes manifests
	'kubernetes.yaml', // Kubernetes manifests
	'helm/Chart.yaml' // Helm chart
] as const;

/**
 * Other project markers (only checked if no Task Master markers found)
 * Includes generic task files that could belong to any task runner/build system
 */
export const OTHER_PROJECT_MARKERS = [
	LEGACY_TASKS_FILE, // tasks/tasks.json (NOT Task Master-specific)
	'tasks.json', // Generic tasks file (NOT Task Master-specific)
	...PROJECT_BOUNDARY_MARKERS, // Include all boundary markers
	'requirements.txt' // Python requirements (weaker indicator, keep separate)
] as const;

/**
 * All project markers combined (for backward compatibility)
 * @deprecated Use TASKMASTER_PROJECT_MARKERS and OTHER_PROJECT_MARKERS separately
 */
export const PROJECT_MARKERS = [
	...TASKMASTER_PROJECT_MARKERS,
	...OTHER_PROJECT_MARKERS
] as const;
