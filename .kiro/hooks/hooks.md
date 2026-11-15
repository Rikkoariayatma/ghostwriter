# Kiro hooks

Kiro hooks automate small workflows when files change. These hooks are
declared here so the Kiro IDE/CLI picks them up when the project is
opened in Kiro.

## hooks.json
```json
{
  "version": 1,
  "hooks": [
    {
      "name": "run-tests-on-save",
      "trigger": { "type": "fileSaved", "pattern": "js/**/*.js" },
      "action": { "type": "runCommand", "command": "node tests/crypto.test.mjs" },
      "description": "Re-run the property-style crypto tests whenever app JS changes."
    },
    {
      "name": "lint-check-on-save",
      "trigger": { "type": "fileSaved", "pattern": "**/*.js" },
      "action": { "type": "runCommand", "command": "node --check js/app.js && node --check js/crypto.js && node --check js/store.js && node --check js/reveal.js" },
      "description": "Syntax-check all app modules on save."
    }
  ]
}
```

> Note: hook schema follows the Kiro hooks format as documented at
> kiro.dev (hooks are JSON config under `.kiro/hooks/`). If the Kiro
> version installed reports a schema difference, update this file to
> match the installed version and note the change in KIRO_SESSIONS.md.
