#!/usr/bin/env tsx
/**
 * Code Generator for Graph Classes
 *
 * Generates TypeScript types, validators, and generators from
 * declarative JSON specifications in class-specs.json.
 *
 * Usage:
 *   tsx scripts/codegen/generate-graph-classes.ts [options]
 *
 * Options:
 *   --category <name>    Generate only specified category
 *   --priority <n>       Generate only classes with priority <= n
 *   --dry-run           Show what would be generated without writing files
 *   --types             Generate only type definitions
 *   --validators         Generate only validators
 *   --generators         Generate only generators
 *   --analyzers          Generate only analyzers
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface GraphClass {
  name: string;
  kind: string;
  negative: string;
  description: string;
  forbiddenSubgraph: string;
  priority: number;
  hasGenerator: boolean;
  hasValidator: boolean;
  hasAnalyzer: boolean;
}

interface Category {
  description: string;
  classes: GraphClass[];
}

interface ClassSpecs {
  metadata: {
    version: string;
    generated: string;
    totalClasses: number;
    categories: string[];
  };
  categories: Record<string, Category>;
}

// ============================================================================
// Command Line Parsing
// ============================================================================

interface Options {
  category?: string;
  priority?: number;
  dryRun: boolean;
  types: boolean;
  validators: boolean;
  generators: boolean;
  analyzers: boolean;
}

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    dryRun: false,
    types: false,
    validators: false,
    generators: false,
    analyzers: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--category":
        options.category = args[++i];
        break;
      case "--priority":
        options.priority = parseInt(args[++i], 10);
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--types":
        options.types = true;
        break;
      case "--validators":
        options.validators = true;
        break;
      case "--generators":
        options.generators = true;
        break;
      case "--analyzers":
        options.analyzers = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  // If no specific output selected, generate all
  if (
    !options.types &&
    !options.validators &&
    !options.generators &&
    !options.analyzers
  ) {
    options.types = true;
    options.validators = true;
    options.generators = true;
    options.analyzers = true;
  }

  return options;
};

// ============================================================================
// JSON Loading
// ============================================================================

const loadClassSpecs = (): ClassSpecs => {
  const specsPath = join(__dirname, "class-specs.json");
  const content = readFileSync(specsPath, "utf-8");
  return JSON.parse(content) as ClassSpecs;
};

// ============================================================================
// Type Definition Generation
// ============================================================================

/**
 * Convert PascalCase to camelCase
 * Handles cases like ATFree -> atFree, HHFree -> hhFree
 * Also handles special cases for renamed properties
 */
const toCamelCase = (str: string): string => {
  // Special case mappings for renamed properties
  const specialCases: Record<string, string> = {
    "WeaklyChordal": "", // Removed - already exists in main spec
    "ATFree": "atFree",
    "HHFree": "hhFree",
    "CircularArc": "circularArc",
    "ProperCircularArc": "properCircularArc",
    "Disk": "diskGraphNew",
    "UnitDisk": "", // Already exists in main spec
    "ProbeChordal": "probeChordal",
    "ProbeInterval": "probeInterval",
    "Pathwidth": "pathwidth",
    "Treewidth": "", // Already exists in main spec with different type
    "Cliquewidth": "cliquewidth",
    "Modular": "modular",
    "Ptolemaic": "ptolemaic",
    "QuasiLine": "quasiLine",
    "Planar": "planarNew", // Renamed to avoid conflict
  };

  if (specialCases[str] === "") {
    return ""; // Skip this property
  }
  if (specialCases[str]) {
    return specialCases[str];
  }

  // Default: just lowercase first letter
  return str.charAt(0).toLowerCase() + str.slice(1);
};

/**
 * Generate type definition for a graph class
 */
const generateTypeDefinition = (cls: GraphClass): string => {
  const { name, kind, negative, description } = cls;

  return `/**
 * ${description}
 */
export type ${name} = { kind: "${kind}" } | { kind: "${negative}" } | { kind: "unconstrained" };`;
};

/**
 * Generate type definitions file for a category
 */
const generateTypeFile = (
  categoryName: string,
  classes: GraphClass[]
): string => {
  const header = `/**
 * ${categoryName} Graph Class Type Definitions
 *
 * AUTO-GENERATED by scripts/codegen/generate-graph-classes.ts
 * DO NOT EDIT MANUALLY
 *
 * @generated ${new Date().toISOString()}
 */

`;

  const imports = ``; // No imports needed for type definitions


  const types = classes.map((cls) => generateTypeDefinition(cls)).join("\n\n");

  return header + imports + types + "\n";
};

// ============================================================================
// Validator Generation
// ============================================================================

/**
 * Generate validator function for a graph class
 */
