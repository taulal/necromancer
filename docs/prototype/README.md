# Prototype (NEC-02)

Source for the Necromancer UI design canvas (Claude). Taylor has the live, clickable version: 6 screens + the Ossuary tokens board.

These are `.dc.html` design-component files: plain HTML with inline styles plus a small logic class at the bottom. Read them for layout, spacing, copy, states and interactions. **Don't ship this markup.** Rebuild it in React with Sanity UI + the theme in `apps/app/src/theme/`.

| File                | Screen                                           | Brief    |
| ------------------- | ------------------------------------------------ | -------- |
| Main.dc.html        | Graveyard + Summon drawer                        | §8.1     |
| Exhume.dc.html      | Séance shell (header, stage nav) + Exhumation    | §8.2–8.3 |
| Autopsy.dc.html     | Autopsy board + type inspector + merge hint      | §8.4     |
| Interrogate.dc.html | Interrogation                                    | §8.5     |
| Ritual.dc.html      | Ritual list + human step-through                 | §8.6     |
| Rise.dc.html        | Before/after, redirect ledger, gates, Rise       | §8.7     |
| System.dc.html      | Ossuary tokens: colour, type, motion, components | §8       |

The séance header and stage nav are identical on every séance screen: build them once as a layout component. Mock data (harbourview-plumbing.co.nz) is fictional.
