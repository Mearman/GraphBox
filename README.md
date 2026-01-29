# GraphBox

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

**GraphBox** = Graph Sandbox + Graph Toolbox

Abstract and experimental graph algorithms for academic research. The name reflects its dual purpose:

- **Sandbox** — A space for experimenting with graph algorithms, data structures, and traversal strategies
- **Toolbox** — A collection of reusable, well-tested graph utilities for production use

GraphBox provides a toolkit for graph manipulation, analysis, and generation, specifically designed for academic research in graph theory, network science, and citation analysis.

## Overview

GraphBox consolidates three previously separate BibGraph packages into a single, focused package:

- **graph-core**: Core graph interfaces and adapters
- **graph-expansion**: Graph expansion, traversal algorithms, and neighborhood exploration
- **graph-gen**: Graph specification, generation, and validation system

## Installation

```bash
pnpm install graphbox
```

## Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm typecheck            # TypeScript type checking
pnpm lint                 # ESLint with auto-fix
pnpm test                 # Run unit tests with coverage
pnpm build                # Build library + CLI

# Experiments (high memory required)
NODE_OPTIONS="--max-old-space-size=8192" pnpm test:metrics    # Run experiments, generate metrics
pnpm gen:latex-tables                                     # Generate LaTeX tables from metrics
pnpm update:thesis-tables                                  # Full: experiments + LaTeX table generation

# Standalone experiment orchestrator
npx tsx src/experiments/run-experiments.ts                 # Run all experiments
npx tsx src/experiments/run-experiments.ts --output path   # Custom output path

# CLI
npx graphbox help       # Show available commands
npx graphbox version    # Show version
npx graphbox generate   # Generate graphs from specifications
npx graphbox analyze    # Analyze graph properties
npx graphbox validate   # Validate graphs against constraints
```

## Key Features

### Graph Adapters

`GraphAdapter` provides a bridge between different graph implementations, allowing you to use generic algorithms with your specific graph data structures.

```typescript
import { GraphAdapter } from 'graphbox';

const adapter = new GraphAdapter(graph);
```

### Graph Traversal

Multiple traversal algorithms for exploring graph neighborhoods:

- **BFS** - Breadth-first search
- **DFS** - Depth-first search
- **Bidirectional BFS** - Optimized bidirectional search
- **Degree-Prioritized** - Expansion based on node degree
- **Priority Queue** - Custom priority-based expansion

```typescript
import { bfs, dfs, extractEgoNetwork } from 'graphbox';

const bfsResult = bfs(adapter, 'startNodeId');
const dfsResult = dfs(adapter, 'startNodeId');
```

### Graph Extraction

Extract ego networks and multi-source neighborhoods:

```typescript
const egoNetwork = extractEgoNetwork(adapter, {
  radius: 2,
  seedNodes: ['nodeId'],
});
```

### Graph Generation

Type-safe graph generation with mathematical constraint validation:

```typescript
import { generateGraph, validateGraph } from 'graphbox';

const spec = {
  type: 'complete',
  nodeCount: 100,
  edgeDensity: 0.1,
  constraints: {
    minDegree: 2,
    maxDegree: 10,
    connected: true
  }
};

const graph = generateGraph(spec);
const valid = validateGraph(graph, spec.constraints);
```

### Graph Validation

Mathematical constraint validation for graph properties:

```typescript
import { validateGraph, checkConstraints } from 'graphbox';

