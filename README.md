# VSCode Project Scopes

VSCode has features to make shared workspaces or to group them together, but unfortunately those don't quite work with every monorepo. Monorepos have a way to be deeply integrated and have a hard time migrating to things that properly shard the codebase. A solution is to hide the parts of the project you're not using.

This extension is inspired by how IntelliJ solves this problem, with Project Scopes. This allows you to create a view of the project where you're going to find files, navigate, etc.

## Installation

[VSCode marketplace](https://marketplace.visualstudio.com/items?itemName=cfcluan.project-scopes&ssr=false)

## Features

In a nutshell, Project Scopes allows you to pick and chose which folders on your project to see at any given point in time. Features around that include:
  - Add as many scopes as you'd like with an identifying name. A `base` scope is automatically added for you.
  - Seamlessly switch between scopes, or switch scopes off entirely
  - Everything can be done either with the command pallette (⌘/⌃ + Shift + P), the UI underneath the file browser or right clicks over directories/files

Available commands:

| command | title | notes |
| ------- | ----- | ------ |
| project-scopes.add | Add a new project scope and switch to it | Can be triggered via command pallette or the Project Scopes UI |
| project-scopes.delete | Delete project scope | Can be triggered via command pallette or the Project Scopes UI |
| project-scopes.switcher | Open project scope switcher | Search/switch to a scope, via command pallette |
| project-scopes.refresh | Refresh project scopes settings | This runs automatically for you when settings change, you can run it manually via the command pallette |
| project-scopes.toggle | Toggle project scopes extension | Will show/hide all of the filtered files/folders, trigger via command pallette or UI |
| project-scopes.toggleInclusion | Always include this path (Toggle) | Only available  by right clicking a file/folder. Will toggle whether that entry is in the inclusion list |
| project-scopes.toggleExclusion | Exclude this path (Toggle) | Only available  by right clicking a file/folder. Will toggle whether that entry is in the exclusion list |

### A quick video demoing the features

https://user-images.githubusercontent.com/223760/208175365-f7b4e08e-1e3c-4c4f-8c25-8fff000029e1.mp4


## Extension Settings

This extension contributes the following settings:

  - `project-scopes.enabled`: Whether or not to show/hide files based on scope selection
  - `project-scopes.activeScope`: Scope currently in use by the Scopes extension
  - `project-scopes.globalExclude`: Globals to merge in with scope settings into files.exclude. **This setting takes over from `files.exclude` built-in because the Extension uses it for the main functionality**
  - `project-scopes.scopes`: Inclusion/exclusion settings per scope

If you use settings sync, I'd recommend setting the following settings to ignore fringe configuration for this extension so that your projects between multiple computers don't conflict:

```
  "settingsSync.ignoredSettings": [
    "files.exclude",
    "project-scopes.scopes",
    "project-scopes.activeScope",
    "project-scopes.enabled"
  ],
```

This ignores the global `files.exclude` setting, in favor of `project-scopes.globalExclude`, which is where you're keeping your global exclude settings now. It also ignores project specific settings if you can't keep those in workspace settings (which is the case for me since the workspace is checked-in and these preferences are personal).

## Release Notes

### 1.1.0
Basic support for remote dev environments

### 1.0.0

Initial release of Project Scopes
