import * as vscode from "vscode";
import { Scope } from "./Scope";
import { ScopesManager } from "./ScopesManager";

export function activate(context: vscode.ExtensionContext) {
  const scope = new Scope(context);
  vscode.window.createTreeView("scopesManager", {
    treeDataProvider: new ScopesManager(scope),
    canSelectMany: false,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    ...[
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("project-scopes")) {
          scope.refresh();
        }
      }),
      vscode.commands.registerCommand("project-scopes.add", async (args) => {
        const userResponse = await vscode.window.showInputBox({
          placeHolder: "Name the new project scope to create",
        });
        if (!userResponse) {
          return;
        }
        scope.setActiveScope(userResponse);
      }),
      vscode.commands.registerCommand("project-scopes.delete", async (args) => {
        let selectedScope = args?.label;
        if (!selectedScope) {
          selectedScope = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select project scope to DELETE",
          });
        }
        if (!selectedScope) {
          return;
        }
        scope.deleteScope(selectedScope);
      }),
      vscode.commands.registerCommand(
        "project-scopes.switcher",
        async (args) => {
          const userResponse = await vscode.window.showQuickPick(scope.scopes, {
            title: "Select project scope to switch to",
            placeHolder: scope.getActiveScope(),
          });
          if (!userResponse) {
            return;
          }
          scope.setActiveScope(userResponse);
        }
      ),
      vscode.commands.registerCommand("project-scopes.setActiveScope", (args) =>
        scope.setActiveScope(args)
      ),
      vscode.commands.registerCommand("project-scopes.refresh", (args) =>
        scope.refresh()
      ),
      vscode.commands.registerCommand("project-scopes.toggle", (args) =>
        scope.toggle()
      ),
      vscode.commands.registerCommand(
        "project-scopes.toggleInclusion",
        (args) => scope.toggleItem("included", args.path || args.label)
      ),
      vscode.commands.registerCommand(
        "project-scopes.toggleExclusion",
        (args) => scope.toggleItem("excluded", args.path || args.label)
      ),
    ]
  );
}

export function deactivate() {}
