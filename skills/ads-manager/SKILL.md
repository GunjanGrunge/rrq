---
name: ads-manager
description: >
  Google Ads and AdSense integration for RRQ. Zeus monitors AdSense earnings
  and Google Ads campaign performance. Zeus validates CTR, keyword performance,
  audience quality, and ROAS. Feeds insights to Regum (strategy) and Qeon
  (content decisions). Zeus autonomously manages campaigns: sets budgets capped
  at 50% of available account balance, targets audiences, optimises bids, and
  pauses underperforming ads. Read this skill when building any ad, campaign,
  budget, bidding, audience, or AdSense feature.
---

# Ads Manager — Google Ads + AdSense

## Overview

Two separate but connected systems:

```
ADSENSE         → passive income from YouTube monetisation
                  Zeus reads: RPM, CPM, estimated earnings, top-earning videos

GOOGLE ADS      → paid promotion of RRQ videos to grow the channel faster
                  Zeus manages: campaigns, budgets, bids, audiences, pausing
```

Zeus is the only agent that touches ad accounts. Regum receives insights and
adjusts content strategy accordingly. Qeon uses ad performance data to inform
which visual styles, thumbnails, and hooks to prioritise.

---

## Budget Safety Rule — NON-NEGOTIABLE

```
Maximum campaign spend = 50% of current Google Ads account balance

Zeus checks balance before EVERY campaign creation or budget increase.
Zeus NEVER allocates more than 50% regardless of projected ROAS.
Zeus pauses ALL campaigns if balance drops below $20.
```

This is hardcoded. There is no override. Regum and Qeon cannot request a
higher budget. Only a human can change this cap in Settings.

```typescript
// lib/ads/budget-guard.ts
export async function getMaxAllowedBudget(customerId: string): Promise<number> {
  const balance = await getAccountBalance(customerId);

  if (balance < 20) {
    await pauseAllCampaigns(customerId);
    await zeus.writeLesson("Ad account balance below $20 — all campaigns paused");
    throw new Error("Insufficient balance — all campaigns paused");
  }

  return Math.floor(balance * 0.50); // 50% cap, floored to whole dollar
}
```

---

## Setup — Google Ads API

```bash
# Environment variables
GOOGLE_ADS_DEVELOPER_TOKEN=          # from Google Ads API Center
GOOGLE_ADS_CLIENT_ID=                # OAuth client ID (same Google Cloud project as YouTube)
GOOGLE_ADS_CLIENT_SECRET=            # OAuth client secret
GOOGLE_ADS_REFRESH_TOKEN=            # from OAuth flow (manager account level)
GOOGLE_ADS_CUSTOMER_ID=              # 10-digit Google Ads customer ID (no dashes)
GOOGLE_ADS_LOGIN_CUSTOMER_ID=        # manager account ID if using MCC

# AdSense
GOOGLE_ADSENSE_PUBLISHER_ID=         # pub-XXXXXXXXXXXXXXXX
# AdSense uses the same OAuth credentials as YouTube (already in env)
```

### Google Ads API Authentication

```typescript
// lib/ads/google-ads-client.ts
import { GoogleAdsApi, Customer } from "google-ads-api";

const client = new GoogleAdsApi({
  client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

export function getAdsCustomer(): Customer {
  return client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });
}
```

Install: `npm install google-ads-api`

---

## AdSense Integration

### lib/ads/adsense.ts

