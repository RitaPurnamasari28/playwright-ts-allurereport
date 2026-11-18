import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface FailedTestInfo {
  title: string;
  file: string;
  executedSteps: string[];
  error: string;
  domSnapshot?: string;
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
      if (match) return match[1].replace(/["'\s]/g, '');
    }

    return process.env.GEMINI_API_KEY?.replace(/["'\s]/g, '');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const fileName = path.basename(test.location.file);

    if (result.status === 'passed') {
      this.passedTests.push(`${fileName} - ${test.title}`);
    } else if ((result.status === 'failed' || result.status === 'timedOut') && result.retry === test.retries) {
      const cleanError = (result.error?.message || 'Unknown error')
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/(token|password|authorization)["':=\s]+[^\s"']+/gi, '$1=***')
        .slice(0, 1000);

      const allActionSteps: string[] = [];
      const collectSteps = (steps: TestResult['steps']) => {
        for (const s of steps) {
          if (s.category === 'test.step' || s.category === 'pw:api') {
            allActionSteps.push(`${s.title} (${s.error ? 'FAILED' : 'PASSED'})`);
          }
          if (s.steps?.length) collectSteps(s.steps);
        }
      };
      collectSteps(result.steps);

      let domSnapshot: string | undefined;
      const contextAttachment = result.attachments.find(
        (a) => (a.name === 'error-context' || a.contentType === 'text/markdown') && a.path && fs.existsSync(a.path)
      );
      if (contextAttachment?.path) {
        domSnapshot = fs
          .readFileSync(contextAttachment.path, 'utf-8')
          .replace(/(token|password|authorization)["':=\s]+[^\s"']+/gi, '$1=***')
          .replace(/\n\s*\n/g, '\n')
          .trim()
          .slice(0, 3500);
      }

      this.failedTests.push({
        title: test.title,
        file: fileName,
        executedSteps: allActionSteps.slice(-6),
        error: cleanError,
        domSnapshot,
      });
    }
  }

  async onEnd() {
    const allureDir = path.resolve(process.cwd(), 'allure-results');
    if (!fs.existsSync(allureDir)) fs.mkdirSync(allureDir, { recursive: true });

    const passedCount = this.passedTests.length;

    if (this.failedTests.length === 0) {
      this.writeAllureOutputs(
        allureDir,
        `GO - All ${passedCount} tests passed (100%)`,
        'No failures detected',
        `Release Status: GO (${passedCount}/${passedCount} Tests Passed - 100%)\nAll test flows executed smoothly with zero failures.`,
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

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getAISummaryWithFallback() {
    const apiKey = this.getApiKey();
    const totalFailed = this.failedTests.length;
    const passedCount = this.passedTests.length;
    const totalTests = passedCount + totalFailed;
    const passRate = totalTests > 0 ? ((passedCount / totalTests) * 100).toFixed(1) : '0';
    const sampleErrors = this.failedTests.slice(0, 15);

    if (!apiKey) {
      return this.buildFallbackSummary('No API Key configured');
    }

    const prompt = `You are a Principal QA Automation Engineer reviewing a Playwright test run (${passedCount} passed, ${totalFailed} failed, Pass rate: ${passRate}%).
Analyze each failure accurately using the error log, executed steps, and the captured page DOM snapshot ("domSnapshot").

CRITICAL RULES:
1. READ "domSnapshot" CAREFULLY! It shows the exact URL and UI elements rendered when the test failed. Check if a search keyword returned zero products, if a login/checkout modal blocked the flow, or if a validation message appeared on screen.
2. Correlate "domSnapshot" with "executedSteps". If a search returned empty results, categorize as "Test Data / Auth" (invalid search keyword) rather than "Locator". If a checkout failed on a login modal, point out the unauthenticated session.
3. Check for cascading failures across tests (e.g., if deleteAccount.spec.ts passed, it likely deleted the shared user needed by login/products tests).
4. Only group failures if they truly share the EXACT same root cause.
5. Never give generic advice like "increase timeout" or "add networkidle" unless it is strictly a network error like ERR_CONNECTION_RESET.
6. Keep every sentence short, direct, and crystal-clear. Do not use any emojis.

Return ONLY valid JSON with these 4 keys:
1. "envSummary": Max 12 words stating HOLD status, pass rate, and main broken flow.
2. "envRootCause": Max 12 words summarizing the primary root cause.
3. "impactSummary": 1 short sentence explaining which user journeys are blocked and the release risk.
4. "items": Array of objects with these exact 4 string keys:
   - "specAndScenario": "filename.spec.ts - Scenario Name"
   - "category": One of "Test Data / Auth", "UI Overlay / Popup", "Locator", "Product Bug", or "Network / Timeout"
   - "analysis": 1 short, clear sentence combining what the page snapshot/logs show and why the step failed.
   - "recommendedFix": 1 short, actionable sentence on how to fix that specific root cause.

Passed Tests:
${JSON.stringify(this.passedTests, null, 2)}

Failed Tests:
${JSON.stringify(sampleErrors, null, 2)}`;

    const models = ['gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
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
            return {
              envSummary: parsed.envSummary,
              envRootCause: parsed.envRootCause,
              overviewDescription: `Release Status: HOLD (${passedCount}/${totalTests} Passed - ${passRate}%)\n\nImpact Summary: ${parsed.impactSummary}`,
              items: (parsed.items || []) as FailureAnalysisItem[],
            };
          }

          lastReason = `API Error HTTP ${response.status} (${model})`;
          if (response.status === 404) break;
          if (response.status === 503 || response.status === 429 || response.status === 500) {
            await this.sleep(2500 * attempt);
            continue;
          }

          return this.buildFallbackSummary(lastReason);
        } catch (err: any) {
          const causeMsg = err?.cause?.code || err?.cause?.message || '';
          lastReason =
            err?.name === 'TimeoutError'
              ? 'Request Timeout (>25s)'
              : `${err?.message || 'Network Unreachable'}${causeMsg ? ` (${causeMsg})` : ''}`;
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

    const items: FailureAnalysisItem[] = this.failedTests.map((t) => {
      const lastStep = t.executedSteps.length > 0 ? t.executedSteps[t.executedSteps.length - 1] : 'Test body';
      return {
        specAndScenario: `${t.file} - ${t.title}`,
        category: 'Fallback Raw Error',
        analysis: `Failed at "${lastStep}": ${t.error.split('\n')[0]}`,
        recommendedFix: 'Check full test trace/screenshot in the respective test suite.',
      };
    });

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
    const existingEnv = fs.existsSync(envPath)
      ? fs
          .readFileSync(envPath, 'utf-8')
          .split('\n')
          .filter((line) => !line.startsWith('AI_Summary=') && !line.startsWith('AI_Root_Cause='))
          .join('\n')
      : '';

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