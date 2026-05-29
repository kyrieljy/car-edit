# DECISIONS

Last updated: 2026-05-29 Asia/Shanghai

Only current decisions are kept here. Historical implementation notes were removed.

## 1. UI Changes Stay User-Directed

The user wants to judge UI visually. Implement the requested screenshot/text/behavior change and avoid broad subjective redesigns.

## 2. Desktop And Mobile Are Separate Surfaces

Desktop UI lives mainly in `components/car-mod-studio.tsx`; mobile UI lives in `components/mobile/mobile-studio-app.tsx`. Shared business state remains in the controller. Do not change PC visuals while fixing mobile unless the user asks or shared behavior requires it.

## 3. Mobile Access Banner Is Immediate UX Guard

The mobile banner handles not-logged-in and quota-empty states before business API calls. Blocked actions shake the banner only. Backend 401/402 checks remain the authority and must not be removed.

## 4. Not Logged In Does Not Auto-Open Login On Business Actions

Mobile business actions are unusable when logged out. They shake the banner instead of opening login automatically. The login banner itself can still be used as the login entry.

## 5. Quota-Empty Actions Do Not Auto-Open Subscription

Clicking generate/send/regenerate at zero quota shakes the banner and does not call generation/chat APIs. The quota banner itself remains the subscription entry.

## 6. Mobile Profile Uses Full-Screen Subpages

Profile edit, phone bind, password change, and messages use animated page transitions with back/save actions. Do not return to inline-expanded forms.

## 7. Account Messages Are Explicit-Read

A message is unread until the user opens it. Opening an open message collapses it. “All read” marks every unread message read. Payment/subscription events create persisted messages.

## 8. Subscription Navigation Returns To Source

Subscription opened from home returns home. Subscription opened from profile returns profile. Mobile entry and exit should animate.

## 9. Free Plan Is Not A Downgrade Button

Paid users should not get a misleading Free downgrade action. Current behavior is to show the current plan/disabled state; expiration returns the account to Free.

## 10. Refresh Quota Entry Is Hidden

The visible “刷新额度” row is removed from account UIs. Billing status refresh helpers and APIs remain for internal sync.

## 11. Payment Is Still Mock

Mock checkout/payment is enough for local prototype UI. Real payment must add provider integration, webhooks, idempotency, refunds, failure/cancel handling, and operational views before production claims.

## 12. Generation Uses Standard JSON

Config and Chat must converge on `GenerationStandardJson`. Prompt and provider code should preserve the first image as the canvas and treat later images as references only.

## 13. No Silent Provider Fallback

Real provider failure must be surfaced honestly. Do not show mock/original/demo output as if it was a successful real generation.

## 14. Development Verification Is Practical

Use `npx.cmd tsc --noEmit` as the main check. Browser automation may be unavailable. Avoid `npm.cmd run build` while the dev server is active.
