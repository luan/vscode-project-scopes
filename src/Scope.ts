import { timeStamp } from "console";
import * as path from "path";
import * as vscode from "vscode";

type ScopeSettings = {
  included: Set<string>;
  excluded: Set<string>;
};

type JSONScopes = Record<
  string,
  Record<"included" | "excluded", Array<string>>
>;

const defaultScopes: JSONScopes = {
  base: {
    included: [],
    excluded: [],
  },
};

const CONFIG = "scopes";

export class Scope {
  private scopes: Record<string, ScopeSettings> = {};
  private activeScope: string = "base";
  private globalExclude: Record<string, true> = {};
  private enabled: boolean = false;

  constructor(private extensionContext: vscode.ExtensionContext) {
    const filesExclude = vscode.workspace
      .getConfiguration()
      .get("files.exclude", {}) as Record<string, true>;
    this.globalExclude = this.getConfig("globalExclude", filesExclude);
    if (!this.globalExclude) {
      this.globalExclude = filesExclude;
      this.setConfig("globalExclude", this.globalExclude);
    }
    this.getSettings();
  }

  refresh() {
    this.getSettings();
    this.updateFilesExclude();
  }

  toggle() {
    this.enabled = !this.enabled;
    this.setConfig("enabled", this.enabled);
  }

  setActiveScope(scope: string) {
    this.activeScope = scope;
    if (!this.scopes[scope]) {
      this.scopes[scope] = { included: new Set(), excluded: new Set() };
      this.saveScopes();
    }
    this.setConfig("activeScope", scope);
  }

  private get scope() {
    return this.scopes[this.activeScope];
  }

  add(list: "included" | "excluded", val: string) {
    const path = vscode.workspace.asRelativePath(val);
    this.scope["included"].delete(path);
    this.scope["excluded"].delete(path);
    this.scope[list].add(path);
    this.saveScopes();
  }

  remove(list: "included" | "excluded", val: string) {
    const path = vscode.workspace.asRelativePath(val);
    this.scope[list].delete(path);
    this.saveScopes();
  }

  private getConfig<T>(config: string, defaultValue: T): T {
    return vscode.workspace.getConfiguration(CONFIG).get(config, defaultValue);
  }

  private setConfig(config: string, value: unknown) {
    vscode.workspace
      .getConfiguration(CONFIG)
      .update(config, value, vscode.ConfigurationTarget.Global);
  }

  private getSettings() {
    this.enabled = this.getConfig("enabled", true);
    this.activeScope = this.getConfig("activeScope", "base");
    const filesExclude = vscode.workspace
      .getConfiguration()
      .get("files.exclude", {}) as Record<string, true>;
    this.globalExclude = this.getConfig("globalExclude", {});
    let scopes = this.getConfig("scopes", defaultScopes);

    this.scopes = {};
    Object.keys(scopes).forEach((key) => {
      this.scopes[key] = {
        included: new Set(scopes[key].included),
        excluded: new Set(scopes[key].excluded),
      };
    });
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

  private updateFilesExclude() {
    vscode.workspace
      .getConfiguration()
      .update(
        "files.exclude",
        this.generateExclusionGlobs(),
        vscode.ConfigurationTarget.Global
      );
  }

  private saveScopes() {
    let scopes: JSONScopes = {};
    Object.keys(this.scopes).forEach((key) => {
      const scope = this.scopes[key];
      scopes[key] = {
        included: [...scope.included.values()],
        excluded: [...scope.excluded.values()],
      };
    });
    this.setConfig("scopes", scopes);
  }
}
