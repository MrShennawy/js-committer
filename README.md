# Committer

[![npm](https://badge.fury.io/js/@shennawy%2Fcommitter.svg)](http://badge.fury.io/js/@shennawy%2Fcommitter)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMrShennawy%2Fjs-committer.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2FMrShennawy%2Fjs-committer?ref=badge_shield&issueType=license)

__Committer__ is a package that streamlines the process of crafting standard Git commit messages, assisting developers in maintaining a consistent and clean commit history..

<p align="center">
  <img width="600" src="docs/assets/cmt.svg">
</p>

## Table of Contents

1. [Installation](#installation)
2. [Usage](#usage)
3. [Authors](#authors)
4. [License](#license)

## Installation

```bash
sudo npm i @shennawy/committer -g
```

## Usage

After installing the package, you can use it by running the command `cmt`.
- The `cmt` command supports the following options:
    - `-s`: This option allows to select the files before committing. It can be used as `cmt -s`.
    - `-lc`: This option retrieves the last commit and sets it as the default commit. It can be used as `cmt -lc`.  
    - `-b`: For run build command then push the updates in one step. It can be used as `cmt -b`.
    - `-jr`: Integrate Committer with jira. It can be used as `cmt -jr`.
      - It will automatically get the issue title

## Authors

- Mahmoud Shennawy  | [GitHub](https://github.com/MrShennawy)  | [LinkedIn](https://www.linkedin.com/in/mrshennawy) | <m.alshenaawy@gmail.com>

You can also see the list of [contributors](https://github.com/mrshennawy/committer/contributors) who participated in this project.

## License

This project is licensed under the MIT License. See the file [LICENSE](LICENSE) for details.  