# Task 2 Report

**Status:** DONE

**Modified files:**
- `note-viewer/src/server/config.ts`
- `note-viewer/src/server/index.ts`
- `note-viewer/src/server/security/safePath.ts`
- `note-viewer/src/server/security/safePath.test.ts`

**Commit:**
- `b6e8ed2` - `feat: add viewer path safety`

**Command results:**
- `npm test -- src/server/security/safePath.test.ts` - PASS
- `npm run typecheck` - PASS

**Self-review:**
- `getConfig()` now centralizes server config loading and normalizes `publicBasePath` to a leading/trailing slash form.
- `safePath.ts` now handles POSIX normalization, ignores unsafe path segments, rejects absolute paths and NUL bytes, and resolves paths through `realpath()` so symlink escapes are detected.
- `index.ts` now consumes the shared config object instead of reading environment variables inline, and `/api/health` plus `/runtime-config.js` both reflect the normalized base path.
- I did not change `note-viewer/src/shared/types.ts` because the existing `ViewerConfig` and runtime config shape already matched the brief.

**Concerns:**
- `resolveContentPath()` assumes `contentRoot` exists; if deployment starts without that directory, it will fail fast when resolving paths. That matches the current safety-first behavior, but startup validation may still be worth adding in a later task.

---

## Fix Follow-up

**Status:** DONE

**Changed files:**
- `note-viewer/src/server/security/safePath.ts`
- `note-viewer/src/server/security/safePath.test.ts`

**Fix summary:**
- `decodeClientPath()` now rejects client-supplied paths containing `\` before any normalization.
- `toPosixPath()` remains available for internal normalization and ignored-path checks, but it is no longer used to sanitize raw client input in `decodeClientPath()`.
- Added a regression test covering `resolveContentPath("学习记录\\readme.md", config)` and asserting the error mentions POSIX or 反斜杠.

**Verification:**
- `npm test -- src/server/security/safePath.test.ts` - PASS
- `npm run typecheck` - PASS

**Concerns:**
- None beyond the pre-existing `contentRoot` existence assumption noted above.
