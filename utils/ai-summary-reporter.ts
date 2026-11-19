import type { Reporter, FullResult, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface FailedTestInfo {
  title: string;
  file: string;
  error: string;
}

interface FailureAnalysisItem {
  specAndScenario: string;
  category: string;
  analysis: string;
  recommendedFix: string;
}

class AISummaryReporter implements Reporter {
  private failedTests: FailedTestInfo[] = [];
  private passedTests: string[] = [];

  private getApiKey(): string | undefined {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8').replace(/\u0000/g, '');
      const match = content.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
      if (match) {
        return match[1].replace(/["'\s]/g, '');
      }
    }

    if (process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY.replace(/["'\s]/g, '');
    }

    return undefined;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const fileName = path.basename(test.location.file);

    if (result.status === 'passed') {
      this.passedTests.push(`${fileName} - ${test.title}`);
    } else if (result.status === 'failed' || result.status === 'timedOut') {
      const rawError = result.error?.message || 'Unknown error';
      const cleanError = rawError
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/(token|password|authorization)["':=\s]+[^\s"']+/gi, '$1=***')
        .slice(0, 800);

      this.failedTests.push({
        title: test.title,
        file: fileName,
        error: cleanError,
      });
    }
  }

  async onEnd(result: FullResult) {
    const allureDir = path.resolve(process.cwd(), 'allure-results');
    if (!fs.existsSync(allureDir)) fs.mkdirSync(allureDir, { recursive: true });

    const passedCount = this.passedTests.length;

    if (this.failedTests.length === 0) {
      const zeroFailDesc = `Release Status: GO (${passedCount}/${passedCount} Tests Passed - 100%)\nAll test flows executed smoothly with zero failures.`;

      this.writeAllureOutputs(
        allureDir,
        `GO - All ${passedCount} tests passed (100%)`,
        'No failures detected',
        zeroFailDesc,
        []
      );
      return;
    }

    const summary = await this.getAISummaryWithFallback();
    this.writeAllureOutputs(
      allureDir,
      summary.envSummary,
      summary.envRootCause,
      summary.overviewDescription,
      summary.items
    );
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getAISummaryWithFallback() {
    const apiKey = this.getApiKey();
    const passedCount = this.passedTests.length;
    const totalFailed = this.failedTests.length;
    const totalTests = passedCount + totalFailed;
    const passRate = totalTests > 0 ? ((passedCount / totalTests) * 100).toFixed(1) : '0';
    const sampleErrors = this.failedTests.slice(0, 15);

    if (!apiKey) {
      return this.buildFallbackSummary('No API Key configured');
    }

    const prompt = `You are a Senior QA Automation Engineer. Analyze ${totalFailed} failures out of ${totalTests} total Playwright tests (Pass rate: ${passRate}%).
Provide accurate, factual, and specific engineering insights in English based strictly on the provided logs. Do not use any emojis.

STRICT ANALYSIS RULES:
1. Base your diagnosis ONLY on facts present in "Failed Tests" and "Passed Tests". Never invent or guess causes not supported by the error message (for example, do NOT blame "slow server response", "database seeding", or "network idle" unless the error explicitly states a network or API failure).
2. Compare against "Passed Tests": if standard login or checkout tests in other specs passed, the core feature/backend is working—the failure is isolated to that specific scenario's test data, locator, or UI overlay/popup blocking the element.
3. Each test in Playwright runs independently unless stated otherwise; do NOT assume a test failed because another separate test failed.
4. Keep "analysis" and "recommendedFix" concise (1-2 sharp sentences) and directly tied to the exact locator or assertion in the error log.

Return ONLY valid JSON with these 4 keys:
1. "envSummary": 1 concise sentence stating the HOLD status, pass rate, and primary broken scenarios.
2. "envRootCause": 1 concise sentence summarizing the exact root cause categories across the suite.
3. "impactSummary": 1-2 sentences explaining the actual scope of the failures without exaggerating if core flows passed in other specs.
4. "items": Array of objects for each failed scenario with these exact 4 string keys:
  - "specAndScenario": Format as "filename.spec.ts - Test Scenario Name"
  - "category": One of "Product Bug", "Test Data", "Locator", "UI Overlay", or "Timeout"
  - "analysis": 1-2 factual sentences explaining what exact locator/assertion failed and why based strictly on the error message and passed specs context.
  - "recommendedFix": 1-2 concrete, specific technical steps to fix the exact failing locator, test data, or overlay.

Passed Tests (for context):
${JSON.stringify(this.passedTests, null, 2)}

Failed Tests:
${JSON.stringify(sampleErrors, null, 2)}`;

    const models = ['gemini-3.5-flash-lite', 'gemini-2.5-flash'];
    let lastReason = 'Unknown Error';

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
              signal: AbortSignal.timeout(25000),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) throw new Error('Empty response');

            const parsed = JSON.parse(rawText);
            const overviewDescription = `Release Status: HOLD (${passedCount}/${totalTests} Passed - ${passRate}%)\n\nImpact Summary: ${parsed.impactSummary}`;

            return {
              envSummary: parsed.envSummary,
              envRootCause: parsed.envRootCause,
              overviewDescription,
              items: (parsed.items || []) as FailureAnalysisItem[],
            };
          }

          lastReason = `API Error HTTP ${response.status} (${model})`;
          const errBody = await response.text();
          console.warn(`[AISummaryReporter] ${model} attempt ${attempt} failed (${response.status}):`, errBody);

          if (response.status === 503 || response.status === 429 || response.status === 500) {
            await this.sleep(2500 * attempt);
            continue;
          }

          return this.buildFallbackSummary(lastReason);
        } catch (err: any) {
          lastReason = err?.name === 'TimeoutError' ? 'Request Timeout (>25s)' : (err?.message || 'Network Unreachable');
          if (attempt < 2) {
            await this.sleep(2500 * attempt);
            continue;
          }
        }
      }
    }

    return this.buildFallbackSummary(lastReason);
  }

  private buildFallbackSummary(reason: string) {
    const firstError = this.failedTests[0];
    const passedCount = this.passedTests.length;
    const totalTests = passedCount + this.failedTests.length;
    const passRate = totalTests > 0 ? ((passedCount / totalTests) * 100).toFixed(1) : '0';

    const items: FailureAnalysisItem[] = this.failedTests.map((t) => ({
      specAndScenario: `${t.file} - ${t.title}`,
      category: 'Fallback Raw Error',
      analysis: t.error.split('\n')[0],
      recommendedFix: 'Check full test trace/screenshot in the respective test suite.',
    }));

    return {
      envSummary: `HOLD - ${this.failedTests.length} test(s) failed (${reason})`,
      envRootCause: `${firstError.file}: ${firstError.error.split('\n')[0].slice(0, 80)}`,
      overviewDescription: `Fallback Mode Active (${reason})\nRelease Status: HOLD (${passedCount}/${totalTests} Passed - ${passRate}%)`,
      items,
    };
  }

  private writeAllureOutputs(
    allureDir: string,
    envSummary: string,
    envRootCause: string,
    overviewDescription: string,
    items: FailureAnalysisItem[]
  ) {
    const envPath = path.join(allureDir, 'environment.properties');
    let existingEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    existingEnv = existingEnv
      .split('\n')
      .filter((line) => !line.startsWith('AI_Summary=') && !line.startsWith('AI_Root_Cause='))
      .filter((line) => !line.startsWith('AI_PM_Summary=') && !line.startsWith('AI_Dev_Root_Cause='))
      .join('\n');

    const newEnvLines = `${existingEnv.trim()}\nAI_Summary=${envSummary.replace(/[\r\n=]+/g, ' ')}\nAI_Root_Cause=${envRootCause.replace(/[\r\n=]+/g, ' ')}\n`;
    fs.writeFileSync(envPath, newEnvLines.trim() + '\n');

    const uuid = crypto.randomUUID();
    const now = Date.now();

    const executionSteps = items.map((item, idx) => ({
      name: `${item.specAndScenario}  [${item.category}]`,
      status: 'failed',
      stage: 'finished',
      start: now + idx,
      stop: now + idx + 1,
      steps: [
        {
          name: `Analysis: ${item.analysis}`,
          status: 'passed',
          stage: 'finished',
          start: now + idx,
          stop: now + idx + 1,
        },
        {
          name: `Recommended Fix: ${item.recommendedFix}`,
          status: 'passed',
          stage: 'finished',
          start: now + idx,
          stop: now + idx + 1,
        },
      ],
    }));

    const virtualResult = {
      uuid,
      historyId: 'ai-summary-virtual-test',
      name: 'AI Summary',
      fullName: 'AI Summary',
      status: 'unknown',
      stage: 'finished',
      description: overviewDescription,
      steps: executionSteps,
      start: now,
      stop: now + items.length + 1,
      labels: [
        { name: 'epic', value: 'Web Automation' },
        { name: 'suite', value: 'AI Summary' },
        { name: 'feature', value: 'AI Analysis' },
      ],
    };

    fs.writeFileSync(path.join(allureDir, `${uuid}-result.json`), JSON.stringify(virtualResult, null, 2));
  }
}

export default AISummaryReporter;