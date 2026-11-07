# Design workflow

**Figma file:** https://www.figma.com/design/eQb0odQV1cuzZn1kdQjwgs

Everything in the file is editable layers (no screenshots):

| Page | What's there |
| --- | --- |
| **Screens** | `Web · Checker`, `Extension · Review panel`, `Extension · Popup`, `CLI · rbys` |
| **Components** | `Button` (Primary / Ghost), `Verdict` (High / Medium / Low), `Flag` (Danger / Warning / Info) |

Colors are Figma **variables** in the `RBYS Theme` collection (`color/bg`,
`color/danger`, ...). Each variable's description names the CSS variable it
maps to. Change a variable and every screen and component using it updates.

## Change colors (fastest path)

1. In Figma: right sidebar (nothing selected) → **Local variables** → `RBYS Theme`.
   Change any color.
2. Copy the new hex into `design/tokens.json` (same name, e.g. `"danger"`).
3. Apply it to the web app, the extension and the CLI at once:

   ```bash
   node design/apply-tokens.mjs --check   # preview
   node design/apply-tokens.mjs           # apply
   ```

4. Reload: the web app hot-reloads; for the extension, copy the folder to
   Windows again and click reload on `chrome://extensions`.

## Change layout, spacing, text, components

Edit the screens/components in Figma, then ask Claude Code (with the Figma
connector on) something like:

> Sync the UI from the Figma file https://www.figma.com/design/eQb0odQV1cuzZn1kdQjwgs — I changed the review panel.

It reads the frames you changed and updates `app/src/app/globals.css`,
`app/src/components/*`, `extension/bridge.js`, `extension/popup.html` or
`app/src/cli.ts` to match. Mention which screen you changed to keep it focused.

## Where each screen lives in code

| Figma | Code |
| --- | --- |
| Web · Checker | `app/src/app/page.tsx`, `app/src/components/Report.tsx`, `app/src/app/globals.css` |
| Extension · Review panel | `extension/bridge.js` (the `CSS` string and `openPanel`) |
| Extension · Popup | `extension/popup.html` |
| CLI · rbys | `app/src/cli.ts` (`THEME`, `render`) |
| Verdict / Flag / Button | `.verdict`, `.flag`, `.btn-primary` / `.btn-ghost` in `globals.css`; same names in `bridge.js` |

Fonts: Inter (UI) and JetBrains Mono (code/CLI). The gradient (`accent-a →
accent-b → accent-c`) is a fixed paint in Figma; its colors follow the three
accent tokens.