```typescript
import { google } from "googleapis";

// Uses same OAuth2 client as YouTube (already configured in lib/youtube-auth.ts)
export async function getAdSenseClient() {
  const oauth2Client = getOAuth2Client(); // from lib/youtube-auth.ts
  return google.adsense({ version: "v2", auth: oauth2Client });
}

// ─── Fetch AdSense metrics ────────────────────────────────────────────────────

export interface AdSenseMetrics {
  estimatedEarnings: number;   // USD
  pageRPM: number;             // revenue per 1000 views
  impressions: number;
  clicks: number;
  ctr: number;
  date: string;
}

export async function fetchAdSenseMetrics(
  publisherId: string,
  startDate: string,  // YYYY-MM-DD
  endDate: string
): Promise<AdSenseMetrics[]> {
  const adsense = await getAdSenseClient();

  const response = await adsense.accounts.reports.generate({
    account: `accounts/${publisherId}`,
    dateRange: "CUSTOM",
    startDate: { year: +startDate.slice(0,4), month: +startDate.slice(5,7), day: +startDate.slice(8,10) },
    endDate:   { year: +endDate.slice(0,4),   month: +endDate.slice(5,7),   day: +endDate.slice(8,10) },
    metrics: [
      "ESTIMATED_EARNINGS",
      "PAGE_VIEWS_RPM",
      "IMPRESSIONS",
      "CLICKS",
      "PAGE_VIEWS_CTR",
    ],
    dimensions: ["DATE"],
    orderBy: [{ name: "DATE", descending: false }],
  });

  return (response.data.rows ?? []).map(row => ({
    date: row.cells![0].value!,
    estimatedEarnings: parseFloat(row.cells![1].value ?? "0"),
    pageRPM:           parseFloat(row.cells![2].value ?? "0"),
    impressions:       parseInt(row.cells![3].value ?? "0"),
    clicks:            parseInt(row.cells![4].value ?? "0"),
    ctr:               parseFloat(row.cells![5].value ?? "0"),
  }));
}

// ─── Fetch top-earning content ─────────────────────────────────────────────────

export async function fetchTopEarningUrls(
  publisherId: string,
  days = 30
): Promise<{ url: string; earnings: number; rpm: number }[]> {
  const adsense = await getAdSenseClient();
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const response = await adsense.accounts.reports.generate({
    account: `accounts/${publisherId}`,
    dateRange: "CUSTOM",
    startDate: { year: +startDate.slice(0,4), month: +startDate.slice(5,7), day: +startDate.slice(8,10) },
    endDate:   { year: +endDate.slice(0,4),   month: +endDate.slice(5,7),   day: +endDate.slice(8,10) },
    metrics: ["ESTIMATED_EARNINGS", "PAGE_VIEWS_RPM"],
    dimensions: ["URL_CHANNEL_NAME"],
    orderBy: [{ name: "ESTIMATED_EARNINGS", descending: true }],
    limit: 20,
  });

  return (response.data.rows ?? []).map(row => ({
    url:      row.cells![0].value ?? "",
    earnings: parseFloat(row.cells![1].value ?? "0"),
    rpm:      parseFloat(row.cells![2].value ?? "0"),
  }));
}
```

---

## Google Ads — Campaign Management

### lib/ads/campaigns.ts

