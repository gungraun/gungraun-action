# Project: gungraun-action

GitHub Action to install gungraun-runner and valgrind. Written in TypeScript,
built with @vercel/ncc, tested with Jest.

## Commands

- Build: `npm run build`
- Type-check: `npm run check`
- Test: `npm test`
- Coverage: `npm run test:coverage`

## Conventions

- TypeScript strict mode is enabled (`strict`, `strictNullChecks`,
  `noImplicitAny`, etc.)
- Source files are in `src/`, tests in `src/__tests__/`
- No comments in code unless explicitly requested
- Follow existing patterns for visitor pattern usage and package manager
  abstractions

## Local Rules

Load additional rules from `.opencode/AGENTS.md` for local, non-committed
behavioral settings. Use your Read tool to load it when relevant.
