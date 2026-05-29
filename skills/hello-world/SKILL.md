---
name: hello-world
version: "1.0.0"
description: A minimal example skill that greets the user and demonstrates the SKILL.md format.
allowed-tools:
  - Bash(echo:*)
hooks:
  on_enable:
    - echo "hello-world skill enabled"
  on_disable:
    - echo "hello-world skill disabled"
---

# Hello World Skill

The simplest possible skill — greets the user by name.

## Usage

```bash
# Invoke via slash command
/hello-world

# With an argument
/hello-world "Alice"
```

## What it does

1. Reads the optional name argument (defaults to "World").
2. Prints `Hello, <name>!` to stdout.

## Example

```
> /hello-world "Agent"
Hello, Agent!
```