```typescript
import { getAdsCustomer } from "./google-ads-client";
import { getMaxAllowedBudget } from "./budget-guard";
import { enums, resources, toMicros } from "google-ads-api";

// ─── Create campaign ──────────────────────────────────────────────────────────

export interface CampaignConfig {
  name: string;
  videoId: string;          // YouTube video ID to promote
  dailyBudgetUSD: number;   // Zeus calculates this — never exceed 50% balance cap
  targeting: AudienceConfig;
  biddingStrategy: "TARGET_CPV" | "TARGET_CPA" | "MAXIMIZE_CONVERSIONS";
  targetCPVMicros?: number; // cost per view in micros (1 USD = 1,000,000 micros)
}

export interface AudienceConfig {
  keywords: string[];       // from research skill's keyword output
  topics: string[];         // YouTube topic categories
  demographics: {
    ageRanges: string[];    // "AGE_RANGE_18_24" etc.
    genders: string[];      // "GENDER_MALE" | "GENDER_FEMALE" | "GENDER_UNDETERMINED"
  };
  placements?: string[];    // specific YouTube channels to target
  excludedKeywords?: string[];
}

export async function createVideoAdCampaign(config: CampaignConfig) {
  const customer = getAdsCustomer();

  // Safety check — budget guard runs first, always
  const maxBudget = await getMaxAllowedBudget(process.env.GOOGLE_ADS_CUSTOMER_ID!);
  if (config.dailyBudgetUSD > maxBudget) {
    config.dailyBudgetUSD = maxBudget;
  }

  // Step 1: Create campaign budget
  const budgetResource = await customer.campaignBudgets.create([{
    name: `${config.name}_budget_${Date.now()}`,
    amount_micros: toMicros(config.dailyBudgetUSD),
    delivery_method: enums.BudgetDeliveryMethod.STANDARD,
    explicitly_shared: false,
  }]);

  const budgetId = budgetResource.results[0].resource_name;

  // Step 2: Create campaign
  const campaignResource = await customer.campaigns.create([{
    name: config.name,
    status: enums.CampaignStatus.PAUSED,   // always start paused — Zeus reviews before enabling
    advertising_channel_type: enums.AdvertisingChannelType.VIDEO,
    campaign_budget: budgetId,
    video_brand_safety_suitability: enums.BrandSafetySuitability.EXPANDED_INVENTORY,
    bidding_strategy_type: enums.BiddingStrategyType.TARGET_CPV,
    target_cpv: {
      target_cpv_micros: config.targetCPVMicros ?? toMicros(0.02), // $0.02 default CPV
    },
    start_date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    network_settings: {
      target_youtube_search: true,
      target_youtube_tv: false,
      target_content_network: true,
    },
  }]);

  const campaignId = campaignResource.results[0].resource_name;

  // Step 3: Create ad group
  const adGroupResource = await customer.adGroups.create([{
    name: `${config.name}_adgroup`,
    campaign: campaignId,
    status: enums.AdGroupStatus.ENABLED,
    ad_group_type: enums.AdGroupType.VIDEO_TRUE_VIEW_IN_STREAM,
  }]);

  const adGroupId = adGroupResource.results[0].resource_name;

  // Step 4: Create video ad
  await customer.adGroupAds.create([{
    ad_group: adGroupId,
    status: enums.AdGroupAdStatus.ENABLED,
    ad: {
      name: `${config.name}_ad`,
      video_responsive_ad: {
        videos: [{ asset: `assets/${config.videoId}` }],
        headlines: [{ text: "Watch now" }],
        long_headlines: [{ text: "Watch the full video" }],
        descriptions: [{ text: "Subscribe for more" }],
        call_to_actions: [{ text: "Subscribe" }],
      },
    },
  }]);

  // Step 5: Apply keyword targeting
  if (config.targeting.keywords.length > 0) {
    await customer.adGroupCriteria.create(
      config.targeting.keywords.map(keyword => ({
        ad_group: adGroupId,
        keyword: { text: keyword, match_type: enums.KeywordMatchType.BROAD },
        status: enums.AdGroupCriterionStatus.ENABLED,
      }))
    );
  }

  // Step 6: Apply demographic targeting
  await customer.adGroupCriteria.create(
    config.targeting.demographics.ageRanges.map(ageRange => ({
      ad_group: adGroupId,
      age_range: { type: enums.AgeRangeType[ageRange as keyof typeof enums.AgeRangeType] },
      status: enums.AdGroupCriterionStatus.ENABLED,
    }))
  );

  return {
    campaignId,
    adGroupId,
    budgetId,
    status: "paused",   // Zeus must explicitly enable after review
    dailyBudgetUSD: config.dailyBudgetUSD,
  };
}
```

---

## Google Ads — Performance Reading

### lib/ads/performance.ts

