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
      vscode.commands.registerCommand("scopes.addInclusion", (args) =>
        scope.add("included", args.path)
      ),
      vscode.commands.registerCommand("scopes.removeInclusion", (args) =>
        scope.remove("included", args.path)
      ),
      vscode.commands.registerCommand("scopes.addExclusion", (args) =>
        scope.add("excluded", args.path)
      ),
      vscode.commands.registerCommand("scopes.removeExclusion", (args) =>
        scope.remove("excluded", args.path)
      ),
    ]
  );
}

export function deactivate() {}
