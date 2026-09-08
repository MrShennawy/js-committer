# Committer

[![npm](https://badge.fury.io/js/@shennawy%2Fcommitter.svg)](http://badge.fury.io/js/@shennawy%2Fcommitter)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMrShennawy%2Fjs-committer.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2FMrShennawy%2Fjs-committer?ref=badge_shield&issueType=license)

__Committer__ is a package that streamlines the process of crafting standard Git commit messages, assisting developers in maintaining a consistent and clean commit history.

<p align="center">
  <img width="600" src="docs/assets/ai.svg">
</p>

## Table of Contents

1. [Installation](#installation)
2. [Features](#features)
3. [Usage](#usage)
4. [Configuration](#configuration)
5. [JIRA Integration](#jira-integration)
6. [AI-Powered Commit Messages](#ai-powered-commit-messages)
7. [Authors](#authors)
8. [Contributing](#contributing)
9. [License](#license)

## Installation
``` bash
    sudo npm i @shennawy/committer -g
```

## Features

- 📝 Standardized commit message formatting
- 🏷️ Automatic commit type detection, no type to pick
- 🔍 Interactive file selection for staged changes
- 🔄 Re-use last commit message
- 🏗️ Build integration support
- 🎯 JIRA integration, with the issue key read from your branch name
- 🚀 Streamlined git workflow
- 🤖 AI-powered commit message generation, set up in a single keystroke
- 🔑 Reads GEMINI_API_KEY / GOOGLE_API_KEY, and works fine without any key

## Usage

The package provides the `cmt` command with several powerful options:

### Basic Usage

```bash
    cmt # Start the interactive commit process
    cmt -s # Start commit process with file selection
    cmt -lc # Reuse the last commit message
    cmt -b # Run a build command first, then commit
    cmt -jr # Commit with JIRA integration
    cmt --no-ai # Write the message yourself this once
    cmt --setup # Connect the AI and Jira
    cmt --help # Show every option
```

The flags can be combined, for example `cmt -s -b -jr`.


## Configuration

The tool uses standard Git configuration and can be integrated with your existing Git workflow. For JIRA integration, ensure your credentials are properly configured.

## JIRA Integration

With the `-jr` flag, Committer attaches the issue to your commit and, after the
push, comments the commit link back on the issue.

### Choosing the issue without typing it

The issue key is looked for in this order, so most commits need one keystroke:

1. **Your branch name.** On `feature/SHEN-33-add-login` you are simply asked
   `Use SHEN-33 from your branch name?` and press Enter.
2. **Your own open issues.** If the branch says nothing, Committer lists the
   issues assigned to you with their summaries and you pick one from the list.
3. **Typing the key**, as a last resort.

### Connecting Jira

Credentials come from the first source that has them:

1. `JIRA_HOST`, `JIRA_EMAIL` and `JIRA_API_TOKEN` in the environment, best for
   CI and shared machines.
2. Credentials saved by a previous run.
3. A short walkthrough, run once, which is also available as `cmt --setup`.

The walkthrough asks as little as possible:

- **Address**: paste any Jira URL you have open, such as
  `https://acme.atlassian.net/browse/AB-1`. It is reduced to the bare host.
- **Email**: prefilled from your `git config user.email`, so it is usually
  just Enter.
- **Token**: offered straight from your clipboard when it is already there,
  otherwise Committer opens the Atlassian token page for you and reads the
  clipboard once you have copied it. Manual entry is hidden as you type.

The credentials are verified against Jira before they are saved, and a wrong
token lets you retry instead of throwing your input away. Jira is optional:
declining is remembered, and an unreachable Jira never blocks a commit, the
issue key is simply kept in the message.

## AI-Powered Commit Messages

Committer includes an advanced AI-powered commit message generation feature using Google's Generative AI (Gemini). This feature:

- 🧠 Automatically analyzes your code changes
- 🏷️ Picks the conventional commit type for you (`feat`, `fix`, `docs`, ...)
- 📝 Generates concise, professional commit messages
- 🔄 Integrates with JIRA summaries when available
- ✨ Follows commit message best practices

### Commit type detection

The commit type is no longer asked for. It is chosen in this order:

1. The AI reads the diff and picks the type together with the description
2. If the AI answers with a type outside the conventional list, the type is
   corrected while its wording is kept
3. If the AI is unavailable (no API key, no network), the type is worked out
   from the changed files: docs-only changes become `docs`, test-only changes
   `test`, dependency and build files `build`, a new file `feat`, and edits to
   existing files `fix`. A JIRA issue type, when available, wins over all of
   these

Whatever is chosen appears in the editable commit prompt, so you can always
change it before committing. Scopes and breaking-change markers are supported,
for example `feat(api)!: drop v1 endpoints`.

### Setup

The key is picked up from the first of these that exists, so most people never
type anything:

1. `GEMINI_API_KEY`, `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` in the
   environment. This is the best option for CI and shared machines, because the
   key never touches disk.
2. A key saved by a previous run, stored in `~/.committer-configuration` with
   owner-only permissions.
3. A short walkthrough, shown once.

The walkthrough is built around the fact that the key is already in your
clipboard the moment you create it:

```
 ❯ Found a key in your clipboard: AIzaSy••••••••••••1a2b. Use it? ( Yes / no )
```

One Enter and you are done. If the clipboard holds something else, you are
offered three choices: open the key page in your browser (it reads the
clipboard again once you have copied), paste a key by hand (hidden as you type),
or continue without AI. The key is verified against Google before it is saved,
so a wrong paste is reported immediately rather than halfway through a commit.

`cmt --setup` runs the walkthrough again at any time, and `cmt --set-key KEY`
stores a key without it.

### Working without AI

The AI is optional. Choosing "Continue without AI" is remembered, and Committer
then writes the message from the detected type with no further questions. The
same happens automatically when there is no network, when the key is rejected,
or when Committer runs without a terminal, such as in CI. It never blocks a
commit.

### Features
- Analyzes git diff to understand changes
- Incorporates JIRA summaries when available
- Generates context-aware commit messages
- Follows conventional commit format
- Limits messages to 10 words for conciseness

## Authors

- Mahmoud Shennawy | [GitHub](https://github.com/MrShennawy) | [LinkedIn](https://www.linkedin.com/in/mrshennawy) | <m.alshenaawy@gmail.com>

See the list of [contributors](https://github.com/mrshennawy/committer/contributors) who participated in this project.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes using Committer 😉 (`cmt`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.