```typescript
import { getAdsCustomer } from "./google-ads-client";

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  status: string;
  impressions: number;
  views: number;
  clicks: number;
  ctr: number;               // click-through rate
  viewRate: number;          // views / impressions
  avgCPV: number;            // average cost per view (USD)
  avgCPC: number;            // average cost per click (USD)
  costUSD: number;           // total spend
  conversions: number;
  costPerConversion: number;
  videoId: string;
  keywords: KeywordPerformance[];
}

export interface KeywordPerformance {
  keyword: string;
  impressions: number;
  views: number;
  ctr: number;
  avgCPV: number;
  costUSD: number;
  qualityScore: number;
}

export async function fetchCampaignPerformance(
  dateRange = "LAST_7_DAYS"
): Promise<CampaignPerformance[]> {
  const customer = getAdsCustomer();

  const campaigns = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.video_views,
      metrics.clicks,
      metrics.ctr,
      metrics.video_view_rate,
      metrics.average_cpv,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date DURING ${dateRange}
      AND campaign.advertising_channel_type = 'VIDEO'
    ORDER BY metrics.cost_micros DESC
  `);

  return campaigns.map(c => ({
    campaignId:        c.campaign.id.toString(),
    campaignName:      c.campaign.name,
    status:            c.campaign.status,
    impressions:       c.metrics.impressions,
    views:             c.metrics.video_views,
    clicks:            c.metrics.clicks,
    ctr:               c.metrics.ctr,
    viewRate:          c.metrics.video_view_rate,
    avgCPV:            (c.metrics.average_cpv ?? 0) / 1_000_000,
    avgCPC:            (c.metrics.average_cpc ?? 0) / 1_000_000,
    costUSD:           (c.metrics.cost_micros ?? 0) / 1_000_000,
    conversions:       c.metrics.conversions,
    costPerConversion: (c.metrics.cost_per_conversion ?? 0) / 1_000_000,
    videoId:           "",
    keywords:          [],
  }));
}

export async function fetchKeywordPerformance(
  campaignId: string,
  dateRange = "LAST_7_DAYS"
): Promise<KeywordPerformance[]> {
  const customer = getAdsCustomer();

  const keywords = await customer.query(`
    SELECT
      ad_group_criterion.keyword.text,
      metrics.impressions,
      metrics.video_views,
      metrics.ctr,
      metrics.average_cpv,
      metrics.cost_micros,
      ad_group_criterion.quality_info.quality_score
    FROM ad_group_criterion
    WHERE campaign.id = ${campaignId}
      AND segments.date DURING ${dateRange}
      AND ad_group_criterion.type = 'KEYWORD'
    ORDER BY metrics.cost_micros DESC
  `);

  return keywords.map(k => ({
    keyword:      k.ad_group_criterion.keyword.text,
    impressions:  k.metrics.impressions,
    views:        k.metrics.video_views,
    ctr:          k.metrics.ctr,
    avgCPV:       (k.metrics.average_cpv ?? 0) / 1_000_000,
    costUSD:      (k.metrics.cost_micros ?? 0) / 1_000_000,
    qualityScore: k.ad_group_criterion.quality_info?.quality_score ?? 0,
  }));
}

export async function getAccountBalance(customerId: string): Promise<number> {
  const customer = getAdsCustomer();

  const result = await customer.query(`
    SELECT
      billing_setup.payments_account_info.payments_account_id,
      customer.currency_code
    FROM billing_setup
    WHERE billing_setup.status = 'APPROVED'
    LIMIT 1
  `);

  // Note: Google Ads API does not expose raw balance directly.
  // Query the account budget instead:
  const budgetResult = await customer.query(`
    SELECT
      account_budget.approved_spending_limit_micros,
      account_budget.amount_served_micros,
      account_budget.total_adjustments_micros
    FROM account_budget
    WHERE account_budget.status = 'APPROVED'
    LIMIT 1
  `);

  if (!budgetResult[0]) return 0;

  const approved = (budgetResult[0].account_budget.approved_spending_limit_micros ?? 0) / 1_000_000;
  const spent    = (budgetResult[0].account_budget.amount_served_micros ?? 0) / 1_000_000;

  return Math.max(0, approved - spent);
}
```

---

## Google Ads — Campaign Control

### lib/ads/campaign-control.ts

```typescript
import { getAdsCustomer } from "./google-ads-client";
import { enums, toMicros } from "google-ads-api";

export async function pauseCampaign(campaignResourceName: string): Promise<void> {
  const customer = getAdsCustomer();
  await customer.campaigns.update([{
    resource_name: campaignResourceName,
    status: enums.CampaignStatus.PAUSED,
  }]);
}

