# iSAQB CPSA-F Mock Exam

A web-based practice exam for the **iSAQB Certified Professional for Software Architecture — Foundation Level (CPSA-F)**.

Questions are sourced from the [official iSAQB examination question catalog](https://github.com/isaqb-org/examination-foundation).

## Take the exam

You can take the exam [here](https://enyineer.github.io/isaqb-exam/). Please report any issues in this repositories issue tracker.

## Features

- 🎯 Pick & category question types with iSAQB scoring rules
- 🔀 Shuffled answer order per attempt to prevent pattern memorization
- ⏱️ Active time tracking (pauses when browser is closed)
- 💾 Auto-saves progress to localStorage — refresh without losing state
- 🚩 Flag questions for review — confirmation prompt before finishing with flagged questions
- 📝 Per-question notes for your lecturer — persisted and shown in results + print
- 🖨️ Print/export results for your lecturer (including notes)
- 🔵 Skipped vs wrong answer distinction in results (no penalty for skipped)
- 🌍 German & English
- 🎨 Multiple color themes + dark mode
- ⌨️ Full keyboard navigation
- 🔗 Hash-based routing — works on GitHub Pages without server config

## Tech Stack

React 19 · Vite · Tailwind CSS v4 · Bun · TypeScript · Wouter

## Getting Started

```bash
bun install
bun run dev
```

## Testing

```bash
bun test
```

## Disclaimer

This tool and its author are not affiliated with [iSAQB e.V.](https://www.isaqb.org/)
No guarantee is provided for the correctness of the questions or the test itself.

## License

[MIT](LICENSE.md)
