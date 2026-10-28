# Gemini CLI SDK compatibility snapshot

`index.js` is generated from the published ESM build of
[`ai-sdk-provider-gemini-cli` 1.4.0](https://github.com/ben-vargas/ai-sdk-provider-gemini-cli).
Its only runtime change replaces the `@google/gemini-cli-core` barrel import with
`@google/gemini-cli-core/dist/src/core/contentGenerator.js`. That module exports
the same `AuthType`, `createContentGenerator`, and `createContentGeneratorConfig`
symbols used by the upstream SDK. The narrower import avoids loading unrelated
CLI tools whose transitive dependencies require newer Node.js APIs.

The upstream SDK's provider, authentication, streaming, and native structured
output implementation are otherwise unchanged. The original source map comment
is removed because its map does not describe this generated file. Normal Task
Master builds can generate their own source maps from this file.

The snapshot is checked in so development source modules work without a build,
loader hook, runtime compilation, or changes to `node_modules`. The ordinary
build bundles this local module into the published `dist` entry points. No
consumer install script is required.

`index.d.ts` re-exports the pinned upstream SDK's declarations for development.
This type-only bridge keeps TypeScript from inferring the generated JavaScript
and expanding Google core's internal configuration and CLI tool type graph.
The upstream SDK is a development dependency and is not imported at runtime.

To reproduce the snapshot and its unmodified upstream license after installing
development dependencies:

```sh
node scripts/generate-gemini-sdk-compat.mjs
node scripts/generate-gemini-sdk-compat.mjs --check
```

The generator requires upstream SDK version 1.4.0, verifies the published entry
point and license SHA-256 hashes, and asserts the exact three-symbol core import.
It changes only the import specifier and removes the obsolete source map comment,
then adds a provenance banner. `--check` verifies the checked-in files without
writing them and accepts Git's CRLF newline conversion on Windows. It never
edits the installed SDK.

The generated module imports `@ai-sdk/provider`, `@google/genai`, `zod`, and the
Google core deep entry point. It also preserves the upstream optional
`zod-to-json-schema` require fallback. These packages must be declared as direct
production dependencies rather than relying on npm dependency hoisting. Pin
`@google/gemini-cli-core` to 0.17.1 and `@google/genai` to 1.16.0, matching SDK
1.4.0. `crypto` is a Node.js built-in.

When upgrading, review the upstream SDK and Google core import graph, update the
generator's version and hashes, regenerate, and verify source and packed-package
behavior on Node.js 20.0 and a current Node.js release. The deep core path is an
internal upstream path, so a dependency upgrade needs an explicit review.

The upstream SDK is MIT licensed; its complete copyright and license notice are
in `LICENSE`. Keep that notice with distributed copies. The package build should
copy it to `dist/third-party-licenses/ai-sdk-provider-gemini-cli.LICENSE` so the
notice remains present when only `dist` is published.