const generateValidator = (cls: GraphClass): string => {
  const { name, kind, description } = cls;
  const propertyName = toCamelCase(name);

  // Skip properties that don't exist in GraphSpec
  if (propertyName === "") {
    return `// Skipped: ${name} (property already exists or was renamed)`;
  }

  return `/**
 * Validate ${name} property.
 * ${description}
 *
 * @param graph - Test graph to validate
 * @param _adjustments - Optional validation adjustments
 * @returns PropertyValidationResult for validation details
 */
export const validate${name} = (
  graph: TestGraph,
  _adjustments: Partial<Record<string, boolean>> = {}
): PropertyValidationResult => {
  const { spec, nodes, edges } = graph;
  const expected = spec.${propertyName}?.kind;

  if (expected === undefined || expected === "unconstrained") {
    return {
      property: "${name}",
      expected: "unconstrained",
      actual: "unconstrained",
      valid: true,
    };
  }

  // TODO: Implement validation logic for ${name}
  // For now, return placeholder validation
  const actual = "${kind}"; // Computed from graph structure

  const valid = actual === expected;

  return {
    property: "${name}",
    expected,
    actual,
    valid,
    message: valid
      ? undefined
      : \`Expected \${expected} but found \${actual}\`,
  };
};`;
};

/**
 * Generate validators file for a category
 */
const generateValidatorFile = (
  categoryName: string,
  classes: GraphClass[]
): string => {
  const header = `/**
 * ${categoryName} Graph Class Validators
 *
 * AUTO-GENERATED by scripts/codegen/generate-graph-classes.ts
 * DO NOT EDIT MANUALLY
 *
 * @generated ${new Date().toISOString()}
 */

import type { TestGraph } from "../generation/generators/types.js";
import type { PropertyValidationResult } from "./types.js";

`;

  const validators = classes
    .filter((cls) => cls.hasValidator)
    .map((cls) => generateValidator(cls))
    .join("\n\n");

  return header + validators + "\n";
};

// ============================================================================
// Generator Generation
// ============================================================================

/**
 * Generate generator function for a graph class
 */
const generateGenerator = (cls: GraphClass): string => {
  const { name, kind, description } = cls;
  const propertyName = toCamelCase(name);

  // Skip properties that don't exist in GraphSpec
  if (propertyName === "") {
    return `// Skipped: ${name} (property already exists or was renamed)`;
  }

  return `/**
 * Generate ${name} edges.
 * ${description}
 *
 * @param nodes - Graph nodes
 * @param edges - Edge list to populate
 * @param spec - Graph specification
 * @param rng - Seeded random number generator
 */
const _generate${name}Edges = (
  nodes: TestNode[],
  edges: TestEdge[],
  spec: GraphSpec,
  rng: SeededRandom
): void => {
  if (spec.${propertyName}?.kind !== "${kind}") {
    throw new Error("${name} generation requires ${kind} spec");
  }

  // TODO: Implement generation logic for ${name}
  // This is a placeholder that generates random edges
  // Replace with actual constructive algorithm

  const nodeCount = nodes.length;

  // Simple random edge generation (replace with actual algorithm)
  for (let i = 0; i < nodeCount; i++) {
    const j = (i + 1 + rng.integer(0, nodeCount - 2)) % nodeCount;
    if (i < j && rng.next() > 0.5) {
      edges.push({ source: nodes[i].id, target: nodes[j].id });
    }
  }
};`;
};

/**
 * Generate generators file for a category
 */
const generateGeneratorFile = (
  categoryName: string,
  classes: GraphClass[]
): string => {
  const header = `/**
 * ${categoryName} Graph Class Generators
 *
 * AUTO-GENERATED by scripts/codegen/generate-graph-classes.ts
 * DO NOT EDIT MANUALLY
 *
 * @generated ${new Date().toISOString()}
 */

import type { TestNode, TestEdge } from "./types.js";
import type { GraphSpec } from "../spec.js";
import type { SeededRandom } from "./types.js";

`;

  const generators = classes
    .filter((cls) => cls.hasGenerator)
    .map((cls) => generateGenerator(cls))
    .join("\n\n");

  // No additional exports - generators are internal

  return header + generators + "\n";
};

// ============================================================================
// Analyzer Generation
// ============================================================================

/**
 * Generate analyzer function for a graph class
 */
const generateAnalyzer = (cls: GraphClass): string => {
  const { name, kind, description } = cls;

  return `/**
 * Compute ${name} property from graph structure.
 * ${description}
 *
 * @param g - Analyzer graph
 * @param _policy - Computation policy (unused in generated analyzers)
 * @returns ${name} with computed value
 */
export const compute${name} = (
  g: AnalyzerGraph,
  _policy: ComputePolicy
): ${name} => {
  // TODO: Implement analysis logic for ${name}
  // For now, return placeholder value

  // Example: Check for forbidden subgraph
  // const hasForbidden = checkForForbiddenSubgraph(g);
  // return hasForbidden ? { kind: "${cls.negative}" } : { kind: "${kind}" };

  return { kind: "${kind}" };
};`;
};

/**
 * Generate analyzers file for a category
 */
