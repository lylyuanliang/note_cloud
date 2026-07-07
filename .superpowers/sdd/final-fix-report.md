## 2026-07-07 final review fix

- Scope: fixed the final reviewer Important finding in `note-viewer/src/server/services/readContent.ts` and handled the first Minor about canonical response paths.
- `readRepoReadme()` now resolves `repoRoot` with `realpath`, rejects `README.md` symlinks via `lstat`, requires a regular file, resolves the README real path, and returns `undefined` for missing or invalid/out-of-root cases without reading external content.
- `readTextFile()` now uses a canonical POSIX-safe relative path for the response `path`, `name`, and language detection while preserving the existing backslash rejection rules.
- Added regression coverage for canonical response paths and for refusing an escaping repo-root README symlink case.

Verification:

- `npm test -- src/server/services/readContent.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run build`

Notes:

- `npm run build` still prints the pre-existing Vite warning about `/index.html` referencing `./runtime-config.js` without `type="module"`, but the build exits successfully.
