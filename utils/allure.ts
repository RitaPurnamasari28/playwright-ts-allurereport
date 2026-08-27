import { test as base, expect } from "@playwright/test";
import {
  owner,
  severity,
  label,
  epic,
  feature,
  story,
  parameter,
} from "allure-js-commons";

export const test = base.extend({});

test.beforeEach(async ({ browserName }, testInfo) => {
  await owner("QA Team");
  await severity("normal");

  await label("browser", browserName);
  await label("project", "Automation Exercise");
  await label(
    "environment",
    process.env.TEST_ENV ?? "QA"
  );

  // parameter
  await parameter("Browser", browserName);
  await parameter("Project", "Automation Exercise");
  await parameter(
    "Environment",
    process.env.TEST_ENV ?? "QA"
  );

  await epic("Web Automation");

  await feature(
    testInfo.file ?? "unknown"
  );

  const suite =
    testInfo.titlePath.length >= 2
      ? testInfo.titlePath[testInfo.titlePath.length - 2]
      : undefined;

  if (suite) {
    await story(suite);
  }
});

export { expect };


// open allure report
//allure open ./allure-report

//clear history report allure
//Remove-Item -Recurse -Force allure-results