export async function enableCampaign(campaignResourceName: string): Promise<void> {
  const customer = getAdsCustomer();
  await customer.campaigns.update([{
    resource_name: campaignResourceName,
    status: enums.CampaignStatus.ENABLED,
  }]);
}

export async function updateDailyBudget(
  budgetResourceName: string,
  newDailyBudgetUSD: number,
  customerId: string
): Promise<void> {
  // Budget guard — always check before updating
  const maxBudget = await getMaxAllowedBudget(customerId);
  const safeBudget = Math.min(newDailyBudgetUSD, maxBudget);

  const customer = getAdsCustomer();
  await customer.campaignBudgets.update([{
    resource_name: budgetResourceName,
    amount_micros: toMicros(safeBudget),
  }]);
}

export async function updateBidStrategy(
  campaignResourceName: string,
  targetCPVUSD: number
): Promise<void> {
  const customer = getAdsCustomer();
  await customer.campaigns.update([{
    resource_name: campaignResourceName,
    target_cpv: {
      target_cpv_micros: toMicros(targetCPVUSD),
    },
  }]);
}

export async function pauseKeyword(
  adGroupCriterionResourceName: string
): Promise<void> {
  const customer = getAdsCustomer();
  await customer.adGroupCriteria.update([{
    resource_name: adGroupCriterionResourceName,
    status: enums.AdGroupCriterionStatus.PAUSED,
  }]);
}

