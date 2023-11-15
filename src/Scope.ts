import { timeStamp } from "console";
import { glob } from "glob";
import * as path from "path";
import { isAbsolute } from "path";
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

const CONFIG = "project-scopes";

function intersectPaths(...sets: Set<string>[]): Set<string> {
  if (!sets.length) {
    return new Set<string>();
  }

  const countMap: { [key: string]: number } = {};
  const allValues = new Set<string>();

  sets.forEach((set) => {
    for (let val of set) {
      allValues.add(val);
      let v = val;
      while (v !== "." && v !== "/") {
        if (countMap[v] !== undefined) {
          countMap[v] += 1;
        } else {
          countMap[v] = 1;
        }
        v = path.dirname(v);
      }
    }
  });

  const res = new Set<string>();
  allValues.forEach((val) => {
    if (countMap[val] === sets.length) {
      res.add(val);
    }
  });

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

  deleteScope(scope: string) {
    if (!this.scopeSettings[scope]) {
      return;
    }
    delete this.scopeSettings[scope];
    this.saveScopes();
  }

  get scope() {
    return this.scopeSettings[this.activeScope];
  }

  scopeByName(name: string) {
    return this.scopeSettings[name];
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

  private async heuristicIsScopeForWorkspace(
    scope: ScopeSettings,
    folder: vscode.WorkspaceFolder
  ): Promise<boolean> {
    const isInWorkspace = async (f: string) => {
      if (isAbsolute(f) && vscode.workspace.asRelativePath(f) === f) {
        return false;
      }
      const filePath = vscode.Uri.parse(
        path.join(folder.uri.fsPath, vscode.workspace.asRelativePath(f))
      );
      try {
        const stat = await vscode.workspace.fs.stat(filePath);
        return stat.type !== vscode.FileType.Unknown;
      } catch (e) {
        return false;
      }
    };
    const results = await Promise.all(
      [...scope.included, ...scope.excluded].map(isInWorkspace)
    );
    return most(results);
  }

  private async heuristicDetectScopeWorkspace(
    scope: ScopeSettings
  ): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const values = await Promise.all(
      folders.map(async (folder) => {
        if (await this.heuristicIsScopeForWorkspace(scope, folder)) {
          return folder;
        }
      })
    );

    return values.find((maybeFolder) => maybeFolder);
  }

  private async generateExclusionGlobs(): Promise<Record<string, true> | null> {
    let result: Record<string, true> = { ...this.globalExclude };
    if (!this.enabled) {
      return result;
    }
    const root = await this.heuristicDetectScopeWorkspace(this.scope);
    if (!root || !vscode.workspace.name?.includes(root.name)) {
      vscode.window.showInformationMessage(
        `Project Scopes: the selected scope cannot be applied to any workspace, skipping. Root name: '${root?.name}'; Workspace name: '${vscode.workspace.name}'`,
        {}
      );
      return null;
    }
    const rootPath = root.uri.fsPath;

    const rel = vscode.workspace.asRelativePath;
    this.scope.excluded.forEach((path) => {
      result[rel(path)] = true;
    });

    let sets: Set<string>[] = [];
    for (const folderPath of this.scope.included) {
      const set = new Set<string>();
      let folder = rel(folderPath);
      let parent = path.dirname(folder);
      while (folder !== path.dirname(parent)) {
        const siblings = glob.sync(path.join(rootPath, parent, "*"), {
          ignore: path.join(rootPath, folder),
          dot: true,
        });
        siblings.forEach((p) => set.add(rel(p)));
        folder = parent;
        parent = path.dirname(parent);
      }

      set.delete(".");
      sets.push(set);
    }

    const exclusionsFromInclusions = intersectPaths(...sets);
    exclusionsFromInclusions.forEach((path) => {
      result[path] = true;
    });

    return result;
  }

  private async updateFilesExclude() {
    const globs = await this.generateExclusionGlobs();
    if (globs) {
      vscode.workspace
        .getConfiguration()
        .update("files.exclude", globs, vscode.ConfigurationTarget.Global);
    }
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

function most(arr: Array<boolean>) {
  const count = arr.filter(Boolean).length ?? 0;
  return count / arr.length > 0.5;
}
