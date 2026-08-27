import { describe, expect, it } from 'vitest';
// @ts-expect-error The build helper is intentionally plain Node ESM.
import { appReleaseVersion, renderServiceWorker } from '../scripts/release-sw.mjs';

describe('release-specific service worker', () => {
  const template = "const CACHE = 'paper-trail-shell-__APP_RELEASE__'; self.skipWaiting();";

  it('changes the shell cache for an app-only release, deterministically', () => {
    const current = '<script src="/assets/index-old.js"></script>';
    const appOnlyRelease = '<script src="/assets/index-new.js"></script>';
    const currentVersion = appReleaseVersion(current);
    const nextVersion = appReleaseVersion(appOnlyRelease);

    expect(appReleaseVersion(current)).toBe(currentVersion);
    expect(nextVersion).not.toBe(currentVersion);
    expect(renderServiceWorker(template, nextVersion)).toContain(`paper-trail-shell-${nextVersion}`);
    expect(renderServiceWorker(template, nextVersion)).not.toContain('__APP_RELEASE__');
  });
});