export async function pauseAllCampaigns(customerId: string): Promise<void> {
  const customer = getAdsCustomer();

  const campaigns = await customer.query(`
    SELECT campaign.resource_name, campaign.status
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'VIDEO'
  `);

  await customer.campaigns.update(
    campaigns.map(c => ({
      resource_name: c.campaign.resource_name,
      status: enums.CampaignStatus.PAUSED,
    }))
  );
}
```

---

## Zeus — Ad Intelligence Module

This is the section added to Zeus's scheduled runs.

### Thresholds Zeus uses to judge ad performance

```typescript
// lib/ads/thresholds.ts
export const AD_THRESHOLDS = {
  // Campaign-level
  minViewRate: 0.20,        // < 20% view rate = poor creative or targeting
  minCTR: 0.004,            // < 0.4% CTR = poor creative
  maxCPV: 0.05,             // > $0.05 CPV = overpaying for views
  maxCostPerSubscriber: 2.00, // > $2/subscriber acquired = inefficient

  // Keyword-level
  minKeywordQualityScore: 4, // < 4/10 = pause keyword
  minKeywordViews: 10,       // keywords with < 10 views after $5 spend = pause

  // Emergency stops
  minAccountBalance: 20,    // < $20 = pause everything immediately
  maxDailySpendPercent: 0.50, // never exceed 50% of available balance in 24hrs
};
```

### Zeus Ad Review — runs every 24 hours

```typescript
// Plugs into Zeus's existing 24hr analytics review
export async function zeusAdReview(customerId: string, publisherId: string) {

  // 1. Check AdSense earnings
  const adsenseMetrics = await fetchAdSenseMetrics(
    publisherId,
    sevenDaysAgo(),
    today()
  );
  const topEarners = await fetchTopEarningUrls(publisherId, 30);

  // 2. Check account balance — safety check first
  const balance = await getAccountBalance(customerId);
  if (balance < AD_THRESHOLDS.minAccountBalance) {
    await pauseAllCampaigns(customerId);
    return {
      action: "emergency_pause",
      reason: `Balance $${balance.toFixed(2)} below minimum $${AD_THRESHOLDS.minAccountBalance}`,
    };
  }

  // 3. Fetch all campaign performance (last 7 days)
  const campaigns = await fetchCampaignPerformance("LAST_7_DAYS");

  const actions: AdAction[] = [];

  for (const campaign of campaigns) {
    // Fetch keyword performance for this campaign
    campaign.keywords = await fetchKeywordPerformance(campaign.campaignId);

    // ── Campaign-level decisions ──────────────────────────────────────────
    if (campaign.viewRate < AD_THRESHOLDS.minViewRate && campaign.impressions > 1000) {
      await pauseCampaign(`customers/${customerId}/campaigns/${campaign.campaignId}`);
      actions.push({ type: "pause_campaign", campaignId: campaign.campaignId,
        reason: `View rate ${(campaign.viewRate * 100).toFixed(1)}% below 20% threshold` });
    }

    if (campaign.avgCPV > AD_THRESHOLDS.maxCPV && campaign.views > 100) {
      const newCPV = campaign.avgCPV * 0.80;
      await updateBidStrategy(
        `customers/${customerId}/campaigns/${campaign.campaignId}`, newCPV
      );
      actions.push({ type: "reduce_bid", campaignId: campaign.campaignId,
        reason: `CPV $${campaign.avgCPV.toFixed(3)} above $0.05 — reduced to $${newCPV.toFixed(3)}` });
    }

    // ── Keyword-level decisions ───────────────────────────────────────────
    for (const kw of campaign.keywords) {
      if (kw.qualityScore < AD_THRESHOLDS.minKeywordQualityScore) {
        actions.push({ type: "flag_keyword", keyword: kw.keyword,
          reason: `Quality score ${kw.qualityScore}/10 — consider pausing` });
      }
      if (kw.costUSD > 5 && kw.views < AD_THRESHOLDS.minKeywordViews) {
        actions.push({ type: "pause_keyword", keyword: kw.keyword,
          reason: `$${kw.costUSD.toFixed(2)} spent, only ${kw.views} views` });
      }
    }
  }

  // 4. Synthesise with Opus — write lessons and insights
  const adInsights = await synthesiseAdInsights({
    adsenseMetrics,
    topEarners,
    campaigns,
    actions,
    balance,
  });

  // 5. Write lessons to Zeus memory
  await zeus.writeLesson(adInsights.lesson);

  // 6. Return structured insights for Regum and Qeon
  return {
    adsense: {
      last7dEarnings: sumEarnings(adsenseMetrics),
      avgRPM: avgRPM(adsenseMetrics),
      topEarningNiches: topEarners.slice(0, 3),
    },
    ads: {
      totalSpend7d: campaigns.reduce((s, c) => s + c.costUSD, 0),
      bestCampaign: campaigns.sort((a, b) => b.viewRate - a.viewRate)[0],
      worstCampaign: campaigns.sort((a, b) => a.viewRate - b.viewRate)[0],
      actionsTaken: actions,
      topKeywords: getTopKeywords(campaigns),
      underperformingKeywords: getUnderperformingKeywords(campaigns),
    },
    balance: {
      current: balance,
      maxNewCampaignBudget: Math.floor(balance * 0.50),
    },
    insights: adInsights,
  };
}
```

---

## Campaign Creation — Zeus Decision Logic

Zeus decides whether to create a new campaign after every video upload.
This plugs into the existing Zeus post-upload workflow.

```typescript
export async function shouldRunAdCampaign(
  videoId: string,
  researchData: ResearchJSON,
  qualityGateScore: number,
  balance: number
): Promise<{ run: boolean; config?: CampaignConfig; reason: string }> {

  // Don't promote if quality gate was borderline
  if (qualityGateScore < 8.0) {
    return { run: false, reason: `Quality score ${qualityGateScore} below 8.0 threshold for ad spend` };
  }

  // Don't promote if balance too low
  if (balance < 30) {
    return { run: false, reason: `Balance $${balance} too low to run campaign` };
  }

  // Calculate safe daily budget — 50% cap applied here
  const maxBudget = Math.floor(balance * 0.50);
  const dailyBudget = Math.min(maxBudget, 10); // default $10/day max per campaign

  // Build audience from research keywords
  const config: CampaignConfig = {
    name: `RRQ_${videoId}_${new Date().toISOString().slice(0,10)}`,
    videoId,
    dailyBudgetUSD: dailyBudget,
    biddingStrategy: "TARGET_CPV",
    targetCPVMicros: 20000,  // $0.02 per view starting point
    targeting: {
      keywords: [
        ...researchData.keywords.primary,
        ...researchData.keywords.secondary.slice(0, 5),
      ],
      topics: inferTopicCategories(researchData.videoType),
      demographics: inferDemographics(researchData),
      excludedKeywords: ["free", "torrent", "crack", "pirate"], // brand safety
    },
  };

  return { run: true, config, reason: "Quality score ≥ 8.0 and sufficient balance" };
}

