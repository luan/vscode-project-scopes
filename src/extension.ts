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
        if (e.affectsConfiguration("scopes")) {
          scope.refresh();
        }
      }),
      vscode.commands.registerCommand("scopes.setActiveScope", (args) =>
        scope.setActiveScope(args)
      ),
      vscode.commands.registerCommand("scopes.refresh", (args) =>
        scope.refresh()
      ),
      vscode.commands.registerCommand("scopes.toggle", (args) =>
        scope.toggle()
      ),
      vscode.commands.registerCommand("scopes.toggleInclusion", (args) =>
        scope.toggleItem("included", args.path || args.label)
      ),
      vscode.commands.registerCommand("scopes.toggleExclusion", (args) =>
        scope.toggleItem("excluded", args.path || args.label)
      ),
    ]
  );
}

export function deactivate() {}
