import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Scope } from "./Scope";

type Items = ExtensionToggle | ScopeScope | ScopeItem;

export class ScopesManager implements vscode.TreeDataProvider<Items> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    Items | undefined | null | void
  > = new vscode.EventEmitter<Items | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Items | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private scope: Scope) {
    scope.subscribe(() => this.refresh());
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Items): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Items): Promise<Items[]> {
    if (element) {
      if (element instanceof ScopeScope) {
        return [
          new ScopeInclusion(this.scope.scope.included.size),
          new ScopeExclusion(this.scope.scope.excluded.size),
        ];
      }
      if (element instanceof ScopeInclusion) {
        return [
          ...[...this.scope.scope.included].map(
            (path) => new ScopeItem(path, "inclusion")
          ),
        ];
      }
      if (element instanceof ScopeExclusion) {
        return [
          ...[...this.scope.scope.excluded].map(
            (path) => new ScopeItem(path, "exclusion")
          ),
        ];
      }
      return [] as Items[];
    } else {
      return [
        new ExtensionToggle(this.scope.isEnabled),
        ...this.scope.scopes.map(
          (scope) => new ScopeScope(scope, this.scope.getActiveScope())
        ),
      ];
    }
  }
}

class ExtensionToggle extends vscode.TreeItem {
  constructor(enabled: boolean) {
    super("Enabled", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(
      enabled ? "pass-filled" : "circle-large-outline"
    );
    this.command = {
      command: "scopes.toggle",
      title: "Toggle",
    };
  }
}

class ScopeScope extends vscode.TreeItem {
  constructor(public readonly label: string, activeScope: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon(
      label === activeScope ? "circle-filled" : "circle-outline"
    );
    this.command = {
      command: "scopes.setActiveScope",
      title: "Change scope",
      arguments: [label],
    };
  }
}

class ScopeInclusion extends vscode.TreeItem {
  constructor(count: number) {
    super(`Include (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("check");
  }
}

class ScopeExclusion extends vscode.TreeItem {
  constructor(count: number) {
    super(`Exclude (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("circle-slash");
  }
}

class ScopeItem extends vscode.TreeItem {
  constructor(public readonly label: string, context: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.resourceUri = vscode.Uri.parse(label);
    this.contextValue = context;
  }
}
