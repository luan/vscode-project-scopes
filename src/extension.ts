import * as vscode from "vscode";
import { Scope } from "./Scope";

export function activate(context: vscode.ExtensionContext) {
  const scope = new Scope(context);
  console.log("scopes activated");

  context.subscriptions.push(
    ...[
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("scopes")) {
          scope.refresh();
        }
      }),
      vscode.commands.registerCommand("scopes.refresh", (args) =>
        scope.refresh()
      ),
      vscode.commands.registerCommand("scopes.toggle", (args) =>
        scope.toggle()
      ),
      vscode.commands.registerCommand("scopes.toggleInclusion", (args) =>
        scope.toggleItem("included", args.path)
      ),
      vscode.commands.registerCommand("scopes.toggleExclusion", (args) =>
        scope.toggleItem("excluded", args.path)
      ),
    ]
  );
}

export function deactivate() {}
