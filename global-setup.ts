import fs from 'fs';
import path from 'path';

async function globalSetup() {
  const allureResultsDir = path.join(process.cwd(), 'allure-results');
  if (!fs.existsSync(allureResultsDir)) {
    fs.mkdirSync(allureResultsDir, { recursive: true });
  }

  // Histroy for local run.
  const reportHistoryDir = path.join(process.cwd(), 'allure-report', 'history');
  const resultsHistoryDir = path.join(allureResultsDir, 'history');
  if (fs.existsSync(reportHistoryDir)) {
    if (!fs.existsSync(resultsHistoryDir)) {
      fs.mkdirSync(resultsHistoryDir, { recursive: true });
    }
    fs.cpSync(reportHistoryDir, resultsHistoryDir, { recursive: true });
  }

  // 1. date time
  const now = new Date();
  const formattedDate = now.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar'
  });

  // 2. Env info
  const envProps = `
Environment=${process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Local PC'}
OS=${process.platform}
Node_Version=${process.version}
Execution_Time=${formattedDate}
Base_URL=https://automationexercise.com/
  `.trim();
  fs.writeFileSync(path.join(allureResultsDir, 'environment.properties'), envProps);

  // 3. Setup Executor
  const isGitHub = !!process.env.GITHUB_ACTIONS;
  const runNumber = process.env.GITHUB_RUN_NUMBER || '0';
  const runId = process.env.GITHUB_RUN_ID || '';
  const repo = process.env.GITHUB_REPOSITORY || '';

  // Unix Timestamp. prevent duplicate buildOrder
  const safeTimestamp = Math.floor(Date.now() / 1000); 

  const executorInfo = {
    name: isGitHub ? "GitHub Actions" : "Local Laptop",
    type: isGitHub ? "github" : "local",
    reportName: "Automation Test Report",
    buildName: isGitHub ? `Run #${runNumber}` : `Local Run`,
    buildOrder: isGitHub ? parseInt(runNumber, 10) : safeTimestamp, 
    buildUrl: repo ? `https://github.com/${repo}/actions/runs/${runId}` : ""
  };

  fs.writeFileSync(
    path.join(allureResultsDir, 'executor.json'),
    JSON.stringify(executorInfo, null, 2)
  );
}

export default globalSetup;