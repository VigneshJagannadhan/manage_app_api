# Agent Rules - Code Standards

This file is a living document. It will be updated during development as new
standards and conventions are agreed upon. Keep it open to editing.

> Note: `AGENTS.md` does not exist in this repo. Until it does, this file
> (`agent-rules-code-standards.md`) is the standards reference for this
> project - reconcile the two if/when `AGENTS.md` is added.

---

## 1. Coding Best Practices

Follow all standard coding best practices strictly, including:

- **SOLID**
  - Single Responsibility - a module/function/class should have one reason to change.
  - Open/Closed - extend behaviour without modifying existing working code.
  - Liskov Substitution - subtypes must be usable wherever the base type is expected.
  - Interface Segregation - don't force classes to depend on methods they don't use.
  - Dependency Inversion - depend on abstractions, not concrete implementations.
- **DRY** (Don't Repeat Yourself) - no duplicated logic 
- **KISS** (Keep It Simple, Stupid) - prefer the simplest solution that works.
- **YAGNI** (You Aren't Gonna Need It) - don't build for hypothetical future requirements.

Flag any violation of these principles found during evaluations, with a suggested fix.

---

## 2. Structure & Naming

Flag any of the following if seen during evaluations, even if unrelated to the
current ticket:

- Folder structure issues - code in the wrong layer (`src/routes`, `src/controllers`,
  `src/middleware`, `src/models`, `src/utils`, `src/config`) or business logic
  leaking into a layer that shouldn't own it (e.g. DB queries in a route file,
  request/response handling in a model).
- Naming issues - files, classes, variables, methods not following consistent
  conventions (e.g. `*.controller.ts`, `*.routes.ts`, `*.model.ts`, `*.middleware.ts`).
- Anything unusual, inconsistent, or out of place vs. the rest of the codebase.