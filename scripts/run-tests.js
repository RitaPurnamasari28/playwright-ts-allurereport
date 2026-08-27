const { spawnSync } = require("child_process");

console.log("Running Playwright Tests...");

const result = spawnSync("npx", ["playwright", "test"], {
  stdio: "inherit",
  shell: true,
});

console.log("\nGenerating Allure Report...");

const allureResult = spawnSync(
  "npx",
  [
    "allure",
    "generate",
    "allure-results",
    "--clean",
    "-o",
    "allure-report",
  ],
  {
    stdio: "inherit",
    shell: true,
  }
);

if (allureResult.status !== 0) {
  console.error("Failed to generate Allure Report");
}

process.exit(result.status);