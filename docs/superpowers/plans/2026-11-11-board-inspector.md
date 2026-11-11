# Approved board and inspector implementation

Design: implement the approved graphite/lavender mockup. Search belongs under board views; one notification destination in the sidebar; account anchored at sidebar bottom without divider. Inspector has Result, Brief and History tabs, version-specific files and discussion, comparison, and sticky current-submission actions. Existing permissions and optimistic task version checks remain intact.

- [x] Move account and notifications, relocate search and include task IDs in search.
- [x] Replace duplicate inspector sections with version selection, media, discussion, brief and history.
- [x] Verify navigation, filtering, comments, checks, version selection and review actions in both themes and mobile layout.
- [ ] Run lint, typecheck, unit/browser tests and both builds; publish and verify GitHub Pages.
