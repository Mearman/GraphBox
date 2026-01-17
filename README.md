# GraphBox

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

## CLI

```bash
npx graphbox help       # Show available commands
npx graphbox version    # Show version
npx graphbox generate   # Generate a graph from a specification
npx graphbox analyze    # Analyze graph properties
npx graphbox validate   # Validate a graph against constraints
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

## Usage Examples

### Basic Traversal

```typescript
import { GraphAdapter, bfs } from 'graphbox';

const graph = { /* your graph */ };
const adapter = new GraphAdapter(graph);

const result = bfs(adapter, 'startNodeId');
console.log(result.visited); // Array of visited node IDs
```

### Ego Network Extraction

```typescript
import { extractEgoNetwork } from 'graphbox';

const adapter = new GraphAdapter(graph);

const egoNetwork = extractEgoNetwork(adapter, {
  radius: 2,
  seedNodes: ['author123'],
  includeEdgeWeights: true
});

console.log(egoNetwork);
```

### Graph Generation

```typescript
import { generateGraph, GraphSpec } from 'graphbox';

const spec: GraphSpec = {
  type: 'complete',
  nodeCount: 50,
  edgeDensity: 0.15
};

const graph = generateGraph(spec);
```

### Graph Validation

```typescript
import { validateGraph } from 'graphbox';

const graph = { /* graph object */ };
const isValid = validateGraph(graph);
```

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

## Contributing

This package is part of academic research work. Contributions are welcome, please open an issue first.

## License

MIT

## Author

Joe Mearman

## Related Projects

- **BibGraph**: Main BibGraph monorepo
- **algorithms**: Graph algorithms package for BibGraph
- **types**: Shared TypeScript types for BibGraph
