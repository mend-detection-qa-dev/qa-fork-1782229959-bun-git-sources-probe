# bun-git-sources-probe

A minimal Bun probe project for Mend SCA detection testing.
Exercises two git-source patterns in a single lockfile-based project.

## Pattern bundle

| # | Pattern | Manifest form | Package |
|---|---------|---------------|---------|
| 1 | `git-dependency` | `"is-odd": "git+https://github.com/jonschlinkert/is-odd.git#3.0.1"` | `is-odd@3.0.1` |
| 2 | `github-shorthand` | `"is-even": "github:jonschlinkert/is-even#1.0.0"` | `is-even@1.0.0` |

Both patterns are from `skills/bun-core/references/feature-coverage-patterns.md`.
This is Tier 2 entry #5 of `docs/BUN_COVERAGE_PLAN.md`.

## Why bundled

Both `git-dependency` and `github-shorthand` resolve to `source: "git"` in
the Mend dependency tree — they exercise the same detection code path.

The `github:user/repo` shorthand is pure syntactic sugar for the full
`git+https://github.com/user/repo.git` URL. Bun normalizes both to a `"git"`
descriptor block in `bun.lock` (with `url`, `ref`, and `sha` fields).
Mend must recognize both manifest-side forms and classify them identically.

Bundling the two forms into one probe concentrates the "git source mis-detection"
failure class into a single ReportPortal step, where side-by-side comparison
immediately reveals whether the failure is form-specific (shorthand only, or
full-URL only) or affects all git deps.

## Package selection rationale

| Package | Tag | Commit SHA | Role |
|---------|-----|-----------|------|
| `is-odd` | `3.0.1` | `a80ee0d831a8ee69f1fad5b4673491847975eb26` | Direct dep via full `git+https` URL. Has one production transitive (`is-number@^6.0.0`), exercising that Mend follows transitive edges out of git-sourced packages. |
| `is-even` | `1.0.0` | `a94a9be2783fdd77fa37195e4fabb22fc51e573e` | Direct dep via `github:` shorthand. Has one production transitive (`is-odd@^0.1.2`), resolved from npm registry — a distinct instance from the root git dep. |
| `is-number` | — | — | Transitive via `is-odd@3.0.1` (git). Registry-sourced (`^6.0.0` → `6.0.0`). No deps. |
| `is-odd@0.1.2` | — | — | Transitive via `is-even@1.0.0` (github-shorthand). Registry-sourced (`^0.1.2` → `0.1.2`). Distinct from root `is-odd@3.0.1`. |

Both upstream repos (`jonschlinkert/is-odd`, `jonschlinkert/is-even`) are
stable, permissively licensed (MIT), and publicly accessible on GitHub.
The referenced tags are immutable git refs — the commit SHAs recorded in
`bun.lock` will not change.

## Dependency graph

```
bun-git-sources-probe (root)
├── is-odd@3.0.1          [direct, source: git, full git+https URL]
│   └── is-number@6.0.0   [transitive, source: registry]
└── is-even@1.0.0         [direct, source: git, github: shorthand]
    └── is-odd@0.1.2      [transitive, source: registry — different instance]
```

Note: `is-odd@3.0.1` (git) and `is-odd@0.1.2` (registry) are tracked as
separate entries — same package name, different versions and sources.

## Mend config

No `.whitesource` emitted.

`js-bun` is NOT in Mend's `install-tool` list. Manual toolchain pinning via
`scanSettings.versioning` is not possible for the Bun ecosystem. The probe
ships no `.whitesource` file — doing so would have no effect on Bun-version
selection and would add noise without benefit.

Mend will fall back to its npm-resolver logic, treating `bun.lock` as a
JSONC file. The `"git"` descriptor block inside each package tuple is a
Bun-specific shape that does not appear in `package-lock.json`. Whether
Mend's parser reads and surfaces that block is the primary question this
probe answers.

This limitation is tracked in the feature-coverage catalog under
`edge-cases.md` ("Bun not in Mend's install-tool list").

## Source-type assertions

The primary assertion for this probe is that `source` equals `"git"` for
both direct dependencies, regardless of the manifest form used to declare them.

| Dep name | Manifest form | Expected `source` | Expected `source_detail` |
|----------|---------------|-------------------|--------------------------|
| `is-odd` | `git+https://github.com/jonschlinkert/is-odd.git#3.0.1` | `git` | `url: "https://github.com/jonschlinkert/is-odd.git"`, `tag: "3.0.1"`, `commit: "a80ee0d831a8ee69f1fad5b4673491847975eb26"` |
| `is-even` | `github:jonschlinkert/is-even#1.0.0` | `git` | `url: "https://github.com/jonschlinkert/is-even.git"`, `tag: "1.0.0"`, `commit: "a94a9be2783fdd77fa37195e4fabb22fc51e573e"` |
| `is-number` | (transitive registry) | `registry` | `registry: "https://registry.npmjs.org"` |
| `is-odd@0.1.2` | (transitive registry) | `registry` | `registry: "https://registry.npmjs.org"` |

Failure modes to watch for:

1. `is-even` reported as `source: "registry"` — Mend did not expand the
   `github:` shorthand before source classification.
2. `is-odd` reported as `source: "registry"` — Mend ignored the `git+https`
   protocol prefix and treated the dep as a registry ref.
3. Either dep missing entirely — Mend cannot parse the `"git"` descriptor
   block in `bun.lock` package tuples.
4. `is-number` missing — Mend does not walk transitive edges from git-sourced
   packages into registry packages.
5. Only one `is-odd` in the tree — the registry `is-odd@0.1.2` (transitive
   of `is-even`) was collapsed into the git-sourced `is-odd@3.0.1`.

## Resolver notes

The UA `javascript.md` resolver documents that the npm resolver has a
"version correction" path for `git/github references" that reads the actual
version from `node_modules/<pkg>/package.json`. Because Bun is NOT a
supported UA resolver, there is no `node_modules` directory in this probe —
the probe is lockfile-only. Mend must derive the version, URL, and commit
from the `bun.lock` `"git"` block, not from an installed directory. Whether
this static-parse path works is one of the key exploratory questions.

The `javascript.md` resolver does NOT mention Bun. All Bun-specific features
(`bun.lock` JSONC format, `"git"` descriptor tuples, `github:` shorthand
expansion) are outside the documented UA behavior. This probe targets exactly
that gap: both patterns are candidates for "Mend cannot detect this."

---

Tracked in: docs/BUN_COVERAGE_PLAN.md §11.2 entry #5
