# Douyin Native Work-Detail Tabs

This reference defines the raw-first contract for Douyin creator work-detail pages. Collection is Chrome Extension-only and limited to the user's own or otherwise authorized creator-center data.

## Collection Principle

Collect every visible or officially exportable field from the native work-detail tabs:

- `总览`
- `流量分析`
- `观众分析`
- `评论热词`

Prefer official in-page export or download controls when the creator center provides them. If no official export is available, capture visible DOM text, tables, chart labels, legends, selected date ranges, and visible chart values. If a chart label is visible but the numeric value cannot be read from normal page controls, store a `dataGap` entry instead of guessing.

## Browser Boundaries

Allowed collection surfaces are normal visible creator-center page controls, official in-page exports, and visible page content available through the Chrome Extension.

Forbidden browser-state access:

- cookies
- localStorage
- passwords
- session stores
- Chrome profile files
- hidden or private network payloads that are not exposed through normal visible page controls

## Raw Storage

Store native tab data under `rawDouyinTabs`, with one namespace per visible tab. Preserve raw labels, units, date ranges, visible table rows, rank order, export provenance, and `dataGap` notes before deriving normalized analysis fields.

```json
{
  "rawDouyinTabs": {
    "overview": {
      "coreMetrics": [],
      "watchTrend": [],
      "retentionAnalysis": [],
      "bounceAnalysis": [],
      "interactionMetrics": [],
      "danmakuAnalysis": []
    },
    "trafficAnalysis": {
      "douyinAppSourceShare": [],
      "otherAppSourceShare": [],
      "extraTraffic": [],
      "platformBoostTraffic": [],
      "searchTermsBefore": [],
      "searchTermsAfter": []
    },
    "audienceAnalysis": {
      "followMetrics": [],
      "followTrend": [],
      "genderDistribution": [],
      "ageDistribution": [],
      "regionDistribution": [],
      "interestDistribution": [],
      "followHotWords": []
    },
    "commentHotWords": {
      "words": []
    }
  }
}
```

## Required Raw Sections

`rawDouyinTabs.overview` must include:

- `coreMetrics`
- `watchTrend`
- `retentionAnalysis`
- `bounceAnalysis`
- `interactionMetrics`
- `danmakuAnalysis`

`rawDouyinTabs.trafficAnalysis` must include:

- `douyinAppSourceShare`
- `otherAppSourceShare`
- `extraTraffic`
- `platformBoostTraffic`
- `searchTermsBefore`
- `searchTermsAfter`

`rawDouyinTabs.audienceAnalysis` must include:

- `followMetrics`
- `followTrend`
- `genderDistribution`
- `ageDistribution`
- `regionDistribution`
- `interestDistribution`
- `followHotWords`

`rawDouyinTabs.commentHotWords` must include:

- `words`: every visible ranked hot word from both visible table columns, preserving rank, word text, visible metric labels, visible values, and source column.

## Normalized Signals

Build normalized report signals from raw tab data only after the raw fields and gaps are persisted:

- `retentionSignals`
- `interactionSignals`
- `trafficSources`
- `searchIntent`
- `audienceAsset`
- `commentIntent`
- `negativeSignals`
- `trendOrPlatformBoost`

Every normalized signal should retain traceability to the raw tab namespace, section, source label, and work id. When the evidence is incomplete, keep the normalized field conservative and point to the relevant `dataGap`.

## Command Boundaries

`/kaishi` creates the initial account baseline. It collects visible and officially exportable work-list data, then captures complete visible native work-detail tab data into `rawDouyinTabs` for every eligible work before final merge outputs are treated as complete.

`/gengxin` updates the existing baseline incrementally. It collects new works and refreshes stale or missing native tab fields while preserving prior raw captures and marking unresolved fields as `dataGap`.

`/tijian` audits only. It checks whether each work has the required `rawDouyinTabs` namespaces, required raw sections, export provenance where available, normalized signal traceability, and explicit `dataGap` entries for unreadable visible fields. It does not collect browser data.

`/buchong` backfills only audited gaps. It reads the latest audit result, opens the relevant authorized creator-center pages through the Chrome Extension, fills only the missing or stale fields named by the audit, and leaves unrelated fields unchanged.

`/baogao` builds a fresh atomic report analysis from the current merged data. It derives the normalized signals from `rawDouyinTabs`, avoids reusing stale report conclusions, and records any remaining `dataGap` limits in the analysis payload.

`/html` renders Lumina from the current fresh analysis payload. It does not choose templates, reanalyze stale files, or collect browser data; if the analysis payload is missing or stale, regenerate it before rendering.
