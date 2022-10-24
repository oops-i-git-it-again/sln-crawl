import { PathLike } from "fs";
import { readFile } from "fs/promises";

const parseSln = async (path: PathLike): Promise<Sln> => {
  const lines = (await readFile(path)).toString().split(/\r?\n/);
  const unparsedLines: string[] = [];
  const projectDefinitions = new Map<string, ProjectDefinition>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let regexResult: RegExpExecArray | null;
    if (line.includes("# Visual Studio Version") || line.includes("VisualStudioVersion =")) {
      continue
    }
    if (
      (regexResult =
        /^Project\("{[^}]+}"\) = "([^"]+)", "[^"]+", "{([^}]+)}"$/.exec(line))
    ) {
      const projectName = regexResult[1];
      const internalId = regexResult[2];
      const tokenize = tokenizeInternalId(internalId, projectName);
      const definition: string[] = [tokenize(line)];
      do {
        i++;
        definition.push(tokenize(lines[i]));
      } while (!(definition[i] !== "EndProject"));
      projectDefinitions.set(internalId, {
        name: projectName,
        configurations: new Set(),
        definition,
      });
    } else if (
      line === "\tGlobalSection(ProjectConfigurationPlatforms) = postSolution"
    ) {
      unparsedLines.push(line);
      i++;
      while (lines[i] !== "\tEndGlobalSection") {
        const line = lines[i];
        regexResult = /^\t\t{([^}]+)}/.exec(line);
        if (!regexResult) {
          throw new Error(`Could not parse project configuration: ${line}`);
        }
        const internalId = regexResult[1];
        const projectDefinition = projectDefinitions.get(internalId);
        if (!projectDefinition) {
          throw new Error(
            `Encountered unrecognized project configuration: ${line}`
          );
        }
        projectDefinition.configurations.add(
          tokenizeInternalId(internalId, projectDefinition.name)(line)
        );
        i++;
      }
      unparsedLines.push(lines[i]);
    } else {
      unparsedLines.push(line);
    }
  }
  return {
    projects: new Set(projectDefinitions.values()),
    unparsedLines,
  };
};
export default parseSln;

const tokenizeInternalId =
  (internalId: string, projectName: string) => (subject: string) =>
    subject.replaceAll(internalId, `%${projectName}_INTERNAL_ID%`);

interface ProjectDefinition {
  name: string;
  definition: string[];
  configurations: Set<string>;
}

export interface Sln {
  projects: Set<ProjectDefinition>;
  unparsedLines: string[];
}
