# Jev Field Lab

A native AEM Edge Delivery site about bounded model judgments, deterministic operations, and inspectable evidence. DA owns pages and public datasets; this repository owns presentation and the read-only experiment controller.

- [Preview](https://main--da-jev--somarc.aem.page/)
- [Live](https://main--da-jev--somarc.aem.live/)
- [Visual direction](DIRECTION.md)
- [Authoring contracts](docs/authoring.md)
- [Repeatable evaluation loop](docs/evaluation-loop.md)

## Development

```sh
npm ci
npm run lint
npm test
npx -y @adobe/aem-cli up
```

Use local code with previewed DA content. Inspect the actual `.plain.html` markup before changing a block. There is no build step or runtime framework; dependencies are development-only. Do not modify the vendored `scripts/aem.js`.

The `trace-hero`, `trace-path`, `metric-strip`, `experiment-list`, `case-explorer`, `measurement-chart`, `evidence-table`, `callout`, and `accordion` blocks use authored rows. Interactive viewers fetch bounded, complete, same-origin `/data/*.json` records and retain the source link on failure. A visitor interaction never invokes a model or a CLI command.

Styles use explicit cascade layers, scoped block selectors, intrinsic/container layouts, and self-hosted Archivo Black, Instrument Sans, and Roboto Mono. Font licenses are retained in `fonts/licenses/`.

## Bounded controller

`tools/lab/read-only-probe.mjs` is a small experiment runner, not a general agent or production authorization system. It offers four code-owned read capabilities and `none`, for a fixed site and two allowlisted source paths. It checks source/descriptor identity, target resolution, a short-lived preparation, answer shape, and operation-specific results. It never executes model-supplied arguments or `next[]`.

Supply your own current CLI checkout, branch, exact model version, and an **external** evidence directory. Keep operational evidence and authored content outside this Git checkout.

A checkout must be its own Git root. An ancestor repository (for example Homebrew
above a global npm install) is not the CLI's source identity. For an installed
release, first verify the registry tarball integrity and compare every packaged
file with the installation. Retain an external binding with `package`, `version`,
`releaseGitHead`, `tarballIntegrity`, and the complete `manifest` of
`{path, sha256}` entries. Pass that reviewed binding and its separately retained
`digest()` value using `--package-binding` and `--package-digest` during preparation.
The runner rechecks the complete first-party file set and bytes before dispatch.
Dependency bytes, registry signatures and OS isolation are outside this binding;
the binding does not independently authenticate the operator's provenance claim.

```sh
node tools/lab/read-only-probe.mjs prepare \
  --cli-root "$DA_CLI_ROOT" --branch "$BRANCH" \
  --path /how-it-works.html --model "$JEV_MODEL" \
  > "$PROOF_DIR/preparation.json"

node tools/lab/read-only-probe.mjs run \
  --prepared "$PROOF_DIR/preparation.json" \
  --response "$PROOF_DIR/response.json" \
  --digest "$SEPARATELY_RETAINED_PREPARATION_DIGEST" \
  > "$PROOF_DIR/run.json"
```

The retained digest must come from trusted preparation, not from a model or a subsequently edited input file. Model responses are advisory and passed across an operator-mediated credential broker boundary; credentials do not belong in this repository or command arguments. The runner does not make the model request itself.

Several single-objective API responses may be composed into the five-answer runner
input. Retain each original request, response, ID and digest separately, and label
the combined input as a local composition, not a single API response. The runner
validates the selected action interface; it does not authenticate model provenance
or establish task-level acceptance.

Every operational DA invocation uses explicit `--qmd`. Metadata help may intentionally bypass operational journaling. Primary and receipt outcomes are separate, partial evidence is retained, and completed operations are not replayed to repair receipts. CLI process wall times include their QMD work; they are not end-to-end agent timings.

**A valid operation is not necessarily the right task.** The published experiment retains routing disagreements, a high-confidence misroute, and a post-hoc refinement that did not improve exact-label agreement. Public records are in DA, not test fixtures in Git.

`tools/lab/**` is excluded from EDS delivery by `.hlxignore`. Source and tests remain inspectable in GitHub.

## Release boundary

Code merges to `main` ship independently of DA content. Preview and live publication are distinct operations. Verify code, authored source, delivered data, rendered pages, and receipt states before release. Never treat a model's confidence or a successful process exit as publication authority.
