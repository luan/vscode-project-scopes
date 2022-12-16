import { timeStamp } from "console";
import * as path from "path";
import * as vscode from "vscode";

type ScopeSettings = {
  included: Set<string>;
  excluded: Set<string>;
};

type JSONScopeSettings = {
  activeScope: string;
  globalExclude: Record<string, true>;
  enabled: boolean;
  scopes: Record<string, Record<"included" | "excluded", Array<string>>>;
};

const defaultSettings: JSONScopeSettings = {
  activeScope: "base",
  enabled: false,
  globalExclude: {},
  scopes: {
    base: {
      included: [],
      excluded: [],
    },
  },
};

export class Scope {
  private scopes: Record<string, ScopeSettings> = {};
  private activeScope: string = "base";
  private globalExclude: Record<string, true> = {};
  private enabled: boolean = false;

  constructor(private extensionContext: vscode.ExtensionContext) {
    this.getSettings();
  }

  refresh() {
    this.saveSettings();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.saveSettings();
  }

  setActiveScope(scope: string) {
    this.activeScope = scope;
    if (!this.scopes[scope]) {
      this.scopes[scope] = { included: new Set(), excluded: new Set() };
    }
    this.saveSettings();
  }

  private get scope() {
    return this.scopes[this.activeScope];
  }

  async add(list: "included" | "excluded", val: string) {
    const path = vscode.workspace.asRelativePath(val);
    this.scope["included"].delete(path);
    this.scope["excluded"].delete(path);
    this.scope[list].add(path);
    await this.saveSettings();
  }

  async remove(list: "included" | "excluded", val: string) {
    const path = vscode.workspace.asRelativePath(val);
    this.scope[list].delete(path);
    await this.saveSettings();
  }

  private async getSettings() {
    let scopeSettings = vscode.workspace
      .getConfiguration()
      .get("scopes.settings", defaultSettings);
    let globalExclude = vscode.workspace
      .getConfiguration()
      .get("files.exclude", {}) as JSONScopeSettings["globalExclude"];
    let attempts = 0;

    while (attempts < 2) {
      try {
        this.activeScope = scopeSettings.activeScope;
        this.globalExclude = scopeSettings.globalExclude;
        this.enabled = scopeSettings.enabled;
        this.scopes = {};
        Object.keys(scopeSettings.scopes).forEach((key) => {
          this.scopes[key] = {
            included: new Set(scopeSettings.scopes[key].included),
            excluded: new Set(scopeSettings.scopes[key].excluded),
          };
        });
      } catch (e) {
        console.error(e);
        scopeSettings = defaultSettings;
        scopeSettings.globalExclude = globalExclude;
      }
      attempts++;
    }

    await this.saveSettings();
  }

  private generateExclusionGlobs(): Record<string, true> {
    let result: Record<string, true> = { ...this.globalExclude };
    if (!this.enabled) {
      return result;
    }

    this.scope.excluded.forEach((name: string) => {
      result[name] = true;
    });
    return result;
  }

  private async saveSettings() {
    let settings: JSONScopeSettings = {
      activeScope: this.activeScope,
      enabled: this.enabled,
      globalExclude: this.globalExclude,
      scopes: {},
    };
    Object.keys(this.scopes).forEach((key) => {
      const scope = this.scopes[key];
      settings.scopes[key] = {
        included: [...scope.included.values()],
        excluded: [...scope.excluded.values()],
      };
    });
    await vscode.workspace
      .getConfiguration()
      .update("scopes.settings", settings, vscode.ConfigurationTarget.Global);

    vscode.workspace
      .getConfiguration()
      .update(
        "files.exclude",
        this.generateExclusionGlobs(),
        vscode.ConfigurationTarget.Global
      );
  }
}