function inferTopicCategories(videoType: string): string[] {
  const map: Record<string, string[]> = {
    comparison:  ["TECHNOLOGY", "CONSUMER_ELECTRONICS"],
    finance:     ["FINANCE", "BUSINESS_AND_INDUSTRIAL"],
    howto:       ["HOBBIES_AND_LEISURE", "REFERENCE"],
    news:        ["NEWS"],
    documentary: ["SOCIETY", "SCIENCE"],
    beauty:      ["BEAUTY_AND_FITNESS", "LIFESTYLE"],
  };
  return map[videoType] ?? ["TECHNOLOGY"];
}

function inferDemographics(research: ResearchJSON) {
  // Infer from audience description in research JSON
  const audience = research.targetAudience.toLowerCase();
  return {
    ageRanges: audience.includes("young") || audience.includes("gen z")
      ? ["AGE_RANGE_18_24", "AGE_RANGE_25_34"]
      : ["AGE_RANGE_25_34", "AGE_RANGE_35_44", "AGE_RANGE_45_54"],
    genders: ["GENDER_MALE", "GENDER_FEMALE", "GENDER_UNDETERMINED"],
  };
}
```

---

## Feedback Loop — Zeus → Regum → Qeon

```
Zeus runs ad review every 24hrs
  ↓
Zeus writes structured AdInsights to DynamoDB (ad-insights table)
  ↓
Regum reads ad-insights at next strategy review:
  → If a niche CTR < 0.4%: Regum de-prioritises that niche for next 2 weeks
  → If a keyword theme converts well: Regum asks Rex to watch similar topics
  → If a demographic outperforms: Regum schedules more content for that audience
  ↓
Qeon reads top-earning AdSense content before script step:
  → High-RPM topics get longer videos (more ad inventory per view)
  → High-CPV niches get stronger hooks (ad spend efficiency depends on watch time)
  → Thumbnail style from top ad performers feeds into thumbnail generator prompt
```

### DynamoDB table — ad-insights

```typescript
// ad-insights table (add to DynamoDB tables list in CLAUDE.md)
{
  date: "2025-03-12",                     // partition key
  adsense: {
    earnings7d: 124.50,
    avgRPM: 4.20,
    topNiches: ["tech", "finance"],
  },
  googleAds: {
    spend7d: 68.00,
    bestViewRate: 0.34,
    bestKeyword: "samsung s25 ultra review",
    worstCampaign: "RRQ_abc123_2025-03-05",
    actionsTaken: ["paused 2 campaigns", "reduced bid on 3 keywords"],
  },
  insights: {
    regumGuidance: "Tech comparison keywords converting at 2x finance rate",
    qeonGuidance:  "Videos over 10 min earning 40% more RPM than under 10 min",
    rexGuidance:   "Samsung content CTR 8.2% — Rex should prioritise Samsung topics",
  },
  balance: {
    current: 185.00,
    maxNewCampaignBudget: 92.50,
  },
}
```

---

## What Regum Does with Ad Data

```typescript
// Plugs into Regum's weekly strategy review
async function regumAdStrategyUpdate(adInsights: AdInsights) {

  const guidance = adInsights.insights;

  // Update Rex niche priorities based on CTR performance
  if (guidance.rexGuidance) {
    await updateRexNichePriorities(guidance.rexGuidance);
  }

  // Adjust content length targets based on RPM data
  if (adInsights.adsense.avgRPM > 5.0) {
    // High RPM = push for longer videos
    await setContentLengthTarget("10-15 minutes");
  }

  // Update Qeon thumbnail brief with ad learnings
  await updateThumbnailGuidance({
    highPerformingStyle: adInsights.googleAds.topThumbnailStyle,
    lowPerformingStyle:  adInsights.googleAds.worstThumbnailStyle,
  });
}
```

## What Qeon Does with Ad Data

```typescript
// Plugs into Qeon's script step — before calling the script skill
async function qeonAdContext(jobBrief: QeonBrief) {
  const latestAdInsights = await getLatestAdInsights();

  return {
    ...jobBrief,
    adContext: {
      targetLength: latestAdInsights.insights.qeonGuidance.includes("10 min") ? 12 : 8,
      highRPMNiche: latestAdInsights.adsense.topNiches.includes(jobBrief.niche),
      topKeywords: latestAdInsights.googleAds.topPerformingKeywords,
    },
  };
}
```

---

## Environment Variables (add to CLAUDE.md and Vercel)

```bash
# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=                # same Google Cloud project as YouTube OAuth
GOOGLE_ADS_CLIENT_SECRET=            # same Google Cloud project as YouTube OAuth
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=              # 10-digit, no dashes
GOOGLE_ADS_LOGIN_CUSTOMER_ID=        # manager account ID (if using MCC)