const generateAnalyzerFile = (
  categoryName: string,
  classes: GraphClass[]
): string => {
  const header = `/**
 * ${categoryName} Graph Class Analyzers
 *
 * AUTO-GENERATED by scripts/codegen/generate-graph-classes.ts
 * DO NOT EDIT MANUALLY
 *
 * @generated ${new Date().toISOString()}
 */

import type { AnalyzerGraph } from "./types.js";
import type { ComputePolicy } from "./types.js";
import type {
  ${classes.filter((c) => c.hasAnalyzer).map((c) => c.name).join(",\n  ")}
} from "../generation/spec/${categoryName.toLowerCase()}.js";

`;

  const analyzers = classes
    .filter((cls) => cls.hasAnalyzer)
    .map((cls) => generateAnalyzer(cls))
    .join("\n\n");

  return header + analyzers + "\n";
};

// ============================================================================
// File Writing
// ============================================================================

const ensureDirectory = (dir: string): void => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

const writeFile = (filePath: string, content: string): void => {
  writeFileSync(filePath, content, "utf-8");
  console.log(`Generated: ${filePath}`);
};

// ============================================================================
// Main Generation Logic
// ============================================================================

const generateForCategory = (
  categoryName: string,
  category: Category,
  options: Options
): void => {
  const classes = category.classes.filter((cls) => {
    if (options.priority !== undefined) {
      return cls.priority <= options.priority;
    }
    return true;
  });

  if (classes.length === 0) {
    console.log(`No classes to generate for category: ${categoryName}`);
    return;
  }

  console.log(`\nGenerating ${classes.length} classes for ${categoryName}...`);

  const baseDir = join(
    __dirname,
    "..",
    "..",
    "src"
  );

  // Generate type definitions
  if (options.types) {
    const typeDir = join(baseDir, "generation", "spec");
    ensureDirectory(typeDir);
    const typeContent = generateTypeFile(categoryName, classes);
    const typePath = join(typeDir, `${categoryName.toLowerCase()}.ts`);

    if (options.dryRun) {
      console.log(`[DRY RUN] Would generate: ${typePath}`);
      console.log(`  ${classes.length} type definitions`);
    } else {
      writeFile(typePath, typeContent);
    }
  }

  // Generate validators
  if (options.validators) {
    const validatorDir = join(baseDir, "validation");
    ensureDirectory(validatorDir);
    const validatorContent = generateValidatorFile(categoryName, classes);
    const validatorPath = join(
      validatorDir,
      `${categoryName.toLowerCase()}.ts`
    );

    if (options.dryRun) {
      console.log(`[DRY RUN] Would generate: ${validatorPath}`);
      console.log(`  ${classes.filter((c) => c.hasValidator).length} validators`);
    } else {
      writeFile(validatorPath, validatorContent);
    }
  }

  // Generate generators
  if (options.generators) {
    const generatorDir = join(baseDir, "generation", "generators");
    ensureDirectory(generatorDir);
    const generatorContent = generateGeneratorFile(categoryName, classes);
    const generatorPath = join(
      generatorDir,
      `${categoryName.toLowerCase()}.ts`
    );

    if (options.dryRun) {
      console.log(`[DRY RUN] Would generate: ${generatorPath}`);
      console.log(`  ${classes.filter((c) => c.hasGenerator).length} generators`);
    } else {
      writeFile(generatorPath, generatorContent);
    }
  }

  // Generate analyzers
  if (options.analyzers) {
    const analyzerDir = join(baseDir, "analyzer");
    ensureDirectory(analyzerDir);
    const analyzerContent = generateAnalyzerFile(categoryName, classes);
    const analyzerPath = join(
      analyzerDir,
      `${categoryName.toLowerCase()}.ts`
    );

    if (options.dryRun) {
      console.log(`[DRY RUN] Would generate: ${analyzerPath}`);
      console.log(`  ${classes.filter((c) => c.hasAnalyzer).length} analyzers`);
    } else {
      writeFile(analyzerPath, analyzerContent);
    }
  }
};

// ============================================================================
// Entry Point
// ============================================================================

const main = (): void => {
  const options = parseArgs();
  const specs = loadClassSpecs();

  console.log(`Graph Class Code Generator v${specs.metadata.version}`);
  console.log(`Total classes: ${specs.metadata.totalClasses}`);
  console.log(`Categories: ${specs.metadata.categories.join(", ")}`);

  if (options.category) {
    // Generate single category
    const category = specs.categories[options.category];
    if (!category) {
      console.error(`Unknown category: ${options.category}`);
      console.error(
        `Available: ${Object.keys(specs.categories).join(", ")}`
      );
      process.exit(1);
    }
    generateForCategory(options.category, category, options);
  } else {
    // Generate all categories
    for (const [name, category] of Object.entries(specs.categories)) {
      generateForCategory(name, category, options);
    }
  }

  console.log("\n✅ Generation complete!");
  if (options.dryRun) {
    console.log("(Dry run - no files were written)");
  }
};

main();
