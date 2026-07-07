Status: DONE_WITH_CONCERNS

Modified Files:
- note-viewer/src/server/services/readContent.ts
- note-viewer/src/server/services/readContent.test.ts
- note-viewer/src/server/services/scanRepository.ts
- note-viewer/src/server/services/scanRepository.test.ts
- note-viewer/src/server/services/searchIndex.ts
- note-viewer/src/server/services/searchIndex.test.ts
- .superpowers/sdd/task-3-report.md

Commit:
- Pending at report write time

Command Results:
- `npm test -- src/server/services`
  - First red run failed because `readContent.ts`, `scanRepository.ts`, and `searchIndex.ts` did not exist yet.
  - Final run passed: 3 test files, 12 tests passed, exit code 0.
- `npm run typecheck`
  - Passed, exit code 0.

Self-Review:
- `readTextFile()` only serves markdown/text extensions and resolves paths through `resolveContentPath()` so client backslashes and out-of-root traversal stay rejected by existing safe-path rules.
- `getAssetInfo()` only exposes supported raster image types and explicitly rejects SVG preview.
- `scanTree()` uses `lstat()` before any path resolution, skips symlinks, re-checks resolved paths stay inside `contentRoot`, and filters ignored/unsupported/image entries.
- `buildPortalData()` only returns cards for known paths that actually exist in the scanned tree.
- `searchNotes()` supports blank-query fast return, matches names/paths, and reads markdown headings through `readTextFile()`.

Concerns:
- Windows cannot reliably host multiple files in one directory that differ only by case (`readme.md` vs `README.md`) on the default case-insensitive filesystem, so the overview-priority assertion was verified with a pure helper (`selectOverviewName`) instead of an on-disk integration case.
- Windows directory symlink creation may require elevated privileges; the symlink-skip test uses a junction to validate the same scanner behavior in this environment.

---

Fix Update (Task 3 review follow-up):

- Restricted `searchNotes()` matching scope to node names plus Markdown H1 / overview H1 content only. Removed `node.path` from the generic search haystack so parent directory names no longer cause file hits.
- Added directory overview search behavior: when a directory node has `overviewPath`, the overview file H1 is searched and matching results now point to the directory node `path` with `snippet` set to the overview file path.
- Kept file matching scoped to `node.name`, with Markdown files additionally matching their own H1.
- Updated `scanTree()` root naming so the root node uses `path.basename(CONTENT_ROOT)` instead of the hard-coded `笔记`.
- Expanded tests to cover:
  - parent directory name does not match child files;
  - directory overview H1 matches the directory result;
  - custom `CONTENT_ROOT` basename becomes the root node name.

Verification:

- `npm test -- src/server/services` -> passed (`3` files, `15` tests)
- `npm run typecheck` -> passed
