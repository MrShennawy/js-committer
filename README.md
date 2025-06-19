# Committer

[![npm](https://badge.fury.io/js/@shennawy%2Fcommitter.svg)](http://badge.fury.io/js/@shennawy%2Fcommitter)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMrShennawy%2Fjs-committer.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2FMrShennawy%2Fjs-committer?ref=badge_shield&issueType=license)

__Committer__ is a package that streamlines the process of crafting standard Git commit messages, assisting developers in maintaining a consistent and clean commit history.

<p align="center">
  <img width="600" src="docs/assets/cmt.svg">
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
- 🔍 Interactive file selection for staged changes
- 🔄 Re-use last commit message
- 🏗️ Build integration support
- 🎯 JIRA integration with automatic issue title fetching
- 🚀 Streamlined git workflow
- 🤖 AI-powered commit message generation

## Usage

The package provides the `cmt` command with several powerful options:

### Basic Usage

```bash
    cmt # Start the interactive commit process
    cmt -s # Start commit process with file selection
    cmt -lc # Use last commit message.
    cmt -b # Build and commit
    cmt -jr # Commit with JIRA integration
```


## Configuration

The tool uses standard Git configuration and can be integrated with your existing Git workflow. For JIRA integration, ensure your credentials are properly configured.

## JIRA Integration

When using the `-jr` flag, Committer will:
1. Connect to your JIRA instance
2. Automatically fetch the issue title
3. Include the JIRA issue reference in your commit message

## AI-Powered Commit Messages

Committer includes an advanced AI-powered commit message generation feature using Google's Generative AI (Gemini). This feature:

- 🧠 Automatically analyzes your code changes
- 📝 Generates concise, professional commit messages
- 🔄 Integrates with JIRA summaries when available
- ✨ Follows commit message best practices

### Setup

To use the AI feature:
1. You'll be prompted to provide your Google Generative AI API key on first use
2. The key will be securely stored for future use

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