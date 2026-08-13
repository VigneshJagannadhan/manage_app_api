# Agent Rules: Git Flow

**Version:** 1.0
**Status:** Active
**Purpose:** How agents commit, branch, and push on this project

---

## Trigger

These rules only fire when the user says **"Let's push this change"** (or a clear
equivalent). Do not commit, branch, or push proactively - not after finishing an
implementation, not after the user says "looks good," and not because a plan was
approved. Wait for the explicit trigger phrase.

Giving a commit message on request (e.g. "commit message") is a text answer, not
an instruction to run `git commit`. Never commit as a side effect of being asked
what the message should be.

---

## Step 1: Classify the change

Look at the staged/unstaged diff (`git status`, `git diff`) and classify it as one
of the [Conventional Commits](https://www.conventionalcommits.org/) types:

| Type       | When                                                         |
|------------|--------------------------------------------------------------|
| `feat`     | New capability or behavior (new endpoint, field, flow)       |
| `fix`      | Bug fix                                                       |
| `perf`     | Performance improvement, no behavior change                  |
| `refactor` | Restructuring with no behavior change                        |
| `chore`    | Tooling, deps, config, CI - no app behavior change            |
| `docs`     | Documentation only                                            |
| `style`    | Formatting only, no logic change                              |
| `test`     | Test-only changes                                             |
| `build`    | Build system / dependency changes                             |
| `ci`       | CI pipeline changes                                            |

If the diff mixes types, classify by the dominant/primary intent of the change.

> This repo enforces the type via commitlint (`.husky/commit-msg`, config
> `@commitlint/config-conventional`) - a commit with an invalid type or malformed
> header will be **rejected by the git hook**. Get the type right the first time.
>
> The type also drives `semantic-release` on push to `main` (see
> `release.config.js`): `feat` → minor, `fix`/`perf`/`refactor` → patch,
> `chore`/`docs`/`style`/`test`/`build`/`ci` → no release. Note this repo's
> config deliberately maps breaking changes to a **minor** bump, not major -
> major bumps are done manually. Don't rely on a `!`/`BREAKING CHANGE` marker
> to trigger a major version.

---

## Step 2: Write the commit message

**Format:** `<type>: <short summary>`

```
feat: add monthly expense summary endpoint
fix: prevent duplicate membership rows on group join
refactor: extract token issuance out of auth controller
```

Rules:
- One line only. **No body, no description, no bullet points.**
- Lowercase summary, imperative mood, no trailing period.
- **Never** add a `Co-Authored-By: Claude` (or any AI attribution) trailer.
- Never add PR/task boilerplate ("Generated with...", tool links, etc).

---

## Step 3: Determine the branch name

Check whether the user's request references a ticket number (e.g. "P#1234",
"JIRA-1234", "#1234", or similar mentioned in conversation).

- **Ticket number present:** `P#<ticket-number>/<kebab-case-summary>`
  e.g. `P#1234/auto-scroll-on-keyboard-open`
- **No ticket number:** `P#0000/<kebab-case-summary>`
  e.g. `P#0000/auto-scroll-on-keyboard-open`

The `<kebab-case-summary>` is a short slug of the change (same intent as the
commit summary, kebab-cased).

---

## Step 4: Branch, commit, push

1. **Never commit directly to `main`.** If currently on `main`, pull latest first
   so the new branch starts from up-to-date code, then create and switch to the
   branch from Step 3:
   ```
   git pull origin main
   git checkout -b P#0000/auto-scroll-on-keyboard-open
   ```
2. Commit with the Step 2 message.
3. Push to remote (set upstream on first push):
   ```
   git push -u origin <branch-name>
   ```

If already on a non-`main` feature branch when triggered, commit and push to
that branch directly - don't create a new one unless the user asks.

---

## Step 5: Open a PR to main

After pushing, open a pull request into `main`:
```
gh pr create --base main --head <branch-name> --title "<commit message>" --body "<body>"
```
- Title: same as the Step 2 commit message.
- Body: one or two bullet points summarizing the change. If the branch has a
  real ticket number (not `P#0000`), reference it in the body.
- If a PR already exists for the branch (continuing prior work), skip this -
  just push, don't try to create a duplicate.
- Creation only - never merge the PR.

If the branch has a real ticket number (not `P#0000`), transition that ticket
to **Resolved** right after the PR is opened (look up the transition ID via
`getTransitionsForJiraIssue` rather than assuming it - transition IDs are
workflow-specific). Skip this for `P#0000` branches, since there's no ticket
to transition.

After opening the PR (and transitioning the ticket, if applicable), switch
back to `main`:
```
git checkout main
```

---

## Quick Checklist

- [ ] Triggered by "Let's push this change" (or equivalent), not inferred
- [ ] Change classified as feat/fix/refactor/chore/docs/style/test
- [ ] Commit message is `type: summary` only - no body, no Co-Authored-By
- [ ] Branch name is `P#<ticket>/<slug>` (ticket number if known, else `0000`)
- [ ] Pulled latest `main` before branching off it
- [ ] Never committed to `main`
- [ ] Pushed to remote after committing
- [ ] PR opened into `main` (skipped only if one already existed)
- [ ] Ticket transitioned to Resolved (skipped only for `P#0000` branches)
- [ ] Back on `main` after opening the PR
