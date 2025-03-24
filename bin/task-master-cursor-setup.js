#!/usr/bin/env node

/**
 * Task Master Cursor Integration Setup
 * Sets up Cursor to recognize /task commands
 */

import { setupCursorIntegration } from "../lib/cursor-mcp-setup.js";
import chalk from "chalk";
import boxen from "boxen";

async function main() {
  console.log(
    boxen(chalk.cyan.bold("Task Master Cursor Integration Setup"), {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
    })
  );

  console.log(
    chalk.blue(
      "This will configure Cursor to recognize /task commands directly in chat"
    )
  );
  console.log(
    chalk.blue(
      "It will create or update the .cursor/settings.json file in your project directory"
    )
  );
  console.log();

  try {
    const success = await setupCursorIntegration();

    if (success) {
      console.log();
      console.log(
        boxen(
          chalk.green("✅ Setup Complete!") +
            "\n\n" +
            chalk.white("You can now use commands like:") +
            "\n" +
            chalk.yellow("/task list") +
            "\n" +
            chalk.yellow("/task next") +
            "\n" +
            chalk.yellow("/task show 3") +
            "\n" +
            chalk.white("directly in your Cursor chat"),
          {
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "round",
            borderColor: "green",
          }
        )
      );
    } else {
      console.log(
        boxen(chalk.red("❌ Setup Failed"), {
          padding: 1,
          margin: { top: 1, bottom: 1 },
          borderStyle: "round",
          borderColor: "red",
        })
      );
    }
  } catch (error) {
    console.error(chalk.red("Error during setup:"), chalk.red(error.message));
    process.exit(1);
  }
}

main();
