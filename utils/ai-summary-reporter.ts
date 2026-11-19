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
  private passedCount = 0;

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
    if (result.status === 'passed') {
      this.passedCount++;
    } else if (result.status === 'failed' || result.status === 'timedOut') {
      const rawError = result.error?.message || 'Unknown error';
      const cleanError = rawError
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/(token|password|authorization)["':=\s]+[^\s"']+/gi, '$1=***')
        .slice(0, 800);

      this.failedTests.push({
        title: test.title,
        file: path.basename(test.location.file),
        error: cleanError,
      });
    }
  }

  async onEnd(result: FullResult) {
    const allureDir = path.resolve(process.cwd(), 'allure-results');
    if (!fs.existsSync(allureDir)) fs.mkdirSync(allureDir, { recursive: true });

    if (this.failedTests.length === 0) {
      const zeroFailDesc = `Release Status: GO (${this.passedCount}/${this.passedCount} Tests Passed - 100%)\nAll test flows executed smoothly with zero failures.`;

      this.writeAllureOutputs(
        allureDir,
        `GO - All ${this.passedCount} tests passed (100%)`,
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
    const totalFailed = this.failedTests.length;
    const totalTests = this.passedCount + totalFailed;
    const passRate = totalTests > 0 ? ((this.passedCount / totalTests) * 100).toFixed(1) : '0';
    const sampleErrors = this.failedTests.slice(0, 15);

    if (!apiKey) {
      return this.buildFallbackSummary('No API Key configured');
    }

    const prompt = `You are a Senior QA Automation Engineer. Analyze ${totalFailed} failures out of ${totalTests} total Playwright tests (Pass rate: ${passRate}%).
Provide thorough, practical, and specific engineering insights in English. Do not use any emojis.

Return ONLY valid JSON with these 4 keys:
1. "envSummary": 1 concise sentence stating the HOLD status, pass rate, and primary broken features.
2. "envRootCause": 1 concise sentence summarizing the root cause categories across the suite.
3. "impactSummary": 2 sentences explaining which end-to-end user journeys are blocked and the business/release risk.
4. "items": Array of objects for each failed scenario (or tightly related group) with these exact 4 string keys:
   - "specAndScenario": Format as "filename.spec.ts - Test Scenario Name"
   - "category": One of "Product Bug", "Test Data", "Locator", or "Timeout"
   - "analysis": 2-3 detailed sentences explaining specifically what failed (mention the exact locator, assertion, or timeout behavior from the log), why it likely occurred (e.g., preceding login step failed, DOM changed, slow page load, or backend validation issue), and how it affects downstream steps.
   - "recommendedFix": 2-3 actionable, specific steps for QA or Developers (e.g., exact selector to inspect, prerequisite state/auth check, wait strategy, or API/DB verification).

Test Failure Data:
${JSON.stringify(sampleErrors, null, 2)}`;

    // Coba model utama, lalu otomatis pindah ke model cadangan jika 503/429
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
            const overviewDescription = `Release Status: HOLD (${this.passedCount}/${totalTests} Passed - ${passRate}%)\n\nImpact Summary: ${parsed.impactSummary}`;

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

          // Jika error 400/401/403 (masalah API key), langsung hentikan retry
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
    const totalTests = this.passedCount + this.failedTests.length;
    const passRate = totalTests > 0 ? ((this.passedCount / totalTests) * 100).toFixed(1) : '0';

    const items: FailureAnalysisItem[] = this.failedTests.map((t) => ({
      specAndScenario: `${t.file} - ${t.title}`,
      category: 'Fallback Raw Error',
      analysis: t.error.split('\n')[0],
      recommendedFix: 'Check full test trace/screenshot in the respective test suite.',
    }));

    return {
      envSummary: `HOLD - ${this.failedTests.length} test(s) failed (${reason})`,
      envRootCause: `${firstError.file}: ${firstError.error.split('\n')[0].slice(0, 80)}`,
      overviewDescription: `Fallback Mode Active (${reason})\nRelease Status: HOLD (${this.passedCount}/${totalTests} Passed - ${passRate}%)`,
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
      status: 'passed',
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