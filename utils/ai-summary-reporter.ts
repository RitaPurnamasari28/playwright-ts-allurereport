import {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  TestStep,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface RawAttachmentInfo {
  name: string;
  contentType: string;
  path?: string;
  bodyText?: string;
}

interface FailedTestContext {
  title: string;
  file: string;
  errorMessage: string;
  stackTrace: string;
  executedSteps: string[];
  domSnapshot: string;
  attachment?: RawAttachmentInfo;
}

interface AIAnalysisItem {
  testName: string;
  category:
    | 'Test Data / Auth'
    | 'UI Overlay / Popup'
    | 'Locator'
    | 'Product Bug'
    | 'Network / Timeout';
  rootCause: string;
  recommendedFix: string;
}

interface AISummaryResponse {
  releaseStatus: 'PASS' | 'CONDITIONAL PASS' | 'HOLD';
  impactSummary: string;
  analyses: AIAnalysisItem[];
}

export default class AISummaryReporter implements Reporter {
  private failedTests: FailedTestContext[] = [];
  private passedTests: string[] = [];
  private totalTests = 0;

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'skipped') return;

    const retryCount = test.retries;
    const isFinalAttempt =
      result.status === 'passed' || result.retry === retryCount;

    if (!isFinalAttempt) return;

    this.totalTests++;

    const fileName = path.basename(test.location.file);
    const fullTestName = `${fileName} - ${test.title}`;

    if (result.status === 'passed') {
      this.passedTests.push(fullTestName);
      return;
    }

    if (result.status === 'failed' || result.status === 'timedOut') {
      const rawError = result.error?.message || 'Unknown error occurred';
      const rawStack = result.error?.stack || '';
      const executedSteps = this.extractLastSubSteps(result.steps, 6);

      // Simpan referensi attachment saja di onTestEnd (tanpa fs.readFileSync saat tes berjalan)
      const contextAttachment = result.attachments.find(
        (att) =>
          att.name === 'error-context' ||
          (att.contentType === 'text/markdown' && Boolean(att.path))
      );

      const attachmentInfo: RawAttachmentInfo | undefined = contextAttachment
        ? {
            name: contextAttachment.name,
            contentType: contextAttachment.contentType,
            path: contextAttachment.path,
            bodyText: contextAttachment.body
              ? contextAttachment.body.toString('utf-8')
              : undefined,
          }
        : undefined;

      this.failedTests.push({
        title: test.title,
        file: fileName,
        errorMessage: this.sanitizeSensitiveData(
          this.stripAnsi(rawError).slice(0, 1000)
        ),
        stackTrace: this.sanitizeSensitiveData(
          this.stripAnsi(rawStack).slice(0, 800)
        ),
        executedSteps,
        domSnapshot: '',
        attachment: attachmentInfo,
      });
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const allureResultsDir = path.resolve(process.cwd(), 'allure-results');
    if (!fs.existsSync(allureResultsDir)) {
      fs.mkdirSync(allureResultsDir, { recursive: true });
    }

    const passedCount = this.passedTests.length;
    const passRate =
      this.totalTests > 0
        ? ((passedCount / this.totalTests) * 100).toFixed(1)
        : '0.0';

    if (this.failedTests.length === 0) {
      const successSummary: AISummaryResponse = {
        releaseStatus: 'PASS',
        impactSummary: `All ${this.totalTests} executed tests passed (${passRate}%). No regressions or blockers detected.`,
        analyses: [],
      };
      this.writeAllureResult(
        allureResultsDir,
        successSummary,
        passedCount,
        passRate,
        'AI Analysis Active'
      );
      this.updateEnvironmentProperties(allureResultsDir, 'Active (All Passed)');
      return;
    }

    // Baca file DOM snapshot secara aman setelah semua tes selesai
    for (const item of this.failedTests) {
      item.domSnapshot = this.resolveDomSnapshot(item.attachment);
      delete item.attachment;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallback = this.buildFallbackSummary(
        passedCount,
        passRate,
        'GEMINI_API_KEY is not configured'
      );
      this.writeAllureResult(
        allureResultsDir,
        fallback.summary,
        passedCount,
        passRate,
        fallback.modeLabel
      );
      this.updateEnvironmentProperties(allureResultsDir, fallback.modeLabel);
      return;
    }

    try {
      const { summary, usedModel } = await this.getAISummaryWithFallback(
        apiKey,
        passedCount,
        passRate
      );
      this.writeAllureResult(
        allureResultsDir,
        summary,
        passedCount,
        passRate,
        `AI Analysis (${usedModel})`
      );
      this.updateEnvironmentProperties(
        allureResultsDir,
        `Active (${usedModel})`
      );
    } catch (error: any) {
      const reason = error?.message || 'Unexpected AI API error';
      console.warn(`[AISummaryReporter] Fallback activated: ${reason}`);
      const fallback = this.buildFallbackSummary(
        passedCount,
        passRate,
        reason
      );
      this.writeAllureResult(
        allureResultsDir,
        fallback.summary,
        passedCount,
        passRate,
        fallback.modeLabel
      );
      this.updateEnvironmentProperties(allureResultsDir, fallback.modeLabel);
    }
  }

  private extractLastSubSteps(steps: TestStep[], limit: number): string[] {
    const flatSteps: string[] = [];

    const traverse = (stepList: TestStep[], depth = 0) => {
      if (depth > 8) return;
      for (const step of stepList) {
        if (step.steps && step.steps.length > 0) {
          traverse(step.steps, depth + 1);
        } else if (
          step.category === 'pw:api' ||
          step.category === 'test.step' ||
          step.category === 'expect'
        ) {
          const status = step.error ? 'FAILED' : 'PASSED';
          const cleanTitle = this.sanitizeSensitiveData(
            this.stripAnsi(step.title)
          );
          flatSteps.push(`${cleanTitle} (${status})`);
        }
      }
    };

    traverse(steps);
    return flatSteps.slice(-limit);
  }

  private resolveDomSnapshot(attachment?: RawAttachmentInfo): string {
    if (!attachment) {
      return 'No DOM snapshot available.';
    }

    try {
      let rawContent = '';
      if (attachment.bodyText) {
        rawContent = attachment.bodyText;
      } else if (attachment.path && fs.existsSync(attachment.path)) {
        rawContent = fs.readFileSync(attachment.path, 'utf-8');
      }

      if (!rawContent.trim()) {
        return 'Empty DOM snapshot.';
      }

      const cleaned = rawContent
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return this.sanitizeSensitiveData(cleaned.slice(0, 3500));
    } catch {
      return 'Failed to read DOM snapshot.';
    }
  }

  private async getAISummaryWithFallback(
    apiKey: string,
    passedCount: number,
    passRate: string
  ): Promise<{ summary: AISummaryResponse; usedModel: string }> {
    const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
    const errorLog: string[] = [];

    const prompt = this.buildPrompt(passedCount, passRate);

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(12000), // Batas tunggu maksimal 12 detik per request
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (!response.ok) {
          errorLog.push(`${model}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const rawText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = this.parseAIJson(rawText);

        return { summary: parsed, usedModel: model };
      } catch (err: any) {
        const msg =
          err?.name === 'TimeoutError'
            ? 'Request timeout (12s)'
            : err?.message || 'Network error';
        errorLog.push(`${model}: ${msg}`);
      }
    }

    throw new Error(errorLog.join(' | '));
  }

  private buildPrompt(passedCount: number, passRate: string): string {
    const payload = {
      executionStats: {
        total: this.totalTests,
        passed: passedCount,
        failed: this.failedTests.length,
        passRate: `${passRate}%`,
      },
      passedTests: this.passedTests,
      failedTests: this.failedTests,
    };

    return `You are a Principal QA Automation Engineer analyzing Playwright E2E test failures.
Analyze the execution payload below and return ONLY valid JSON matching the exact schema.

CRITICAL ANALYSIS RULES:
1. Read 'domSnapshot' literally before diagnosing. Verify what is actually rendered on screen (e.g., Cloudflare/bot verification challenge, login form, empty search container, modal overlay, or 404 page). Never hallucinate elements that are not in 'domSnapshot'.
2. Cross-reference 'executedSteps' (e.g., search query typed or button clicked) with 'domSnapshot' to detect functional or product bugs (such as empty results for valid search queries).
3. Check 'passedTests' to detect cascading failures (e.g., if 'deleteAccount.spec.ts' passed, subsequent tests using that shared account will fail authentication).
4. Categorize each failure strictly into one of:
   - "Test Data / Auth"
   - "UI Overlay / Popup"
   - "Locator"
   - "Product Bug"
   - "Network / Timeout"
5. Do NOT suggest generic advice like "increase timeout" or "wait for networkidle" unless 'errorMessage' explicitly shows a network reset or page load timeout.
6. Keep 'impactSummary', 'rootCause', and 'recommendedFix' concise, direct, actionable, and free of emojis.
7. Set 'releaseStatus' to "HOLD" if critical flows (auth, checkout, security blocks) fail or passRate < 85%, "CONDITIONAL PASS" if only minor isolated issues fail, or "PASS" if none fail.

REQUIRED JSON SCHEMA:
{
  "releaseStatus": "HOLD" | "CONDITIONAL PASS" | "PASS",
  "impactSummary": "1-2 sentences summarizing overall release readiness and primary blocker.",
  "analyses": [
    {
      "testName": "<file> - <title>",
      "category": "Test Data / Auth" | "UI Overlay / Popup" | "Locator" | "Product Bug" | "Network / Timeout",
      "rootCause": "1 concise sentence explaining the exact cause based on domSnapshot and steps.",
      "recommendedFix": "1 concise sentence with a concrete technical fix."
    }
  ]
}

EXECUTION PAYLOAD:
${JSON.stringify(payload, null, 2)}`;
  }

  private parseAIJson(rawText: string): AISummaryResponse {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!parsed.releaseStatus || !Array.isArray(parsed.analyses)) {
      throw new Error('Invalid JSON structure returned by AI');
    }
    return parsed as AISummaryResponse;
  }

  private buildFallbackSummary(
    passedCount: number,
    passRate: string,
    reason: string
  ): { summary: AISummaryResponse; modeLabel: string } {
    const analyses: AIAnalysisItem[] = this.failedTests.map((f) => {
      const lastStep =
        f.executedSteps[f.executedSteps.length - 1] || 'Unknown step';
      const firstLineError = f.errorMessage.split('\n')[0].slice(0, 180);

      return {
        testName: `${f.file} - ${f.title} [Fallback Raw Error]`,
        category: 'Network / Timeout',
        rootCause: `Failed at "${lastStep}": ${firstLineError}`,
        recommendedFix:
          'Inspect the error-context DOM snapshot, trace, and screenshot in the corresponding test entry.',
      };
    });

    return {
      modeLabel: `Fallback Mode Active (${reason})`,
      summary: {
        releaseStatus: 'HOLD',
        impactSummary: `${this.failedTests.length} of ${this.totalTests} tests failed (${passRate}% passed). Automated AI diagnosis was unavailable; raw failure diagnostics are listed below.`,
        analyses,
      },
    };
  }

  private writeAllureResult(
    allureResultsDir: string,
    summary: AISummaryResponse,
    passedCount: number,
    passRate: string,
    modeLabel: string
  ): void {
    const uuid = crypto.randomUUID();
    const now = Date.now();

    const steps = summary.analyses.map((item) => ({
      name: `${item.testName} [${item.category}]`,
      status: 'passed',
      stage: 'finished',
      start: now,
      stop: now + 1,
      steps: [
        {
          name: `Analysis: ${item.rootCause}`,
          status: 'passed',
          stage: 'finished',
          start: now,
          stop: now + 1,
        },
        {
          name: `Recommended Fix: ${item.recommendedFix}`,
          status: 'passed',
          stage: 'finished',
          start: now,
          stop: now + 1,
        },
      ],
    }));

    const descriptionLines = [
      modeLabel,
      `Release Status: ${summary.releaseStatus} (${passedCount}/${this.totalTests} Passed - ${passRate}%)`,
      `Impact Summary: ${summary.impactSummary}`,
    ].join('\n');

    const allureResult = {
      uuid,
      historyId: 'ai-failure-analysis-summary',
      name: 'AI Failure Analysis & Release Readiness Summary',
      fullName: 'AI Failure Analysis & Release Readiness Summary',
      status: 'unknown',
      stage: 'finished',
      description: descriptionLines,
      start: now,
      stop: now + 5,
      labels: [
        { name: 'suite', value: 'AI Quality Insights' },
        { name: 'severity', value: 'normal' },
      ],
      steps,
    };

    const outputPath = path.join(allureResultsDir, `${uuid}-result.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allureResult, null, 2), 'utf-8');
  }

  private updateEnvironmentProperties(
    allureResultsDir: string,
    aiStatus: string
  ): void {
    const envPath = path.join(allureResultsDir, 'environment.properties');
    let existingLines: string[] = [];

    if (fs.existsSync(envPath)) {
      existingLines = fs
        .readFileSync(envPath, 'utf-8')
        .split('\n')
        .filter(
          (line) =>
            line.trim() !== '' &&
            !line.startsWith('AI_Analysis_Engine=') &&
            !line.startsWith('Execution_Environment=')
        );
    }

    const envName = process.env.CI ? 'GitHub Actions CI' : 'Local Machine';
    existingLines.push(`Execution_Environment=${envName}`);
    existingLines.push(`AI_Analysis_Engine=${aiStatus}`);

    fs.writeFileSync(envPath, existingLines.join('\n') + '\n', 'utf-8');
  }

  private stripAnsi(text: string): string {
    return text.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ''
    );
  }

  private sanitizeSensitiveData(text: string): string {
    return text
      .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
      .replace(
        /("?(?:password|passwd|pwd|token|secret|apiKey|api_key|authorization)"?\s*[:=]\s*)"?[^",\s}]+"?/gi,
        '$1"[REDACTED]"'
      );
  }
}