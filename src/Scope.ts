import { timeStamp } from "console";
import { glob } from "glob";
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

function intersect<T>(...sets: Set<T>[]) {
  if (!sets.length) {
    return new Set<T>();
  }
  const i = sets.reduce((m, s, i) => (s.size < sets[m].size ? i : m), 0);
  const [smallest] = sets.splice(i, 1);
  const res = new Set<T>();
  for (let val of smallest) {
    if (sets.every((s) => s.has(val))) {
      res.add(val);
    }
  }
  return res;
}

export class Scope {
  private scopeSettings: Record<string, ScopeSettings> = {};
  private activeScope: string = "base";
  private globalExclude: Record<string, true> = {};
  private enabled: boolean = false;
  private callbacks: (() => void)[] = [];

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

  subscribe(cb: () => void) {
    this.callbacks.push(cb);
  }

  get isEnabled() {
    return this.enabled;
  }

  get scopes() {
    return Object.keys(this.scopeSettings);
  }

  refresh() {
    this.getSettings();
    this.updateFilesExclude();
    this.callbacks.forEach((cb) => cb());
  }

  toggle() {
    this.enabled = !this.enabled;
    this.setConfig("enabled", this.enabled);
  }

  getActiveScope() {
    return this.activeScope;
  }

  setActiveScope(scope: string) {
    this.activeScope = scope;
    if (!this.scopeSettings[scope]) {
      this.scopeSettings[scope] = { included: new Set(), excluded: new Set() };
      this.saveScopes();
    }
    this.setConfig("activeScope", scope);
  }

  get scope() {
    return this.scopeSettings[this.activeScope];
  }

  toggleItem(list: "included" | "excluded", val: string) {
    const path = vscode.workspace.asRelativePath(val);
    const other = list === "included" ? "excluded" : "included";
    if (this.scope[list].has(path)) {
      this.scope[list].delete(path);
    } else {
      this.scope[other].delete(path);
      this.scope[list].add(path);
    }
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

    this.scopeSettings = {};
    Object.keys(scopes).forEach((key) => {
      this.scopeSettings[key] = {
        included: new Set(scopes[key].included),
        excluded: new Set(scopes[key].excluded),
      };
    });
  }

  private async generateExclusionGlobs(): Promise<Record<string, true>> {
    let result: Record<string, true> = { ...this.globalExclude };
    if (!this.enabled) {
      return result;
    }
    const rel = vscode.workspace.asRelativePath;

    this.scope.excluded.forEach((path) => {
      result[rel(path)] = true;
    });

    let sets: Set<string>[] = [];
    for (const pathToInclude of this.scope.included) {
      const folderPath = path.isAbsolute(pathToInclude)
        ? pathToInclude
        : path.join(
            vscode.workspace.workspaceFolders![0].uri.fsPath,
            pathToInclude
          );

      const uri = vscode.Uri.parse(folderPath);
      const root = vscode.workspace.getWorkspaceFolder(uri);
      if (!root) {
        continue;
      }
      const rootPath = root.uri.fsPath;
      const set = new Set<string>();
      let folder = folderPath;
      let parent = path.dirname(folder);
      while (parent.length >= rootPath.length) {
        const siblings = glob.sync(path.join(parent, "*"), {
          ignore: folder,
          dot: true,
        });
        siblings.forEach((p) => set.add(p));
        folder = parent;
        parent = path.dirname(parent);
      }

      set.delete(path.join(rootPath, "/"));
      sets.push(set);
    }

    const exclusionsFromInclusions = intersect(...sets);
    exclusionsFromInclusions.forEach((path) => {
      result[rel(path)] = true;
    });

    return result;
  }

  private async updateFilesExclude() {
    vscode.workspace
      .getConfiguration()
      .update(
        "files.exclude",
        await this.generateExclusionGlobs(),
        vscode.ConfigurationTarget.Global
      );
  }

  private saveScopes() {
    let scopes: JSONScopes = {};
    Object.keys(this.scopeSettings).forEach((key) => {
      const scope = this.scopeSettings[key];
      scopes[key] = {
        included: [...scope.included.values()],
        excluded: [...scope.excluded.values()],
      };
    });
    this.setConfig("scopes", scopes);
  }
}
