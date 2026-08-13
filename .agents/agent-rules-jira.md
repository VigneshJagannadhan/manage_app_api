# Agent Rules: Jira Workflow

**Version:** 1.0
**Status:** Active
**Purpose:** How to handle Jira tickets from analysis through implementation and closure

---

## Trigger

These rules fire when the user says **"check <jira-ticket>"** where `<jira-ticket>` is:
- A Jira URL (e.g., `https://taskeasy2026.atlassian.net/browse/TAS-27`)
- A ticket key (e.g., `TAS-27`)
- A short ticket reference (e.g., `#27`)

---

## Step 1: Fetch and analyze the ticket

When triggered with a ticket reference:

1. **Fetch the ticket** using the Atlassian Jira API
   - Get summary, description, status, type, assignee, and linked issues
   - Understand the full context and acceptance criteria

2. **Read related context**
   - Check linked tickets for dependencies
   - Review comments if they contain critical implementation notes
   - Identify any blocking issues or prerequisites

3. **Understand the scope**
   - Break down the ticket into discrete, implementable tasks
   - Identify affected files, modules, or features
   - Note any relevant documentation or standards

---

## Step 2: Create an implementation plan

Based on the ticket analysis, create a detailed plan that includes:

**Plan structure:**
```
## Summary
[1-2 line summary of what needs to be done]

## Acceptance Criteria
- [ ] Criterion 1 (from ticket)
- [ ] Criterion 2 (from ticket)

## Implementation Tasks
1. Task 1 - [what will be changed]
   - Files affected: [list]
   - Type: feat/fix/refactor/etc (per conventional commits)

2. Task 2 - [what will be changed]
   - Files affected: [list]
   - Type: feat/fix/refactor/etc

[... more tasks ...]

## Testing Strategy
- [ ] How to verify each acceptance criterion
- [ ] Edge cases to test
- [ ] Any regression risks

## Git Flow
- **Branch name:** P#<ticket-number>/<kebab-case-summary>
- **Commits:** One commit per task (conventional commit format)
- **PR checklist:** [if applicable]
```

---

## Step 3: Present and await approval

Present the plan to the user in a clear format. Do NOT proceed to implementation until the user explicitly approves it.

**What to present:**
- Summary of the ticket
- The full implementation plan with all tasks
- Any risks or clarifications needed

**Wait for:**
- User approval: "Looks good" or "approved" → proceed
- Requests for changes: Modify the plan and re-present
- Rejection: Abandon the ticket and wait for next instruction

---

## Step 4: Implement after approval

Only after explicit approval:

1. **Create feature branch**
   ```
   git checkout main
   git pull origin main
   git checkout -b P#<ticket-number>/<kebab-case-summary>
   ```

2. **Implement tasks in order**
   - Work on one task at a time (in sequence from the plan)
   - After each task, commit with conventional commit format
   - Test the change locally if it's a feature/fix
   - Follow all code standards from `.agents/agent-rules-code-standards.md`

3. **Commit after each task** (per git flow rules)
   ```
   git add [specific files]
   git commit -m "type: short summary"
   ```
   - Use commit types from conventional commits
   - One atomic commit per task
   - No "Co-Authored-By" trailers
   - See `.agents/agent-rules-git-flow.md` for full commit rules

4. **After all tasks complete: Push and create PR**
   ```
   git push -u origin P#<ticket-number>/<kebab-case-summary>
   ```
   
   Then create a pull request to main:
   ```
   gh pr create --title "TAS-<number>: <summary>" \
     --body "## Summary\n...\n## Testing\n...\n## Related\n- Jira: TAS-<number>" \
     --base main
   ```
   - Title format: `TAS-<number>: <summary>`
   - Body includes: Summary, Changes, Testing, and Jira reference
   - Always target `main` branch

5. **Return to feature branch** (if needed)
   ```
   git checkout P#<ticket-number>/<kebab-case-summary>
   ```
   
   Or return to main after PR is created:
   ```
   git checkout main
   ```

6. **Report completion and next steps**
   - Link to the created PR
   - Suggest: await review, merge when approved, or transition Jira ticket
   - Optionally transition ticket to "In Review" in Jira

---

## Step 5: Transition ticket status (optional, on user request)

After PR is created and merged:

- **After PR merge:** Optionally transition ticket to "Done" in Jira
- **On user request:** Update ticket status at any point
- **Before merge:** Can transition to "In Review" to reflect review state

---

## Integration with existing rules

- **Code Standards:** Always follow `.agents/agent-rules-code-standards.md`
- **Git Flow:** Always follow `.agents/agent-rules-git-flow.md` for branch/commit/push

---

## Checklist for Agent

- [ ] Triggered by "check <ticket>" or equivalent
- [ ] Fetched ticket from Jira API
- [ ] Understood scope and acceptance criteria
- [ ] Created detailed implementation plan
- [ ] Presented plan clearly to user
- [ ] **Waited for explicit approval before proceeding**
- [ ] Created feature branch with correct naming
- [ ] Implemented tasks in order
- [ ] Committed after each task (conventional format)
- [ ] Pushed to feature branch
- [ ] Created PR to main with proper title and description
- [ ] Reported PR link to user
- [ ] Suggested next steps (merge, review, ticket transition)

---

## Example Usage

**User:** `check TAS-27`

**Agent:** [Fetches ticket, analyzes, creates plan]

**Agent output:**
```
## TAS-27: Monthly expense summary returns wrong totals for shared groups

**Summary:** Fix aggregation so group expense totals are scoped per-month
and per-member correctly

[... full plan presented ...]

Ready to proceed? Awaiting your approval.
```

**User:** `Looks good, go ahead`

**Agent:**
1. Creates branch `P#27/fix-monthly-expense-totals`
2. Implements changes
3. Commits: `fix: scope monthly expense totals per group member`
4. Pushes to remote: `git push -u origin P#27/fix-monthly-expense-totals`
5. Creates PR to main with proper title and body
6. Reports PR link: https://github.com/.../pull/7
7. Suggests: awaiting review and merge approval

---