const isValid = validateGraph(graph, constraints);
```

## Architecture

### Experiment Framework

The evaluation harness provides **reusable, repeatable, reproducible** experiments:

1. **`src/experiments/run-experiments.ts`** - Orchestrator that runs all experiments
2. **`src/experiments/metrics/`** - Typed metrics collection system
   - `types.ts` - All metric type interfaces (must conform for table generation)
   - `collector.ts` - `MetricsCollector` class for recording metrics
   - `storage.ts` - File I/O for `test-metrics.json`
3. **`src/experiments/experiments/`** - Standalone experiment scripts
   - `bidirectional-bfs.ts` - Degree-Prioritised vs baselines
   - `seeded-expansion.ts` - N=1 ego-network, N=2 bidirectional, N>=3 multi-seed
   - `path-ranking.ts` - Path Salience Ranking with MI-based ranking

4. **`scripts/export-csv.ts`** - Exports metrics as per-category CSV files for pgfplotstable

**Pipeline:** Experiments → MetricsCollector → test-metrics.json → CSV files → LaTeX pgfplotstable

### Three Algorithms Evaluated

1. **Seeded Node Expansion**
   - N=1: Ego-network extraction
   - N=2: Bidirectional path finding
   - N>=3: Multi-seed expansion

2. **Bidirectional BFS** (Degree-Prioritised Expansion)
   - Degree-based prioritisation vs standard BFS, frontier-balanced, random priority
   - Hub explosion mitigation

3. **Salient Path Selection**
   - Mutual Information (MI) based path ranking
   - Statistical significance testing (Mann-Whitney U, Cohen's d)

### Graph Abstraction

- **`ReadableGraph<N, E>`** - Minimal interface for graph traversal
- **`GraphAdapter`** - Adapter pattern for different graph implementations
- **`GraphExpander`** - Interface for dynamic graph expansion (used by algorithms)
- **`BenchmarkGraphExpander`** - Wraps loaded benchmark graphs for algorithm compatibility

### Path Aliases

TypeScript paths configured in `tsconfig.json`:
```typescript
@graph/algorithms/*    → src/algorithms/*
@graph/interfaces/*    → src/interfaces/*
@graph/evaluation/*    → src/experiments/evaluation/*
@graph/experiments/*   → src/experiments/*
```

### Test Organization

- **`.exp.integration.test.ts`** - Experiment tests (high memory, use `--max-old-space-size=8192`)
- **Unit tests** - Co-located with algorithms
- **Benchmarks** - `src/experiments/evaluation/__tests__/validation/*/benchmarks/`
- **Fixtures** - `src/experiments/evaluation/__tests__/validation/*/fixtures/`

## Build System

**Dual build targets** via Vite:
- **Library**: ES modules, CJS, UMD formats (browser-compatible)
- **CLI**: ESM-only for Node.js command-line interface

## API Reference

### Core Classes

- **GraphAdapter** - Adapter pattern for graph abstraction
- **GraphExpander** - Interface for dynamic graph expansion
- **PriorityQueue** - Priority queue for degree-based expansion

### Traversal Algorithms

- **bfs(adapter, startNodeId, options?)** - Breadth-first search
- **dfs(adapter, startNodeId, options?)** - Depth-first search
- **BidirectionalBFS** - Bidirectional BFS search

### Extraction Methods

- **extractEgoNetwork(adapter, options)** - Extract ego-centered subgraph
- **extractMultiSourceEgoNetwork(adapter, options)** - Multi-source extraction

### Generation Functions

- **generateGraph(spec)** - Generate graph from specification
- **validateGraph(graph, constraints)** - Validate graph against constraints

## Key Constraints

- **Never use `any`** - Use `unknown` with type guards
- **Serial test execution** - Parallel causes OOM on large graphs
- **Memory limits** - Use `NODE_OPTIONS="--max-old-space-size=8192"` for experiments
- **Metric types** - All metrics must conform to types in `src/experiments/metrics/types.ts`

## LaTeX Table Generation

The experiment pipeline can generate LaTeX tables (`.tex` files) consumable by `pgfplotstable`.

Table-to-metric mapping:
| Table | Metric Category |
|-------|-----------------|
| 06-runtime-performance.tex | runtime-performance |
| 06-path-lengths.tex | path-lengths |
| 06-scalability.tex | scalability |
| 06-n-seed-hub-traversal.tex | n-seed-hub-traversal |
| 06-statistical-significance.tex | statistical-significance |
| 06-cross-dataset.tex | cross-dataset |
| 06-method-ranking.tex | method-ranking |
| 06-structural-representativeness.tex | structural-representativeness |
| 06-n-seed-generalisation.tex | n-seed-generalization |
| 06-n-seed-comparison.tex | n-seed-comparison |
| 06-n-seed-path-diversity.tex | n-seed-path-diversity |
| 06-structural-representativeness-metrics.tex | structural-representativeness-metrics |
| 06-mi-ranking-quality.tex | mi-ranking-quality |

## Contributing

This package is part of academic research work. Contributions are welcome, please open an issue first.

## License

MIT

## Author

Joe Mearman

## Related Projects

- **[BibGraph](https://github.com/Mearman/BibGraph)** - React SPA for OpenAlex literature discovery