# AdSense
GOOGLE_ADSENSE_PUBLISHER_ID=         # pub-XXXXXXXXXXXXXXXX
# AdSense OAuth reuses YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET
```

---

## New Files to Create

```
lib/ads/
  google-ads-client.ts    ← GoogleAdsApi client initialisation
  adsense.ts              ← fetchAdSenseMetrics(), fetchTopEarningUrls()
  campaigns.ts            ← createVideoAdCampaign()
  performance.ts          ← fetchCampaignPerformance(), fetchKeywordPerformance()
  campaign-control.ts     ← pause, enable, update budget, update bids
  budget-guard.ts         ← getMaxAllowedBudget() — 50% cap enforced here
  thresholds.ts           ← all performance thresholds in one place
  zeus-ad-review.ts       ← zeusAdReview(), shouldRunAdCampaign()

lambdas/ad-manager/
  index.ts                ← Lambda triggered by EventBridge every 24hrs
```

---

## DynamoDB Tables to Add

```
ad-insights     → Zeus writes daily — partition key: date
                  Regum + Qeon read before every strategic decision
ad-campaigns    → one record per campaign — tracks videoId, budgetUSD, status,
                  performance snapshot, actions taken
```

---

## Checklist

```
[ ] Apply for Google Ads API access (developer token — takes 1-2 days to approve)
[ ] Enable AdSense API in Google Cloud Console
[ ] Add AdSense scope to YouTube OAuth flow: "https://www.googleapis.com/auth/adsense.readonly"
[ ] Install: npm install google-ads-api googleapis
[ ] Create lib/ads/ folder with all 7 files
[ ] Add ad-insights and ad-campaigns to DynamoDB
[ ] Add ad env vars to .env.local and Vercel
[ ] Plug zeusAdReview() into Zeus 24hr EventBridge run
[ ] Plug shouldRunAdCampaign() into Zeus post-upload workflow
[ ] Plug regumAdStrategyUpdate() into Regum weekly review
[ ] Plug qeonAdContext() into Qeon script step
[ ] Add ad-insights panel to Zeus Command Center UI
[ ] Test with a $5 campaign on a real video before enabling auto-campaigns
```

---

## One Important Note on Google Ads API Access

Google Ads API requires a developer token. Getting Basic Access (which is what
you need for real campaigns) requires submitting an application describing your
use case. The application asks how you use the API — describe it as:
"Automated campaign management for YouTube video promotion — creating,
monitoring, and optimising video ad campaigns for our own YouTube channel."

This is an accurate description and gets approved. Allow 1-3 business days.
Start the application on day 1 of building this feature.

API access portal: https://developers.google.com/google-ads/api/docs/access-levels
