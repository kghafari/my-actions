# Copilot Instructions

## Overview

This repository contains multiple GitHub Actions built using Node.js, TypeScript, and Webpack. Each action is modular and supports logic split across multiple files.

## Directory Structure

- `src/action-one/`: Contains the implementation for Action One.
  - `index.ts`: Entry point for Action One.
  - `utils.ts`: Utility functions for Action One.
  - `action.yml`: Metadata for Action One.
- `src/action-two/`: Contains the implementation for Action Two.
  - `index.ts`: Entry point for Action Two.
  - `utils.ts`: Utility functions for Action Two.
  - `action.yml`: Metadata for Action Two.

## Adding a New Action

1. Create a new folder under `src/` with a descriptive name for the action.
2. Add the following files:
   - `index.ts`: The entry point for the action.
   - `utils.ts`: (Optional) Utility functions for the action.
   - `action.yml`: Metadata file defining inputs, outputs, and entry point.
3. Implement the action logic in `index.ts` and split reusable logic into `utils.ts`.
4. Update Webpack configuration to include the new action.

## Building the Actions

1. Run `npm run build` to compile TypeScript files and bundle them using Webpack.
2. The output will be placed in the `dist/` directory, with separate bundles for each action.

## Testing the Actions

1. Use the `act` CLI or create a test workflow in `.github/workflows/` to test the actions locally or on GitHub.

## Best Practices

- Keep the logic modular by splitting reusable code into utility files.
- Use TypeScript for type safety and better maintainability.
- Follow GitHub's security best practices for actions.
- Run terminal commands one by one

## References

- [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- [Creating a JavaScript Action](https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-javascript-action)
