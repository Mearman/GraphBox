#!/usr/bin/env node
/**
 * GraphBox CLI
 *
 * Command-line interface for graph generation, analysis, and validation.
 *
 * Usage:
 *   npx graphbox <command> [options]
 *
 * Commands:
 *   generate  Generate a graph from a specification
 *   analyze   Analyze graph properties
 *   validate  Validate a graph against constraints
 *   version   Show version information
 */

import * as process from "node:process";

import { runAnalyze } from "./cli-commands/analyze";
import { runGenerate } from "./cli-commands/generate";
import { runValidate } from "./cli-commands/validate";
import { parseArgs as parseArguments } from "./cli-utils/arg-parser";

declare const __VERSION__: string;
const VERSION = __VERSION__;

interface Command {
	name: string;
	description: string;
	run: (arguments_: string[]) => void;
}

const commands: Record<string, Command> = {
	version: {
		name: "version",
		description: "Show version information",
		run: () => {
			console.log(`graphbox v${VERSION}`);
		},
	},
	help: {
		name: "help",
		description: "Show help information",
		run: () => {
			console.log("GraphBox - Graph Sandbox + Graph Toolbox\n");
			console.log("Usage: graphbox <command> [options]\n");
			console.log("Commands:");
			for (const cmd of Object.values(commands)) {
				console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
			}
			console.log("\nFor more information, visit: https://github.com/Mearman/GraphBox");
		},
	},
	generate: {
		name: "generate",
		description: "Generate a graph from a specification",
		run: (arguments_: string[]) => {
			const arguments__ = parseArguments(arguments_);
			runGenerate(arguments__);
		},
	},
	analyze: {
		name: "analyze",
		description: "Analyze graph properties",
		run: (arguments_: string[]) => {
			const arguments__ = parseArguments(arguments_);
			runAnalyze(arguments__);
		},
	},
	validate: {
		name: "validate",
		description: "Validate a graph against constraints",
		run: (arguments_: string[]) => {
			const arguments__ = parseArguments(arguments_);
			runValidate(arguments__);
		},
	},
};

const main = (): void => {
	const arguments_ = process.argv.slice(2);
	const commandName = arguments_[0] ?? "help";
	const commandArguments = arguments_.slice(1);

	const command = commands[commandName];
	if (command) {
		command.run(commandArguments);
	} else {
		console.error(`Unknown command: ${commandName}`);
		console.error("Run 'graphbox help' for usage information.");
		process.exit(1);
	}
};

main();
