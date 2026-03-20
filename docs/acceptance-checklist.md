# MVP Acceptance Checklist (Base44 + Cursor-like)

## 1. Generate Initial App
1. Start platform: `npm run dev` in `mvp_23`.
2. Open dashboard and enter prompt: `CRM 销售线索管理应用，包含阶段和负责人筛选`.
3. Confirm generate status progresses (`queued -> running -> done`) with step logs.
4. Confirm app workspace opens with live preview URL.

Expected:
- Project is created under `workspaces/{projectId}`.
- History contains one `generate` record with changed files.

## 2. Continuous Iteration (Apply Change)
Run these prompts one by one in `Apply Change`:
1. `新增 about 页面`
2. `增加负责人筛选`
3. `新增 blocked 状态列`
4. `增加导出 CSV 按钮`
5. `新增跟进分析页面，显示趋势`

Expected:
- Each request produces code changes (not only notes).
- History shows `iterate` entries with changed file list.
- When AI model is unavailable (HTTP 400), system still applies fallback edits:
  - spec-driven fallback updates the current business page, data API, region/spec files
  - requested pages such as `about` / `analytics` are added when relevant

## 3. CN vs INTL Differences
Generate two projects using same prompt:
1. Region `CN`
2. Region `INTL`

Check differences in each workspace:
1. `.env` values:
   - `APP_REGION`
   - `APP_LOCALE`
   - `APP_TIMEZONE`
   - `APP_CURRENCY`
2. `region.config.json` values differ.
3. `app/layout.tsx` `lang` differs (`zh-CN` vs `en-US`).
4. Preview UI differs by default language labels.
5. Seed data differs (titles/assignees/stages shown after initial load).
6. Date/currency display differs in preview header/info.

## 4. Runtime Stability
On project page:
1. Click `Start` -> preview is reachable.
2. Click `Restart` -> preview URL remains reachable.
3. Click `Stop` -> status becomes `stopped`.
4. Click `Start` again -> preview recovers.

Expected:
- No `ERR_CONNECTION_REFUSED` after successful start.
- If build fails, dev fallback starts and status/error is shown.

## 5. Failure Transparency
Simulate AI failure (or use exhausted account):
1. Trigger `Apply Change` with arbitrary requirement.
2. Confirm response includes fallback applied summary and changed files.

Expected:
- No generic "did not match fallback rules" blocker.
- User still gets runnable output, changed files, and traceable change history.
