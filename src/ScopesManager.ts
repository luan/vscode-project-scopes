import * as vscode from "vscode";
import { Scope } from "./Scope";

type Items = AddButton | ExtensionToggle | ScopeScope | ScopeItem;

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
          new ScopeInclusion(
            element.label,
            this.scope.scopeByName(element.label).included.size
          ),
          new ScopeExclusion(
            element.label,
            this.scope.scopeByName(element.label).excluded.size
          ),
        ];
      }
      if (element instanceof ScopeInclusion) {
        return Promise.all([
          ...[...this.scope.scopeByName(element.scopeName).included].map(
            async (path) => {
              const exists = await this.scope.fileExists(path);
              if (!exists) {
                return new ScopeItem(
                  `${path} (file not found)`,
                  "inclusion",
                  "File not found",
                  "error"
                );
              }
              return new ScopeItem(path, "inclusion");
            }
          ),
        ]);
      }
      if (element instanceof ScopeExclusion) {
        return Promise.all([
          ...[...this.scope.scopeByName(element.scopeName).excluded].map(
            async (path) => {
              const exists = await this.scope.fileExists(path);
              if (!exists) {
                return new ScopeItem(
                  `${path} (file not found)`,
                  "exclusion",
                  "File not found",
                  "error"
                );
              }
              return new ScopeItem(path, "exclusion");
            }
          ),
        ]);
      }
      return [] as Items[];
    } else {
      return [
        new ExtensionToggle(this.scope.isEnabled),
        ...this.scope.scopes.map(
          (scope) => new ScopeScope(scope, this.scope.getActiveScope())
        ),
        new AddButton(),
      ];
    }
  }
}

class AddButton extends vscode.TreeItem {
  constructor() {
    super("Add new scope", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("plus");
    this.command = {
      command: "project-scopes.add",
      title: "Add",
    };
  }
}

class ExtensionToggle extends vscode.TreeItem {
  constructor(enabled: boolean) {
    super("Enabled", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(
      enabled ? "pass-filled" : "circle-large-outline"
    );
    this.command = {
      command: "project-scopes.toggle",
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
      command: "project-scopes.setActiveScope",
      title: "Change scope",
      arguments: [label],
    };
    this.contextValue = "scope";
  }
}

class ScopeInclusion extends vscode.TreeItem {
  constructor(public scopeName: string, count: number) {
    super(`Include (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("check");
  }
}

class ScopeExclusion extends vscode.TreeItem {
  constructor(public scopeName: string, count: number) {
    super(`Exclude (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("circle-slash");
  }
}

class ScopeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    context: string,
    tooltip?: string,
    iconPath?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.resourceUri = vscode.Uri.parse(label);
    this.contextValue = context;
    if (tooltip) {
      this.tooltip = tooltip;
    }
    if (iconPath) {
      this.iconPath = new vscode.ThemeIcon(iconPath);
    }
  }
}
