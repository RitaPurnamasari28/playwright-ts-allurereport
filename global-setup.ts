import fs from 'fs';
import path from 'path';

async function globalSetup() {
  const allureResultsDir = path.join(process.cwd(), 'allure-results');

  if (!fs.existsSync(allureResultsDir)) {
    fs.mkdirSync(allureResultsDir, { recursive: true });
  }

  // 1. Setup Environment
  const envProps = `
Environment=${process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Local PC'}
OS=${process.platform}
Node_Version=${process.version}
Base_URL=https://automationexercise.com/
  `.trim();
  fs.writeFileSync(path.join(allureResultsDir, 'environment.properties'), envProps);

  // 2. Setup Executor
  let executorInfo: any = {
    name: "Local Execution",
    type: "local",
    reportName: "Automation Test Report"
  };

  if (process.env.GITHUB_ACTIONS) {
    executorInfo = {
      name: "GitHub Actions",
      type: "github",
      reportName: "Automation Test Report",
      buildName: `Run #${process.env.GITHUB_RUN_NUMBER}`,
      buildOrder: parseInt(process.env.GITHUB_RUN_NUMBER || '0'),
      buildUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    };
  }
  fs.writeFileSync(path.join(allureResultsDir, 'executor.json'), JSON.stringify(executorInfo, null, 2));
}

export default globalSetup;