# Eren on the Apple App Store: iPhone launch plan

_This is a live checklist, written 2026-09-23. It draws on a research dossier covering Apple policy, the build toolchain and the iPhone browser engine, plus four code audits of this repo at `af2bf3e`. Three independent reviewers checked the draft: one against Apple's live pages, one against the Capacitor 8.5.2 source, and one against this repo. Their corrections are folded in. For store work this file replaces `LAUNCH_STATUS.md`._

_**Android is parked, not deleted.** The exact Google Play launch state is on branch `android-play-store` and tag `android-snapshot-2026-09-23` (both at `af2bf3e`, both on GitHub). See section 5._

**Status:** nothing below is started except the Android snapshot. Tick items as they land.

---

## Bottom line

- **How the app is built:** we use Capacitor 8 (the current stable 8.5.x), iOS only, with Swift Package Manager. For the first release the app loads the live Vercel site. On top of that it adds real iPhone features: Apple push notifications (APNs), haptics, a native status bar, keyboard handling and splash screen, the share sheet, and an offline screen built into the app. `/api/*` and Supabase stay where they are. If Apple rejects the live-site build, the fallback is a fully bundled build (Appendix A).
- **No Mac to buy:** we generate and edit the iOS project on Windows. A reviewer confirmed that `npx cap add ios` works on this PC. A cloud Mac (Codemagic's free tier, or GitHub Actions, which is free while this repo is public) compiles, signs and uploads it. You test through TestFlight.
- **You do need an iPhone you can keep for weeks.** Every build gets tested on a real phone, repeatedly, and there is no simulator on Windows. A phone borrowed for one afternoon is not enough. If there is no iPhone in the household, budget for a used one running iOS 17 or later.
- **Timeline (estimate):** about 5–7 weeks from starting Apple enrollment to going live, if decisions and legal facts come back quickly. About 7–10 weeks if Apple rejects the live-site build and we switch to the bundled one.
- **Cash:** USD 99 per year for the Apple Developer Program, plus possibly a used iPhone. Everything else can cost USD 0. Optional extras: a custom domain (roughly USD 10–15 per year; my estimate, not researched) and an email-sending provider (cost not researched).
- **Biggest rejection risk:** Guideline 4.2, "repackaged website". Close behind is 4.7.2: Apple may object to web content loaded from a server using native iPhone features without its permission. The more common rejections are 2.1 (incomplete app: legal placeholders, dead password reset, a crash bar, missing demo accounts) and 5.1.2(i) (AI consent). Every one of those is fixed on this checklist before we submit. 4.2 depends on the reviewer's judgment, so most of Phase 3 goes to making Eren feel like an app and not a website.

### Start here: your first five moves
1. Say whether there's an iPhone you can use for the whole project (D0).
2. Enroll in the Apple Developer Program as an individual (P0.01). Apple's approval time is the one wait we can't shorten.
3. Decide on a custom domain (D4) and the bundle ID (D3). Both are baked into the app.
4. Send the legal facts in P0.11. Your support email unblocks the most items on this list.
5. Decide on the Serbian class and chemistry lab (D22), and the drink names (D18).

---

## Words used in this plan

- **Capacitor**: a free, open-source tool that puts a web app inside a real iOS app. It lets the web code use phone features (push, vibration, keyboard) through small add-ons called _plugins_.
- **Web view** (Apple calls it _WKWebView_): the Safari engine running inside an app. All of Eren's screens run inside one.
- **APNs**: Apple Push Notification service, the only way to send a notification to a native iPhone app. Eren currently uses _Web Push_, which does not work inside apps.
- **Service worker**: `public/sw.js`, the background script that caches art and receives web push in the browser. It does not run inside the iOS app.
- **App Store Connect**: Apple's website for the listing, builds, questionnaires, testers and submission.
- **App Review**: the Apple staff who approve or reject each submission.
- **TestFlight**: Apple's beta-testing app. This is how builds get onto your iPhone without a Mac.
- **Bundle ID**: the app's permanent ID, written like a reversed domain (`com.example.eren`).
- **Cloud Mac / CI**: a Mac rented by the minute. It builds, signs and uploads the app when a script tells it to.
- **Signing, `.p8` key**: signing is cryptographic proof that a build comes from your account. A `.p8` is a key file Apple lets you download exactly once.
- **Info.plist, entitlements**: plain-text settings files in the iOS project, holding permission messages and capabilities such as push.
- **Privacy manifest**: `PrivacyInfo.xcprivacy`, a file that declares what data the app collects and why it uses certain system features.
- **Static export / bundled build**: turning the site into plain files that ship inside the app, so nothing is loaded from Vercel.
- **Migration**: a `.sql` file you paste into the Supabase SQL editor. Project rule: never run from app code.
- **RPC**: a database function the app calls. We use one when a column must be protected from direct writes.
- **OTP**: a one-time 6-digit code sent by email.
- **Universal Links**: https links that open the app instead of Safari.

**Checklist tags.** **[YOU]** means only you can do it: accounts, money, legal facts, device testing. **[CODE]** means engineering work in this repo. Effort: **S** is half a day or less, **M** is 1–2 days, **L** is 3–5 days, **XL** is more than a week. Where the research was uncertain, the item says so.

---

## 1. Decisions only you can make

### D0. Which iPhone do we test on?
- **Recommendation:** one iPhone on iOS 17 or later that stays with you for the whole project. It will also sometimes need a USB cable to this PC for debugging.
- **Why:** Phases 2–5 mean installing many TestFlight builds and testing push, memory, Low Power Mode and staying logged in, all on a real device. Windows has no iPhone simulator.
- **If we get it wrong:** each test round waits on getting the phone back, and the whole timeline stretches.

### D1. Buy a Mac, or build in the cloud?
- **Recommendation:** don't buy a Mac. Use **Codemagic**, which gives a personal account 500 free macOS minutes a month (about 25–40 builds), a web UI, and a documented Capacitor-to-TestFlight flow ([pricing](https://codemagic.io/pricing/)). Keep a **GitHub Actions** workflow on `macos-26` as a free backup, because standard runners are "free and unlimited on public repositories" and this repo is public ([GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)). Testing happens on the iPhone from D0.
- **Why:** Xcode, which compiles and signs iOS apps, runs only on macOS, and uploads must be built with the iOS 26 SDK or later ([Apple](https://developer.apple.com/news/?id=ueeok6yw)). Everything else works from Windows: generating the iOS project, editing its settings, App Store Connect, keys.
- **If we get it wrong:** switching CI services is cheap, about a day. If you ever need a real Mac screen (iPad simulator, Safari Web Inspector), rent one Scaleway Mac mini for a day. That costs at least about EUR 2.64, because leases are 24 hours ([Scaleway](https://www.scaleway.com/en/pricing/apple-silicon/)). If the repo is made private later, GitHub macOS minutes become paid (USD 0.062/min). Codemagic is unaffected. Because the repo is public, keys must live only in encrypted CI secrets.
- **Pin the Xcode version in CI.** GitHub's `macos-26` image defaults to Xcode 26.6, while Codemagic's `latest` already resolves to Xcode 27. Whichever builds the app, the version must be stated, not left as "latest" (see P2.02 on UIScene).
- **Debugging from Windows is the weakest link.** Inspect.dev's own guide says it can only debug developer-signed apps, and every build we can make without a Mac is TestFlight-signed. It may still work; we find out on the first build. Either way, we build an in-app debug console and send errors to a database table (P2.16), so we're never blind.

### D2. Enroll as an individual or an organization, and what name shows?
- **Recommendation:** individual.
- **What shows:** your personal legal name, **Jovan Špinjo**, appears as the seller. Aliases are not allowed ([Apple](https://developer.apple.com/help/account/membership/program-enrollment/)). The same name must appear as the data controller in the privacy policy and terms.
- **Why:** an organization needs a D-U-N-S number, a legal entity (no trading names), a domain email and a public website. Individual enrollment is processed on purchase.
- **Rules for an individual:** you must be of legal age, and you must use your legal name. A nickname or alias "will cause a delay". The address cannot be a P.O. box.
- **If we get it wrong:** Apple documents a way to convert an individual account to an organization later ("please contact us"), so this is recoverable ([Apple](https://developer.apple.com/help/account/membership/program-enrollment/)).

### D3. Permanent bundle ID
- **Recommendation:** use the reverse of a domain you own. For example, if you buy `example.com`, use `com.example.eren`. Don't base it on `vercel.app` or on the old Android ID `app.vercel.eren_care_app.twa`. Decide before the first TestFlight upload.
- **Why:** it ties together the App ID, signing, and push (APNs uses it as the "topic").
- **If we get it wrong:** plan as if it can never change.

### D4. Custom domain
- **Recommendation:** buy one and point it at Vercel **before the first TestFlight build**. Keep `eren-care-app.vercel.app` working as an alias.
- **Why:** the site address is compiled into the app (Capacitor `server.url`). A domain also gives you a real sender for password emails and a support address. And it protects the app if the Vercel project is ever renamed.
- **One exact address.** The app treats only the exact address in `server.url` as "inside the app". It compares addresses as text, and anything else opens in Safari. So:
  - no redirect from the bare domain to `www` (or back);
  - no redirect from `eren-care-app.vercel.app` to the new domain. The pg_cron jobs call the vercel.app address directly, and a redirect would break decay, reminders and every notify job;
  - both hosts serve the site directly in Vercel.
- **If we get it wrong:** changing the address later needs a new app build, and every user has to update.

### D5. Store name if "Eren" is taken
- **Recommendation:** try "Eren" when creating the app record (P0.06). Have a fallback of 30 characters or fewer ready, such as **"Eren: Pixel Cat"**.
- **Why:** names must be 2–30 characters and unique ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)). A search found no app named exactly "Eren". But an unreleased app can hold the name, and you only find out by trying. I found no information on whether "EREN" is a registered trademark.
- **Hard rule:** never use "Attack on Titan", "Titan" or "Yeager" in the name or keywords (Guidelines 2.3.7 and 4.1(c), [guidelines](https://developer.apple.com/app-store/review/guidelines/)).
- **Also:** keep the arcade game "Flappy Eren" out of the store name, keywords and screenshots, or rename it. Apple has a history of rejecting "Flappy" titles as copycats. The risk is low.

### D6. iPhone only, or iPad too?
- **Recommendation:** iPhone only (`TARGETED_DEVICE_FAMILY = 1`), locked to portrait.
- **Why:** declaring iPad support means providing a 13-inch screenshot set. Also, at widths of 481px and up, Eren draws itself as a small "phone frame" on black (`src/app/globals.css:87-148`), which looks like a website on iPad.
- **Still required:** an iPhone app must "perform in substantially the same manner" when run in iPad compatibility mode ([DPLA 3.3.1(E)](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)), and reviewers test this. One iPad test session is on the checklist (P5.02).

### D7. Age rating
- **Recommendation:** **18+**. Keep the terms' "You must be 18 or older", answer Apple's questionnaire honestly (P4.03), then set the store rating to 18+ to match.
- **Why:** Eren has an AI companion with long-term memory, private messaging and photos. Serving minors would mean extra safeguards in /talk ([Anthropic guidance](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)) and rewritten terms and privacy text. With an 18+ rating, the loot-box bumps in Australia and Brazil no longer change anything.
- **Not optional:** when your terms set a higher minimum age than Apple's questionnaire works out, App Store Connect says you **must** use "Override to Higher Age Rating".
- **US state age laws are already in force, not pending.** They apply to new Apple Accounts in Utah (from 2026-05-06), Texas (2026-06-04) and Louisiana (2026-07-01). Apple says developers "may have separate obligations", and points to its Declared Age Range API ([Apple](https://developer.apple.com/news/?id=sg176nne), [Apple](https://developer.apple.com/news/?id=f5zj08ey)). What a free, purchase-free 18+ app must do is **unclear (low confidence)**. Settle it before submission: either a short legal check, or a native age-range check at signup (P3.22).
- **Cost:** Apple blocks 18+ downloads in Australia, Brazil and Singapore unless the user is a confirmed adult, and reach is smaller everywhere.
- **If we get it wrong:** a store rating below the terms' 18+ is a visible mismatch. Lowering the rating later means /talk safeguards and new legal text.

### D8. Telemetry (crash or usage reporting)
- **Recommendation:** none in version 1. There is no analytics or crash kit in the app today (`package.json`).
- **Why:** there is nothing extra to declare in the privacy label or manifest, and no new third party.
- **Cost:** you won't see crashes on strangers' phones. We rely on TestFlight feedback and a careful device pass. Adding a crash reporter later means updating the privacy label (which can change without an app update, [Apple](https://developer.apple.com/app-store/app-privacy-details/)) and the privacy policy.

### Other decisions

| # | Decision | Recommendation | Why, and the cost if wrong |
|---|---|---|---|
| D9 | Architecture | Live site first (Capacitor `server.url`). Bundled build (Appendix A) as the fallback. | The research split. **Against the live site:** Capacitor says `server.url` is "not intended for use in production" ([docs](https://capacitorjs.com/docs/config)). And Guideline 4.7.2 (added Nov 2025) says remotely loaded HTML5 games and chatbots may not use native iPhone features "without prior permission from Apple". A strict reviewer could read Eren's remote games and /talk that way (medium-low confidence). **For it:** Apple's developer agreement (DPLA 3.3.1(B)) does allow downloaded web code, as long as it doesn't change the app's main purpose ([DPLA](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)). Login cookies, `/api` and `/auth/callback` keep working unchanged, and one deploy serves web and iPhone. Bundling costs about 7–10 extra dev-days, and every UI change then waits for review. A rejection takes 1–2 days to learn about, since 90% of submissions are reviewed in under 24 hours ([Apple](https://developer.apple.com/distribute/app-review/)). Cost if wrong: one lost review round, then Plan B. The review notes present the games and chat as core parts of Eren, not separate mini-apps. |
| D10 | EU trader status (Digital Services Act) | Non-trader, but only if you honestly see Eren as a free hobby project with no ads or sales. Otherwise trader, with a P.O. box, phone and email that get published. | Required even though you're in Serbia, because Eren would be offered in the EU. With no declaration, Apple removes the app from EU storefronts ([Apple](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)). A portfolio or job-hunt purpose, or any future monetisation, points toward "trader". |
| D11 | Push provider | APNs directly, no Firebase | Fewer moving parts, and it keeps Firebase and its extra privacy declarations out of the app ([Apple SDK list](https://developer.apple.com/support/third-party-SDK-requirements/)). Cost: a second sender (Firebase/FCM) when Android arrives. |
| D12 | Lock-screen previews | Generic text for journal messages and mood alerts on iPhone, e.g. "New message in your journal" | Today the policy says push content is end-to-end encrypted. That is true for web push but not for APNs (`policy.md:140-143, 283-284`). We rewrite the policy either way. Generic previews also keep private text off lock screens. |
| D13 | Reminders on iPhone | Server-sent pushes only in v1 | Works for both partners with no duplicate handling, but can arrive up to about 15 minutes late. The `fire-reminders` cron must keep running (P3.10). Exact reminders scheduled on the phone come later (P6.08). |
| D14 | Memory-wall photos in v1 | Leave out. The page is already unreachable from any menu. | Keeps "Photos" off the privacy label and avoids photo moderation. If you want photos in: we add downscaling, moderation, and a Photos declaration. |
| D15 | Account deletion and shared content | Delete the leaving user's own journal messages, notes and photos, and say so in the confirm dialog | Apple says people expect all their data deleted, "including user-generated content that's shared with others" ([Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app/)). Today co-authored rows are anonymised and kept. Cost: the partner loses shared history. The alternative is offering a choice. |
| D16 | Partner data sent to the AI | Stop sending the partner's name and care actions to Anthropic unless the partner has also agreed | 5.1.2(i) requires explicit permission, and the partner never gave it. Cost: Eren's replies know less about the partner. |
| D17 | Password reset | Set up custom email sending and switch reset to a 6-digit code. If that isn't ready, hide "Forgot password" in v1. | Supabase's built-in mailer only delivers to project team members ([Supabase](https://supabase.com/docs/guides/auth/auth-smtp)). A visible dead feature is a 2.1 rejection. |
| D18 | New name for the "Monsta" drinks | Your pick: an original brand that doesn't echo Monster | The kitchen shop still shows "Loco / Pipeline / Punch / Rosa / Peachy Monsta" (`src/components/care/FeedScene.tsx:95-104`). |
| D19 | Moderation promise | Commit to acting on reports within 24 hours, and actually do it | Apple's standard 1.2 rejection asks for action within 24 hours ([forum](https://developer.apple.com/forums/thread/116703)). The terms currently say "[PLACEHOLDER: e.g. 72 hours]". |
| D20 | Storefronts | Everywhere except China mainland | China needs a game approval number and an ICP filing, plus it has generative-AI rules. That's impractical for an individual in Serbia ([forum](https://developer.apple.com/forums/thread/743661); low confidence). Brazil is fine with an 18+ rating. |
| D21 | Loot-box and other borderline age-rating questions | Answer conservatively: loot boxes Yes; simulated gambling Infrequent (the bakery's coin-paid SPIN machine); contests Frequent | It is unclear whether gacha paid with earned currency counts as "for purchase" ([3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)). With an 18+ rating, rating too high costs nothing, while declaring too little is a Guideline 2.3.6 rejection. |
| D22 | The Serbian class room and the chemistry lab | **Your call, and a real one.** Either keep them as features and say so in the listing ("learn some Serbian with Eren"), or hide them in v1 | These are the clearest "made for one couple" signals left. The rooms menu has a Serbian Class (`src/components/home/RoomsMenu.tsx:40`). "Serbian Lesson" is the highest-paying daily quest at 60 coins (`src/lib/tasks.ts:13-15`), and Serbian lines appear in wishes and idle chatter (`src/lib/wishes.ts:177`, `src/lib/flavorLines.ts:97`). The chemistry lab has two 35-coin daily quests. Apple rejects apps made "just for family and friends". Kept as features, they are charming. Left unexplained, they read as private. Also: the Serbian voice relies on a Croatian speech voice that iPhones may not have, so the speaker buttons can be silent (tested in P5.01). |

---

## 2. Timeline and critical path

**Critical path:** enrollment (P0.01) → App ID and keys (P0.05–P0.08) → first TestFlight build (Phase 2) → push and native feel (Phase 3) → device testing → external beta review → submission. Phase 1 can start today in parallel, but it needs your legal facts (P0.11).

| Phase | Mostly | Estimated effort | Can start |
|---|---|---|---|
| 0 Accounts and decisions | You | A few hours of your time. Apple's enrollment wait is unknown (hours to days). | Today |
| 1 Web-app fixes | Code, plus your legal facts | 7–10 dev-days | Today, in parallel with Phase 0 |
| 2 Capacitor shell and build pipeline | Code, plus your keys | 4–6 dev-days. Every try means a remote build (10–20 min) plus Apple's processing (10–30+ min), and first-time signing mistakes only surface that way. | iOS folder today; signed builds after enrollment |
| 3 Native capabilities | Code | 5–8 dev-days | After the first TestFlight build |
| 4 Store listing and compliance | You, from drafts I prepare | 2–3 days | During Phase 3 |
| 5 TestFlight, submit, review | You and code | 1–2 weeks including review rounds | After Phases 3 and 4 |
| Plan B (only if needed) | Code | 7–10 more dev-days plus one more review round | After a 4.2 rejection |

These are estimates, not dossier facts.

**Ordering rule: paste the migration first, then push the code.** `master` deploys to the live site automatically, and that site is also what the iPhone app loads. If code that expects a new column or RPC is pushed before you've pasted its migration, it breaks for everyone at once: /talk returns 403, and all 12 push routes fail. So for every item that ships a migration (P1.12, P1.23, P3.01): I write the SQL, you paste it and confirm, then I push. Alternatively the code tolerates the missing column until you confirm.

---

## 3. Phased plan

### Phase 0: Accounts and decisions (start today)

- [ ] **P0.01 [YOU] S**: Enroll in the Apple Developer Program as an individual, on the web ([enroll](https://developer.apple.com/programs/enroll/)).
  - You need an Apple Account with two-factor authentication and your legal name.
  - The fee is USD 99 per year, charged in local currency. Whether VAT is added in Serbia is unknown.
  - No Apple device is needed.
  - Serbia is a listed App Store storefront ([Apple](https://developer.apple.com/help/app-store-connect/reference/financial-report-regions-and-currencies/)). Serbia-specific ID checks are unconfirmed: one 2023 report describes an ID-upload failure.
  - If no confirmation arrives within 24 hours, contact Apple.
- [ ] **P0.02 [YOU] S**: Make decisions D0–D8 (needed before Phase 2), D22 (needed before Phase 1 finishes) and D9–D21 (needed before Phase 4).
- [ ] **P0.03 [YOU] S**: If D4 is yes, buy the domain and add it to the Vercel project as a direct serve, not a redirect. Then:
  - Keep `eren-care-app.vercel.app` serving too, with **no redirect**, because several pg_cron jobs and a fallback in `src/lib/serverPush.ts:9` call it by name.
  - Update `NEXT_PUBLIC_APP_URL` in Vercel and redeploy (it is baked in at build time).
  - Add the new domain to Supabase → Authentication → URL Configuration, both the Site URL and the Redirect URLs list.
  - P0.10 (email sending) depends on this, because a sending domain needs SPF/DKIM records on a domain you own.
- [ ] **P0.04 [YOU] S**: Line up devices:
  - an iPhone on iOS 17 or later (TestFlight needs 16+, and we target 17);
  - ideally also an older, smaller-memory iPhone for one memory test;
  - an iPad for one session (P5.02).
- [ ] **P0.05 [YOU] S**: Once enrolled, go to Certificates, Identifiers & Profiles. Register the App ID with your bundle ID (D3) and switch on **Push Notifications**.
- [ ] **P0.06 [YOU] S**: In App Store Connect, create the app record. This reserves the name (D5). Accept the Free Apps agreement. A free app needs no banking or tax forms.
- [ ] **P0.07 [YOU] S**: Create an App Store Connect API **Team** key under Users and Access → Integrations ([Apple](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)).
  - Save the `.p8` (you can download it only once), the Key ID and the Issuer ID.
  - Role: Codemagic recommends App Manager. GitHub Actions cloud signing reportedly needs Admin ([forum](https://developer.apple.com/forums/thread/698117); medium confidence).
- [ ] **P0.08 [YOU] S**: Create an APNs authentication key (Keys → enable APNs). Save the `.p8`, its Key ID and your Team ID.
  - **Choose the Production environment** (or "Sandbox & Production") and team scope. Since February 2025 new keys are tied to an environment, and TestFlight and App Store builds use Production. A Sandbox-only key makes every push fail ([Apple](https://developer.apple.com/news/?id=wy4tb0uo), [Apple](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns)).
  - A team-scoped key works for all your apps.
- [ ] **P0.09 [YOU] S**: Store the keys as encrypted secrets in Codemagic (or GitHub). Never commit a `.p8`: the repo is public.
- [ ] **P0.10 [YOU] M**: Set up custom email sending (SMTP) for Supabase Auth (D17). I did not research which provider or what it costs.
- [ ] **P0.11 [YOU] S**: Send me the legal facts for Phase 1:
  - one support email;
  - your full legal name and postal address;
  - governing law / jurisdiction;
  - the publish date;
  - your Supabase region;
  - log retention and backup retention;
  - whether to keep the EU-representative (Art. 27) paragraph;
  - your data-protection supervisory authority;
  - the report response time (24 hours, per D19).
- [x] **P0.12a [CODE] S**: Point `LAUNCH_STATUS.md` at this file for store work.
- [ ] **P0.12b [YOU] S**: Run `supabase/probe_migration_state.sql` in the Supabase SQL editor (project `bjnnqqxjjihmsbljeayf`; the dashboard may open a different project) and paste the result back to me, so new migrations build on the database's real state.
- [ ] **P0.13 [YOU] S**: In Supabase → Authentication → Providers → Email, check that **"Confirm email" is OFF**. Onboarding needs an immediate session (`src/lib/onboarding.ts`), so turning it on would strand every new signup.

### Phase 1: Web-app fixes that are needed anyway

#### 1A. What a reviewer taps in the first five minutes (Guideline 2.1)
Apple wants final versions with "placeholder text... scrubbed", a demo account, and the backend switched on. Over 40% of unresolved review issues relate to 2.1 ([2.1](https://developer.apple.com/app-store/review/guidelines/#2.1), [App Review](https://developer.apple.com/distribute/app-review/)).

- [ ] **P1.01 [CODE] S**: Make the legal pages escapable. iPhone has no back button, and Capacitor turns off swipe-back. Opening Terms from the TermsGate currently strands the user and makes the app unusable.
  - Add a sticky "< BACK" to `src/components/legal/LegalDoc.tsx:154-174` and `/delete-account`.
  - The TermsGate links (`src/components/legal/TermsGate.tsx:95-102`) must return to the gate.
  - Replace the signup `target=_blank` links (`src/components/onboarding/pixelForm.tsx:262`, `AccountStep.tsx:93-94`) with an in-app view that keeps the half-filled form.
- [ ] **P1.02 [CODE] S**: Stop the "SOMETHING BROKE" bar. The Reminders ENABLE button calls `Notification.requestPermission()` with no guard (`src/components/ReminderSheet.tsx:87-90`), and that API does not exist in the app. Guard it and hide the "NOTIFICATIONS OFF" banner. The proper fix is P3.05.
- [ ] **P1.03 [CODE] S**: Remove "Install him later from Safari's share menu" (`src/components/onboarding/IntroSlides.tsx:189-191`) when running inside the app. Every reviewer would see it, and it reads as a website.
- [ ] **P1.04 [CODE] S**: Handle a failed copy of the invite code (`src/app/(app)/profile/page.tsx:202-207`). Today a failure can trigger the crash bar and still says "copied".
- [ ] **P1.05 [CODE] S**: Hide "FORGOT YOUR PASSWORD?" (`src/app/auth/login/page.tsx:86`) until P3.19 ships.
- [ ] **P1.06 [CODE] S**: Nothing may suggest the app exists for one specific couple. Apple says apps "just for family and friends" don't belong on the store ([guidelines](https://developer.apple.com/app-store/review/guidelines/)), and it rejects "small niche market" apps ([App Review](https://developer.apple.com/distribute/app-review/)).
  - Sweep the copy.
  - Carry out D22 (Serbian class and chemistry lab): present them as features, or hide them.
  - Confirm the hardcoded `ERENHOME` household in `supabase/seed.sql:7-8` does not exist or cannot be joined in production.
  - Make solo play obvious without a partner.

#### 1B. Legal pages and contact (Guidelines 5.1.1(i) and 1.2)
- [ ] **P1.07 [CODE] S**: Fill the placeholders and fix the dates:
  - the 21 placeholders in `src/app/privacy/policy.md`;
  - the 13 in `src/app/terms/terms.md`;
  - the `mailto:PLACEHOLDER@example.com` at `src/app/delete-account/page.tsx:123`.

  Set both "Last updated" dates and `TERMS_LAST_UPDATED` (`TermsGate.tsx:29`) to the real publish date. **Never use a future date**, or the gate can't be dismissed.
- [ ] **P1.08 [CODE] S**: Add a new public `/support` page with the support email, links to privacy and terms, and how to delete an account.
  - It becomes the App Store Support URL. App Store Connect Help says that URL must lead to "actual contact information (legal address, email address, telephone number) as may be required by local law". Guideline 1.5 asks for "an easy way to contact you" ([help](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)). Whether EU or Serbian law needs a postal address or phone number on it goes to your legal check.
  - Link it inside the app too: in Profile next to PRIVACY and TERMS (`src/app/(app)/profile/page.tsx:1120-1131`), and in the TermsGate.
- [ ] **P1.09 [CODE] M**: Rewrite the privacy policy for the iPhone app:
  - APNs delivers iPhone notifications, and they are not end-to-end encrypted (D12).
  - Use iPhone photo-picker and camera wording (`policy.md:83-85, 145-150`).
  - Name "Anthropic's Claude" instead of a specific model. The policy says `claude-opus-5`, but the code uses `claude-sonnet-5`.
  - Either ship the transcript delete (P1.14) or drop the claim at `:245`.
  - Remove the mood-note mention.
  - Handle Google Fonts (P1.35).
  - Fix the two sections both numbered 2.5.
  - **Name no Android, Google Play or Firebase anywhere the iPhone app shows** (Guideline 2.3.10, [guidelines](https://developer.apple.com/app-store/review/guidelines/)).
  - Guideline 5.1.1(i) items: state that every third party that receives data (Anthropic, Supabase, Vercel) gives "the same or equal protection". Explain retention and deletion. Explain how a user withdraws consent, including the AI switch in P1.14.
- [ ] **P1.10 [CODE] S**: Terms: add an explicit "zero tolerance for objectionable content or abusive users" sentence to §4, and set the report response to 24 hours in §6 (`terms.md:134`).

#### 1C. AI chat consent (Guideline 5.1.2(i))
Since 13 Nov 2025 apps must "clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so" ([Apple](https://developer.apple.com/news/?id=ey6d8onl)).

Today /talk sends Anthropic your name and level, your partner's name and care actions, the last 30 messages and up to 60 saved memories (`src/app/api/chat/route.ts:178-217`), with no permission step. The attic composer can send without ever showing the AI note.

- [ ] **P1.11 [CODE] M**: Show a consent sheet before the first message, on both entry points (`src/components/talk/TalkView.tsx`, and the attic `src/components/care/TalkScene.tsx:134` → `RoomComposer.tsx`).
  - It names Anthropic and lists what is sent.
  - It offers "Allow" and a "Not now" that really declines.
  - The check runs in `useErenChat` before any call to `/api/chat`.
  - Developer write-ups say reviewers accept exactly this shape (name the provider, list the data, real decline, before the first call). That is a secondary source, medium confidence ([write-up](https://stora.sh/blog/2026-05-06-apple-ai-consent-rule-5-1-2-i-implementation-guide)).
- [ ] **P1.12 [CODE] S**: Record consent on the server with an RPC `accept_ai_sharing()` plus a migration. Profile columns are not client-writable; see the grant gotcha in `CLAUDE.md`. `/api/chat` refuses with 403 until consent exists.
- [ ] **P1.13 [YOU] S**: Paste that migration.
- [ ] **P1.14 [CODE] S**: In Profile, add an "AI chat sharing" off switch, "Forget memories" and "Clear conversation".
- [ ] **P1.15 [CODE] S**: Per D16, stop sending the partner's name and actions (`route.ts:191, 209-216, 266-268, 291-299`) unless the partner has also agreed.
- [ ] **P1.16 [CODE] S**: Add an instruction to the persona (`src/lib/erenPersona.ts`): step out of character and point to local help if self-harm comes up. Add a report option on the attic speech bubble (`ErenSpeechBubble.tsx`), not only in the transcript.

#### 1D. Content people write and share (Guideline 1.2)
The rule requires four things: a filter, a way to report plus timely response, blocking, and published contact info ([1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)). App Review's standard message adds terms stating zero tolerance, and action within 24 hours ([forum](https://developer.apple.com/forums/thread/116703)). No Apple source exempts content shared inside a household of one or two people, so we assume full 1.2.

Already done: report on journal messages, notes, memories, partner profile and the AI transcript; blocking the partner; accepting the terms before use.

- [ ] **P1.17 [CODE] M**: Send you an alert whenever someone files a report: a trigger or webhook on `content_reports` inserts (`supabase/migration_reports_blocks.sql:33-55`). An email alert needs P0.10 (email sending). A push alert can reuse today's web push to your own browser.
- [ ] **P1.17b [CODE] M**: Moderation tooling. None exists today: `content_reports` appears only in its migration. Provide a short runbook plus saved SQL snippets, or a minimal admin-only page, for four jobs: read a report and its snapshot, remove the content, ban an account, and mark the report handled. This must exist before submission, because the review notes promise action within 24 hours.
- [ ] **P1.18 [CODE] M**: Add a server-side word filter for display names, household names, journal messages and notes.
- [ ] **P1.19 [CODE] S**: Add a visible report button on messages and notes, not only the hidden long-press (`src/hooks/useLongPress.ts`). Reviewers often don't find long-press.
- [ ] **P1.20 [CODE] S**: Keep bottom sheets clear of the home-indicator bar: `paddingBottom: calc(20px + env(safe-area-inset-bottom))` in `src/components/safety/MessageActions.tsx:48-55`, the ReminderSheet, and the memories sheet.
- [ ] **P1.21 [YOU] S**: Commit to the 24-hour promise (D19) and decide on photos (D14).
- [ ] **P1.22 [CODE] S**: If photos are out, keep `/memories` unreachable in the app and make the privacy text match. If they're in, downscale and convert to JPEG before upload (`src/app/(app)/memories/page.tsx:150-175`) and add moderation.

#### 1E. Account deletion (Guideline 5.1.1(v))
This already works: Profile → DELETE ACCOUNT → confirm → `delete_my_account()` clears 21 tables and the login.

- [ ] **P1.23 [CODE] M**: Per D15, extend `delete_my_account` (`supabase/migration_reports_blocks.sql:565-658`) to delete the leaving user's own journal messages, notes and photos. Update the confirm dialog (`profile/page.tsx:1147-1187`) and privacy §6 and §9.
- [ ] **P1.24 [YOU] S**: Paste that migration.
- [ ] **P1.25 [CODE] S** (optional): Add a "Delete my account" action inside TermsGate. Today people who decline are sent to a 30-day web form (`TermsGate.tsx:131-132`).

#### 1F. Randomized rewards (Guideline 3.1.1)
- [ ] **P1.26 [CODE] S**: Label the gacha info button "ODDS" (`src/app/(app)/gacha/page.tsx:444-453`). Show "1 in N (x%)" in the donut machine before a spin (`DonutCasePanel.tsx:259`). The odds rule clearly covers randomized items bought with money ([3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)). Whether it covers earned currency is unclear, and disclosing is cheap.

#### 1G. Trademarks (Guideline 5.2)
- [ ] **P1.27 [CODE] S**: Rename the drinks on the shop cards and the purchase toast (`FeedScene.tsx:95-104, :528`) to the D18 name.
  - Rename the descriptions too. "Zero sugar ultra", "Mango loco kick", "Pipeline punch" and "Ultra rosa fizz" echo Monster's product lines.
  - `src/lib/foodMeta.ts:67-80` already has different names, and they still use the "Monsta" suffix, so D18 changes both files. Make FeedScene read names from `foodMeta.ts` so they can't drift again.
  - Keep the `monsta_*` IDs, because inventories store them.
- [ ] **P1.28 [CODE] S**: Replace the pixel Pikachu doodle (`src/components/care/SchoolScene.tsx:2748-2771`, used at 2808 and 2814).

#### 1H. iPhone browser-engine fixes
- [ ] **P1.29 [CODE] S**: Sound dies after a call, Siri or the lock screen, and Purr Beat freezes.
  - Resume audio whenever its state is anything but "running" or "closed": `src/lib/soundSynth.ts:85-90, 373, 398, 425, 463`; `SchoolScene.tsx:226`; `eren-says/page.tsx:52`.
  - Add one global tap listener that unlocks audio.
  - Add a watchdog: if the audio clock stops advancing, suspend and resume, then recreate the audio context if that fails.
  - Purr Beat pauses when the app goes to the background ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)).
- [ ] **P1.30 [CODE] S**: The silent switch mutes web audio. That is normal iPhone behaviour for sound effects.
  - In Purr Beat only, set `navigator.audioSession.type = 'playback'` and restore it on exit. Safari has had this since 16.4.
  - **Low confidence:** nothing confirms it works inside an app's web view, and WebKit reports that the web view ignores the app's own audio setting ([WebKit](https://bugs.webkit.org/show_bug.cgi?id=167788)). Test it on the first TestFlight build.
  - The fallback is acceptable: tell testers the rhythm game is silent in silent mode.
  - Also check on the device that Eren's sounds mix with the user's music instead of stopping it.
- [ ] **P1.31 [CODE] S**: Add `WebkitBackdropFilter` next to the ~31 inline `backdropFilter` styles. Without it, iPhones below iOS 18 draw no blur. Also check `CoinPayoutBurst.tsx:140`.
- [ ] **P1.32 [CODE] M**: Fix the memory load that crashes older iPhones. The closet and collection decode about 236 MB of full-size art to draw small tiles, and older iPhones kill the web view (white flash, reload) ([Apple](https://developer.apple.com/videos/play/wwdc2018/416/)).
  - Make 256px thumbnails in `scripts/build_skins.cjs` and point `thumb` at them (`src/lib/skinsData.ts:18-21`).
  - Add `loading="lazy" decoding="async"` to grid images in `ClosetView.tsx` and `CollectionView.tsx`.
  - Save gacha and game results before playing their animations, so a reload can't lose a pull.
- [ ] **P1.33 [CODE] S**: Cap `AnimatedEren.tsx:205` at a pixel ratio of 2. Freeze SketchEren's animated filter (`SketchEren.tsx:81-86`) under reduced motion or when several are on screen.
- [ ] **P1.34 [CODE] S**: Move `overscroll-behavior: none` from `body` to `html` (`globals.css:76-79`), and add `overscroll-behavior: contain` to inner scroll areas (chat, sheets, lists). Whole-app bounce is already off in Capacitor, so this CSS covers the rest.
- [ ] **P1.35 [CODE] S**: Self-host the fonts in place of the Google Fonts `@import` (`globals.css:1-2`). They then work offline, and users' IP addresses stop going to Google.
- [ ] **P1.36 [YOU] S**: Low Power Mode caps animation at 30 fps ([WebKit](https://bugs.webkit.org/show_bug.cgi?id=215745)). The games checked so far (treat-tumble, jelly jump, paw-doku) already use elapsed time, so this is one device pass inside P5.01, not a code job.
- [ ] **P1.37 [CODE] M**: iOS can wipe web storage on a nearly full phone ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)). Move the potion "one pour a day" limit to Supabase. Let BEST scores and "seen" badges cope with being empty.
- [ ] **P1.38 [CODE] M**: Convert room PNGs to WebP and bump the `?v=` query. Rooms load faster in the app and use less Vercel bandwidth.
  - `public/sw.js` lists those PNG paths in `PRECACHE_IMAGES` (lines 32-47). Edit that list and bump `SW_VERSION` in the same commit, or web users keep stale art or hit 404s.
  - Keep the source PNGs: `scripts/build_window_frames.py` reads them to cut the weather overlays.
- [ ] **P1.41 [CODE] S**: Add long-lived cache headers (`Cache-Control: public, max-age=31536000, immutable`) in `next.config.mjs` for art that is only referenced through `?v=`-versioned URLs. Inside the app nothing caches images, because there is no service worker there. Vercel serves `/public` with `max-age=0`, so otherwise every cold launch re-checks every room image over the phone's connection.

#### 1I. Server fixes found in the audits
- [ ] **P1.39 [CODE] S**: `/api/memory/catchup` uses the admin database client and trusts `user_id` from the request (`src/app/api/memory/catchup/route.ts:311-327`). Call `authorizeRequest()`.
- [ ] **P1.40 [CODE] S**: In `/api/decay`, move the memory-wall sweep (`route.ts:248-250`) above the early returns at 196-215. Otherwise a household with no push subscription is never swept, and that is every iPhone-only household until Phase 3.

### Phase 2: Capacitor shell and build pipeline from Windows

- [ ] **P2.01 [CODE] S**: Keep one codebase. All native code runs only behind `Capacitor.isNativePlatform()`, so the website and the Android snapshot behave exactly as before. Work on `master`; a short-lived branch is fine.
- [ ] **P2.02 [CODE] S**: Add `@capacitor/core`, `@capacitor/cli` and `@capacitor/ios`, pinned to `^8.5.2`. Do not use the 9.0 alpha ([npm](https://www.npmjs.com/package/@capacitor/core)).
  - Capacitor 8 needs Xcode 26+ and Node 22+. Your local Node 24 is fine ([Capacitor](https://capacitorjs.com/docs/updating/8-0)).
  - Use Swift Package Manager, not CocoaPods. CocoaPods stops accepting new packages on 2026-12-02 ([CocoaPods](https://blog.cocoapods.org/CocoaPods-Specs-Repo/)).
  - **Keep the UIScene setup.** Xcode 27 shipped on 2026-09-14. Apps built with it that don't use Apple's "UIScene" lifecycle are killed at launch, and from April 2027 every upload must use it ([Apple](https://developer.apple.com/news/?id=k1mtkt1k)). A fresh Capacitor 8.5.2 project already includes `SceneDelegate.swift` and the scene entry in `Info.plist` ([Capacitor 8.5](https://capacitorjs.com/docs/updating/8-5)). Rules:
    - never delete either of them;
    - put native customisations in `SceneDelegate.swift`, not in the storyboard or in `AppDelegate` window code;
    - ignore tutorials written for Capacitor versions before 8.5.
- [ ] **P2.03 [CODE] S**: Create `capacitor.config.ts`:
  - `appId` = your bundle ID (D3); `appName` "Eren"; `webDir` `native-shell`.
  - `server.url` = the exact canonical https origin (D4): no path, no trailing slash and nothing that redirects. Capacitor treats a page as "in the app" only if its address starts with this exact text. Anything else opens in Safari, including every `target=_blank` link. Don't use `server.allowNavigation` as a workaround; its docs say it's not for production.
  - `server.errorPath` `offline.html`.
  - `ios.contentInset` `never`; `ios.backgroundColor` `#FDF6FF`; `ios.allowsLinkPreview` false. The last one stops long-pressing a link from opening a preview that can drop the user into Safari.
  - `ios.webContentsDebuggingEnabled` **true**. It is off by default for release builds. The build you test in TestFlight is the exact build you submit, so there is no "TestFlight-only" switch. Leave it on (no guideline forbids it, and the content is a public site anyway), or smoke-test a second build with it off.
  - **No** App-Bound Domains. The research disagreed here. Apple says there's no supported way to run service workers in a web view ([forum](https://developer.apple.com/forums/thread/773539)). The App-Bound Domains workaround can silently break Capacitor's plugins and block navigation ([WebKit](https://webkit.org/blog/10882/app-bound-domains/)), and push still wouldn't work. So we switch the service worker off in the app instead (P2.09).
  - Push notifications stay hidden while the app is open (`presentationOptions: []`); in-app toasts cover that case. The keyboard resizes the view (`native`).
- [ ] **P2.04 [CODE] S**: Create a `native-shell/` folder with a placeholder `index.html` and an `offline.html` copied from `public/offline.html`. Without this page, opening the app offline shows a blank screen. The bundled `offline.html` must:
  - point Retry (`:109`) at the absolute https address, because `/home` would resolve inside the app bundle;
  - **hide the native splash itself** (`window.Capacitor?.nativePromise?.('SplashScreen','hide',{})`). Otherwise an offline cold start shows the splash forever. The bundled error page does get the Capacitor bridge on iOS;
  - **bounce straight back when the phone is actually online.** Capacitor shows this page on every failed load, including a *cancelled* one (error -999). That fires whenever a hard page load interrupts another, and the app does about 15 of those (`CrashTrap`, `error.tsx`, Profile, TermsGate...). So on load: if `navigator.onLine`, `location.replace` to the site, with a sessionStorage retry counter so a real Vercel or Supabase outage can't loop. The source for this is `@capacitor/ios` 8.5.2 `WebViewDelegationHandler.swift:139-162`.
- [ ] **P2.05 [CODE] S**: Run `npx cap add ios` on Windows and commit `ios/`. The CLI source has no Mac check (medium confidence). If it fails, generate the folder once on the CI Mac.
- [ ] **P2.06 [CODE] S**: iOS project settings, all plain-text edits:
  - `TARGETED_DEVICE_FAMILY = "1"` (D6).
  - `IPHONEOS_DEPLOYMENT_TARGET = 17.0`. This is a product choice, not a tool limit: Capacitor 8 and Xcode 26/27 all go down to iOS 15. The app's CSS needs iOS 16 or later. Choosing 17 also drops the iPhone 8 and X, the phones most likely to run out of memory on the closet art (P1.32), and leaves one fewer generation to test.
  - Portrait only.
  - `Info.plist` with:
    - `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`. The web photo picker offers "Take Photo", and without the camera text iOS terminates the app ([Apple](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media)).
    - `ITSAppUsesNonExemptEncryption = NO`. Eren uses only standard HTTPS, so App Store Connect stops asking the encryption question on every upload ([Apple](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)).
  - `App.entitlements` with `aps-environment = production`, wired up through `CODE_SIGN_ENTITLEMENTS`.
  - No background modes.
- [ ] **P2.07 [CODE] S**: Add `PrivacyInfo.xcprivacy` to the app. It declares no tracking, no tracking domains, collected data that matches P4.01, and a reason code for every "required-reason" system API used by the app or its plugins ([Apple](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [Capacitor](https://capacitorjs.com/docs/ios/privacy-manifest)).
  - Upload checks refuse only two things: a missing required-reason declaration, and a listed third-party SDK with no manifest. Capacitor ships its own.
  - The collected-data entries aren't checked on upload, but they must still be true.
  - The planned plugins (push, haptics) use no required-reason APIs. Re-check whenever a plugin is added; `@capacitor/preferences` would add one.
- ~~**P2.08**~~ Dropped. Capacitor already turns off whole-app rubber-banding for every web view (`CAPBridgeViewController.swift:301`). Bounce inside inner scroll areas is CSS (P1.34).
- [ ] **P2.09 [CODE] S**: Switch the whole web-push and service-worker layer off inside the app, not just registration: `registerSW`, `getSW`, `scheduleAll`, `subscribeToPush` and the SW path in `statNotifications`. Several of these wait on `navigator.serviceWorker.ready`, which never resolves when nothing is registered, so they would hang silently. Callers: `src/components/AppGuard.tsx:32`, `src/app/(app)/home/page.tsx:153`, `src/components/onboarding/IntroSlides.tsx:132`. Waits: `src/lib/reminders.ts:132`, `src/lib/statNotifications.ts:48`, `src/lib/pushSubscription.ts:21`. On the web, `public/sw.js` keeps working as before.
- [ ] **P2.10 [CODE] S**: Add `src/lib/native.ts` with `isNativeApp()` and plugin wrappers guarded by `Capacitor.isPluginAvailable()`, because the live website can be newer than the app installed on a phone. **For anything that changes what's drawn, use a `useIsNative()` hook that resolves after mount** (hiding the Safari install hint, the Forgot link, and so on). Pages are pre-rendered on the server, which always takes the web branch, so checking during render causes a hydration mismatch. This is the same rule as `useIsDark` in `CLAUDE.md`; `IntroSlides.tsx:102-107` already follows it.
- [ ] **P2.11 [CODE] S**: App icon and splash. The source icon already exists: `public/ErenAppIcon.png` is 1024×1024, RGB, no alpha channel, full-bleed, which is exactly what the App Store wants. Generate every size from it with `@capacitor/assets`, which runs on Windows. A layered "Liquid Glass" icon needs Xcode's Icon Composer; that's optional, since a flattened image is accepted ([Apple](https://developer.apple.com/design/human-interface-guidelines/app-icons)).
- [ ] **P2.12 [YOU] S**: Approve the icon.
- [ ] **P2.13 [CODE] M**: Set up the CI pipeline.
  - Use `codemagic.yaml`. Codemagic's Capacitor sample assumes CocoaPods; with Swift Package Manager pass `--project ios/App/App.xcodeproj`.
  - Alternatively, `.github/workflows/ios.yml` pinned to `runs-on: macos-26`, not `macos-latest`.
  - **Pin the Xcode version explicitly** on either service. Upload a build made with Xcode 27 well before April 2027.
  - Steps: `npm ci` → `npx cap sync ios` → sign with the API key → build → upload to TestFlight, with an automatic build number.
- [ ] **P2.14 [YOU] S**: Get the first build onto your phone:
  - Add yourself (and your partner) as internal TestFlight testers and install the build ([Apple](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)).
  - On the iPhone, enable Settings → Safari → Advanced → Web Inspector.
  - Try Inspect.dev's free tier from Windows (two 15-minute sessions a day). Its docs say it only debugs developer-signed apps, and ours are TestFlight-signed, so it may not work. Find out on this first build.
- [ ] **P2.15 [CODE] S**: Smoke test: the app opens, login works, games play, and airplane mode shows the offline screen and no stuck splash. **Phase 2 is done when a TestFlight build installs on your phone and runs the live site**, not just when it compiles.
- [ ] **P2.16 [CODE] S**: Build our own debugging now, whether or not Inspect.dev works:
  - an in-app console (for example eruda) behind a hidden gesture;
  - `window.onerror` and unhandled-rejection reports sent to a Supabase table from app builds.

  This is how we find what breaks on a phone we can't plug a Mac into. It is also the only crash visibility we have while D8 stays "no telemetry", so it needs a matching line in the privacy policy.

### Phase 3: Native capabilities (what makes it an app, and what passes 4.2)

#### 3A. Apple push (APNs)
Web Push "will not work in apps with a WKWebView" ([Apple DTS](https://developer.apple.com/forums/thread/760767)). Today every one of the 12 server notification types silently reaches nobody on iPhone, because no iPhone device is ever registered.

- [ ] **P3.01 [CODE] S**: Write migration `supabase/migration_push_kind.sql`:
  - Add a `kind` column (`webpush` / `apns` / `fcm`, defaulting to `webpush` so web keeps working), plus `apns_env` and `last_seen_at`.
  - Make the web-only keys optional for native rows.
  - Add a unique index on native tokens.
  - Add an RPC `register_push_device` that also removes the same phone's token from any other account.

  A column on the existing table is better than a new table: the five cleanup functions (leave household, block, account deletion) and the database access rules already cover `push_subscriptions`.
- [ ] **P3.02 [YOU] S**: Paste that migration.
- [ ] **P3.03 [YOU] S**: In Vercel, add server-only environment variables (never `NEXT_PUBLIC_`): `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the `.p8` contents pasted inline) and `APNS_BUNDLE_ID`.
- [ ] **P3.04 [CODE] M**: Build the APNs sender in `src/lib/apnsPush.ts`, on the Node runtime. Get any of these details wrong and pushes fail silently:
  - **HTTP/2 through `node:http2`** or a maintained library such as `apns2`. Vercel's built-in `fetch` does not speak HTTP/2 to APNs. The send must be awaited before the function returns.
  - **One connection per function run**, shared across the whole batch (the decay route sends many pushes at once), and closed at the end. The signed token must be at least 20 and at most 60 minutes old per connection, so a fresh token per run is simplest.
  - If the token is hand-signed (ES256), the signature must be raw `r||s` (`crypto.sign` with `dsaEncoding: 'ieee-p1363'`), not DER.
  - Headers: `apns-topic: <bundle id>` is required. `apns-push-type: alert` is required in practice: without it Apple "may delay or drop" the push. `apns-collapse-id` (reusing the notification tag) is at most 64 bytes.
  - It always talks to **production** APNs, because TestFlight and App Store builds use it ([forum](https://developer.apple.com/forums/thread/751440)).
  - A 410 (`Unregistered`) or 400 (`BadDeviceToken`) answer deletes the token.
  - The `.p8` pasted into a Vercel variable must keep its line breaks.
  - Wire it into `sendPush` in `src/lib/serverPush.ts:32-49` by row kind.
  - Six routes rebuild rows by hand and would drop `kind`: `notify-action`, `notify-message`, `notify-mood`, `notify-stats`, `decay`, `fire-reminders`. Six others select a column list without it: `notify-anniversary`, `notify-catchup`, `notify-favorite`, `notify-memory`, `notify-streak`, `notify-wish-granted`. Fix all twelve.
- [ ] **P3.05 [CODE] M**: Add one permission helper (`src/lib/notifyPermission.ts`): native permission prompts in the app, the browser Notification API on the web.
  - Rewire `IntroSlides.tsx`, `ReminderSheet.tsx`, `home/page.tsx:152-161` and `statNotifications.ts` to use it.
  - Add an "Enable notifications" row in Profile. If the user already said no, point them to Settings → Eren → Notifications.
  - Ask in context, when setting a reminder or after pairing, not on first launch ([Apple](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)).
  - Push must stay optional and never be rewarded ([4.5.4, 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/)). The existing "SKIP FOR NOW" already complies.
  - **At least two switches, not one:** "Partner messages" and "Reminders and nudges". Streak SOS, catch-up, anniversary and favourite pushes are re-engagement nudges, and Guideline 4.5.4 expects an in-app opt-out for promotional pushes. Mention the switches in the review notes.
- [ ] **P3.06 [CODE] S**: Add `@capacitor/push-notifications` plus the two push-forwarding methods in `AppDelegate.swift`, a text edit ([Capacitor](https://capacitorjs.com/docs/apis/push-notifications)).
- [ ] **P3.07 [CODE] S**: Tapping a notification opens the right screen. Only `/home`, `/couple`, `/notes` and `/hallway` are allowed. The device token refreshes on every launch.
- [ ] **P3.08 [CODE] S**: Signing out deletes this phone's push row (`src/hooks/useAuth.ts:82-84`). Otherwise a signed-out phone keeps showing the account's messages on the lock screen.
- [ ] **P3.09 [CODE] S**: Shorter notification titles, since iOS already prints "Eren" as the header, and the D12 generic previews.

#### 3B. Reminders and background alerts
- [ ] **P3.10 [YOU] S**: **Do not paste `supabase/migration_wal_amplification.sql` until an external cron runner is live.** It unschedules `fire-reminders` (line 68), and in v1 that is the only way reminders reach iPhone (D13).
- [ ] **P3.11 [CODE] S**: The phone-side stat and partner toasts (`statNotifications.ts`) stay web-only. On iPhone the server sends these.

#### 3C. Native feel
- [ ] **P3.12 [CODE] S**: Status bar colour per screen (`@capacitor/status-bar`). Light text over the black StatsHeader (`src/components/StatsHeader.tsx:410-418`), otherwise the clock and battery vanish. Dark text on light screens: the school scene and `hideStats` screens have no header (`StatsHeader.tsx:405`), and the body plus `/privacy`, `/terms` and `/delete-account` are light. One global style is wrong on one set or the other. Set it on each route or scene change, or paint a dark band behind the status bar everywhere.
- [ ] **P3.13 [CODE] S**: The native splash stays up until the existing `eren:app-ready` event, with three safety nets:
  - a native fallback that hides it after 6–8 seconds no matter what. `eren:app-ready` is never sent by `/privacy`, `/terms`, `/delete-account`, the bundled offline page or a failed load, and a splash stuck on launch is a 2.1 "hangs" rejection;
  - `offline.html` hides it itself (P2.04);
  - the web `SplashScreen` component doesn't show inside the app, so nobody sees two splashes back to back.
- [ ] **P3.14 [CODE] S**: Keyboard (`@capacitor/keyboard`, [docs](https://capacitorjs.com/docs/apis/keyboard)):
  - hide the bottom nav while it's open;
  - hide the "< > Done" bar on chat screens;
  - use the light style.

  Retest `src/components/talk/RoomComposer.tsx`, the journal, notes, the Report sheet and the Reminder form.
- [ ] **P3.15 [CODE] M**: Haptics (`@capacitor/haptics`) on care actions, game hits, gacha reveals and errors. The web vibration API doesn't exist on iPhone ([caniuse](https://caniuse.com/vibration)).
- [ ] **P3.16 [CODE] S**: Outside links open in an in-app Safari sheet with a Done button (`@capacitor/browser`). Legal pages stay inside the app. `mailto:` links open Mail, which is fine.
- [ ] **P3.17 [CODE] S**: Share the invite code with the native share sheet, using `@capacitor/share` inside the app (nothing confirms `navigator.share` works in an app's web view, and nothing in the code uses it today). It also counts as a visible native feature for 4.2. The web keeps the clipboard copy.

#### 3D. Lifecycle, offline, sign-in
- [ ] **P3.18 [CODE] S**: When the app returns from the background (`@capacitor/app` resume/pause), run the existing `src/lib/onForeground.ts` callbacks and the audio watchdog (P1.29). Check that realtime reconnects after a long time in the background ([Capacitor](https://capacitorjs.com/docs/apis/app)).
- [ ] **P3.19 [CODE] M**: Password reset by 6-digit code, with no link to tap. Use `resetPasswordForEmail`, then `verifyOtp(..., type: 'recovery')` on `/auth/reset`, then set the new password (`src/app/auth/forgot/page.tsx:36-38`, `src/app/auth/reset/page.tsx`).
  - Today's email link would open in Safari. Safari lacks the app's login state, so the reset would fail even with email working.
  - A code needs no Universal Links. Keep `/auth/callback` for the web.
  - Needs P0.10.
  - Supabase **email confirmation must stay OFF**, because onboarding needs an immediate session (`src/lib/onboarding.ts`).
- [ ] **P3.20 [YOU] S**: Update the Supabase "reset password" email template to show the code ([Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)).
- [ ] **P3.21 [CODE] S**: Keep people logged in past 7 days. This is likely to bite: WebKit's tracking prevention is on in every in-app web view, and it caps cookies written by page scripts at 7 days ([WebKit](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/)). Eren's login lives in exactly that kind of cookie (`src/lib/supabase/client.ts:12-16`, and `middleware.ts` does nothing to refresh it).
  - **Check it in minutes, not a week:** read the `sb-*` cookie expiry in Web Inspector's Storage tab on the first TestFlight build (or in the P2.16 console).
  - **Fix:** a small route (for example `/api/session/touch`), called on launch and resume, that re-sends the session cookies from the server. Cookies set by the server aren't capped.
  - **Do not** move the session into `@capacitor/preferences`. Every `/api` route reads the session from cookies (`src/lib/apiAuth.ts`, `src/lib/supabase/server.ts`), so that would break them all. It's the Appendix A job.
- [ ] **P3.22 [CODE] M** (depends on D7): If the age-law check says we need it, add a native age-range check at signup with Apple's Declared Age Range API. This needs a small native plugin, since no official Capacitor plugin exists for it (not researched further).

#### 3E. What makes Eren pass 4.2
Apple rejects "websites served in an iOS app" ([App Review](https://developer.apple.com/distribute/app-review/)). In 2026 one Capacitor app was rejected again even after adding location and sharing, which the reviewer called "not robust enough" ([forum](https://developer.apple.com/forums/thread/812889)). Token plugins don't pass. User-visible, app-like behaviour does. When Phases 1–3 are done, all of these must be true, and the review notes list them:

- [ ] Push notifications arrive, and tapping one opens the right screen, even from a killed app.
- [ ] Haptics on care actions, game hits and gacha reveals.
- [ ] No web tells: no bounce, no pinch or double-tap zoom (already locked), no text selection or image callouts (already done), no link previews, no browser bars, and every screen has a way back.
- [ ] Native status bar, splash screen and keyboard behaviour. Nothing sits under the notch or the home-indicator bar.
- [ ] Offline launch shows a designed Eren screen with Retry, never a blank page.
- [ ] Fast cold start: splash until ready, light thumbnails, no big first-launch download.
- [ ] Portrait-locked, with a share sheet for the invite code.
- [ ] Solo play is visible without a partner, and there's clear depth: 13 arcade games, rooms and an economy.

### Phase 4: Store listing and compliance

- [ ] **P4.01 [CODE] S**: Draft the App Privacy answers ([Apple](https://developer.apple.com/app-store/app-privacy-details/)). You enter them in App Store Connect. Every row is "linked to the user", "not used for tracking", purpose "App Functionality". No tracking prompt is needed.

  | Apple data type | What it is in Eren |
  |---|---|
  | Email Address | Login |
  | Name | Display name (also sent to Anthropic if chat consent is given) |
  | Emails or Text Messages | Journal messages, notes |
  | Photos or Videos | Only if D14 puts photos in |
  | Other User Content | AI chat messages and saved memories (processed by Anthropic), household name, reminder text |
  | Customer Support | Report details, deletion-request notes |
  | Gameplay Content | Game results, economy |
  | User ID | Account ID |
  | Device ID | APNs push token |
  | Product Interaction | Care actions, time spent, gacha pulls, moods |
  | Other Data | Birthday, anniversary, timezone |
  | Diagnostics | None, unless D8 changes |

- [ ] **P4.02 [CODE] S**: Make `PrivacyInfo.xcprivacy` (P2.07) match P4.01.
- [ ] **P4.03 [YOU] S**: Fill in the age-rating questionnaire ([values](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)), then set 18+ (D7). Apple asks you to consider AI chat when answering frequency questions ([Apple](https://developer.apple.com/news/?id=ks775ehf)).

  | Question | Answer | Note |
  |---|---|---|
  | Loot boxes | Yes (D21) | 9+ worldwide; 16+ Australia, 18+ Brazil. No effect at 18+. |
  | Simulated gambling | Infrequent (D21) | The bakery's coin-paid SPIN machine (`DonutCasePanel.tsx:264-291`). Over-rating is free at 18+; under-rating is a 2.3.6 rejection. |
  | Contests | Frequent | The daily battle and weekly competition (13+). |
  | Cartoon or fantasy violence | Answer honestly per game | 9+ Infrequent, 13+ Frequent |
  | Messaging and chat | Yes | 4+ |
  | User-generated content | Yes (safe answer) | 4+ |
  | Health or wellness topics | Consider it for the daily mood check-in (`MoodGate.tsx`) | Answer conservatively. |
  | Unrestricted web access | No | Only a fixed set of links, opened in an in-app Safari sheet (P3.16); users can't browse freely. If that ever changes, answer Yes (16+, free at 18+). |
  | Social media | **No** (no feed; nothing spreads to many users) | This question is mandatory for submissions from September 2026 ([Apple](https://developer.apple.com/news/?id=0d2gpmml)). |
  | Advertising | No | |

  Then use **Override to Higher Age Rating → 18+**. This is mandatory, because the terms require 18.

- [ ] **P4.04 [YOU] S**: Declare EU trader status (D10).
- [ ] **P4.05 [YOU] S**: Pricing: free. Availability: everything except China mainland (D20).
- [ ] **P4.06 [YOU] S**: Nothing to do for sign-in. Guideline 4.8 exempts apps that "exclusively use your company's own account setup and sign-in systems", and Eren uses only its own email-and-password accounts ([4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)). Adding Google login later would require an equivalent privacy-friendly login option alongside it. Sign in with Apple qualifies, but 4.8 no longer names it specifically.
- [ ] **P4.07 [CODE] S**: Draft the listing text ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)):
  - Name (2–30 characters), subtitle (up to 30), keywords (up to 100 bytes; no app or company names; no Attack on Titan terms).
  - A description presenting Eren as a game anyone can play solo or with a partner.
  - Privacy URL `/privacy` and Support URL `/support`.
  - Don't use "For Kids" or "For Children", and don't enter the Kids Category ([2.3.8](https://developer.apple.com/app-store/review/guidelines/)).
- [ ] **P4.07b [YOU] S**: App Store Connect fields the rest of this plan doesn't cover:
  - the **Content Rights** declaration ("Does your app contain, show, or access third-party content?"), required before submission;
  - primary and secondary category (for example Games › Simulation and Games › Casual);
  - the Copyright line;
  - under Pricing and Availability, **turn OFF** "Make this app available on Apple silicon Macs" and Apple Vision Pro. Both are on by default for iPhone apps. On a Mac, the resizable window can cross the 481px phone-frame breakpoint (`globals.css:87-148`), and push and keyboard behave differently.
- [ ] **P4.08 [CODE] M**: Screenshots ([specs](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)):
  - One 6.9-inch portrait set at 1320×2868: 1–10 images, PNG or JPEG, no transparency.
  - Capture real screens (rooms, arcade, gacha with odds, journal, Talk) from the demo household.
  - Capture them on the iOS 6.9-inch **simulator** on the CI Mac (`xcrun simctl io booted screenshot`), not in Chrome. Chrome renders with a different engine, so blur, fonts and safe areas won't match what users see.
  - No old drink names, nothing about Android, no "Flappy", and no Serbian class unless D22 keeps it. Imagery must suit all ages even though the app is 18+.
- [ ] **P4.09 [YOU] S**: Approve the screenshots and text.
- [ ] **P4.10 [CODE] S**: Demo accounts:
  - Accounts A and B, already paired in one household, with nothing reported or blocked.
  - Enough coins, stardust and trophies for a gacha pull, a paid donut spin (`SPIN_COST`, `DonutCasePanel.tsx:67`) and a shop purchase. Eren's stats high enough that nothing is energy-gated.
  - Seeded journal messages and notes from the partner, so reporting and blocking have something to act on.
  - **AI consent left ungranted**, so the reviewer sees the P1.11 sheet. Decide whether TermsGate is pre-accepted.
  - Remember that MoodGate asks for a mood once a day before /home.
  - A solo account.
  - A script to rebuild them after a reviewer tests Delete Account.
- [ ] **P4.11 [CODE] S**: Draft the review notes (up to 4,000 bytes). Apple says new features "must be described with specificity" ([2.3.1](https://developer.apple.com/app-store/review/guidelines/)). Outline:
  1. What Eren is: a public pixel-art cat-care game, played solo or with a partner. The arcade games and the Talk chat are core parts of Eren, not separate mini-apps (Guideline 4.7).
  2. The logins for A, B and the solo account, and why every feature needs an account: the cat and household sync across devices and between partners. This answers the common 5.1.1(v) "forced registration" rejection.
  3. Where things are: the arcade, gacha odds, Talk (its consent sheet names Anthropic), reporting (button and long-press), blocking (Profile), account deletion (bottom of Profile).
  4. No purchases; all currency is earned by playing.
  5. Moderation: reports reach the developer and are acted on within 24 hours; a text filter is in place.
  6. The native features (the 3E list).
  7. The backend: Supabase, plus our own server at `<domain>/api`.
  8. Minimum age is 18.
- [ ] **P4.12 [YOU] S**: App Review contact: name, email, and a phone number in international format (`+381 ...`), required since August 2026 ([Apple](https://developer.apple.com/help/app-store-connect/release-notes/)). Accessibility Nutrition Labels are voluntary for now, so skip them ([Apple](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/)).

### Phase 5: TestFlight, submit, review

- [ ] **P5.01 [YOU] L**: Test on a real device via internal TestFlight:
  - Cold start online and in airplane mode. The offline screen appears only when truly offline, and never on a normal link tap: Capacitor also shows it when a page load is cancelled.
  - Sign up, pair a partner, pass TermsGate, open Privacy and Terms and come back.
  - Push: both the allow and deny paths; each notification type arrives; tapping from a killed app opens the right screen; signing out stops notifications.
  - Audio: with the silent switch on, after a phone call mid-game, and after locking the screen; Purr Beat resumes.
  - The keyboard in Talk, journal, notes, Report and Reminders.
  - The status bar is readable on every screen (dark rooms, school, legal pages), and nothing is hidden under the notch.
  - The Serbian speaker buttons make sound, if D22 keeps the room.
  - The `sb-*` login cookie expiry (P3.21), read on day one, not by waiting 8 days.
  - Notification switches: turning off "Reminders and nudges" stops those pushes but not partner messages.
  - No bounce, zoom, text selection or link previews.
  - Closet, collection and gacha on the older iPhone: no white flash.
  - Every game once with Low Power Mode on.
  - AI consent: decline, allow, revoke.
  - Report, block, delete a message, delete the account.
  - Still logged in after 8+ days away (P3.21), as a final confirmation.
- [ ] **P5.02 [YOU] S**: One session on an iPad in iPhone-compatibility mode: games, safe areas, the gacha controls, long-press, keyboard ([DPLA 3.3.1(E)](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)).
- [ ] **P5.03 [CODE] M**: Fix everything P5.01–P5.02 found and ship new builds through CI.
- [ ] **P5.04 [YOU] S**: Create an external TestFlight group with a public link and fill in the test information. Its first build goes through Beta App Review. That gives an early read on 4.2, 1.2 and 5.1.2 problems, but it does not guarantee App Store approval.
- [ ] **P5.05 [CODE] S**: Decide on web-view debugging for the submitted build (P2.03). Either leave it on, or turn it off and smoke-test that exact build before submitting.
- [ ] **P5.06 [YOU] S**: Prepare for review:
  - Raise `CHAT_DAILY_BUDGET_USD` (`src/app/api/chat/route.ts:66`) and confirm the chat kill switch is off.
  - Don't deploy new features to Vercel while the app is in review.
  - Keep Supabase and Vercel up; Supabase has known intermittent 503 errors.
- [ ] **P5.07 [YOU] S**: Submit, choosing manual release. Apple says 90% of submissions are reviewed within 24 hours ([Apple](https://developer.apple.com/distribute/app-review/)). Expecting several rounds for a first hybrid app is my own estimate.
- [ ] **P5.08 [YOU] S**: If rejected, read the guideline Apple cites and send it to me; I fix it (**[CODE]**). For a 4.2 rejection:
  - Reply with the 3E list.
  - Optionally book a 30-minute "Meet with App Review", or appeal once to the App Review Board.
  - If it is still rejected, start Plan B (Appendix A).
- [ ] **P5.09 [YOU] S**: Release.

### Phase 6: After launch

- [ ] **P6.01 [YOU]**: Shipping rule: bug fixes and polish can go live on Vercel any time. **New features ship as a new app version, described in the review notes.** Features that change a reviewed app without review are what Guidelines 2.5.2 and 2.3.1 police ([guidelines](https://developer.apple.com/app-store/review/guidelines/)).
- [ ] **P6.02 [YOU]**: Act on every report within 24 hours, for as long as the app is live. Apple can remove apps for repeated failures ([1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)).
- [ ] **P6.03 [YOU]**: Watch usage limits. Vercel Hobby includes 100 GB/month of data transfer, 1M function calls and 4 hours of Active CPU, and it is for non-commercial use only ([Vercel](https://vercel.com/docs/limits/fair-use-guidelines)). Also watch the Supabase free tier.
- [ ] **P6.04 [CODE]**: Keep the privacy label, the privacy policy and the privacy manifest in step with every data change.
- [ ] **P6.05 [CODE]**: Rebuild the demo household before every submission.
- [ ] **P6.06 [CODE]**: Tooling upkeep:
  - Upgrade to Capacitor 9 once it is stable (general availability is forecast for late November 2026).
  - **Confirmed:** from April 2027, uploads must be built with the iOS 27 SDK ([Apple, 2026-09-09](https://developer.apple.com/news/?id=k1mtkt1k)). Move CI to Xcode 27 well before then, and keep the UIScene setup (P2.02).
  - TestFlight builds expire after 90 days.
- [ ] **P6.07 [YOU]**: Renew the USD 99 membership every year.
- [ ] **P6.08 [CODE]** (optional): Exact reminders scheduled on the phone with `@capacitor/local-notifications` ([docs](https://capacitorjs.com/docs/apis/local-notifications)). iOS keeps only the soonest 64 pending, so reschedule at each start ([Apple](https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/SchedulingandHandlingLocalNotifications.html)). The server must then skip duplicates.
- [ ] **P6.09 [YOU]**: If you ever sell anything, it must go through Apple's in-app purchase system ([3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)), and the odds rule then clearly applies. Reconsider trader status and Vercel Pro.
- [ ] **P6.10 [YOU]**: Never require or reward turning on notifications ([5.1.2(i)](https://developer.apple.com/news/?id=ey6d8onl)), and never force ratings or reviews ([3.2.2(x)](https://developer.apple.com/app-store/review/guidelines/)). Watch for Accessibility Nutrition Labels becoming mandatory, and for news on the US state age laws.

---

## 4. What carries over from the Play checklist and what does not

| Play checklist item | On Apple |
|---|---|
| TWA built with Bubblewrap | **Replaced** by a Capacitor iOS app built on a cloud Mac |
| `assetlinks.json` and the Play App Signing SHA-256 | **Not needed** for v1: the reset code means no Universal Links. If Universal Links are added later: `apple-app-site-association` in `public/.well-known/` plus the Associated Domains setting ([Apple](https://developer.apple.com/documentation/xcode/supporting-associated-domains)). Keep `assetlinks.json` for Android. |
| USD 25 one-time Play fee | **Replaced** by USD 99 per year |
| 12 testers (you planned 15) opted in for 14 days | **Does not exist on Apple.** You can go from upload to review to release ([Google rule](https://support.google.com/googleplay/android-developer/answer/14151465)). TestFlight is optional but recommended. |
| `applicationId` and targetSdk 36 | **Replaced** by the bundle ID (D3), built with the iOS 26 SDK or later |
| Data Safety form | **Replaced** by the App Privacy label (P4.01) plus `PrivacyInfo.xcprivacy` |
| Play content rating | **Replaced** by Apple's age-rating questionnaire (P4.03) |
| 1024×500 feature graphic; 2.0-aspect screenshots | **Replaced**: no feature graphic; 6.9-inch screenshots at 1320×2868, re-shot |
| Web account-deletion URL (a Play requirement) | Apple requires **in-app** deletion, which you already have. `/delete-account` stays as a web fallback. |
| Play Families "youthful animation" trap | **Similar**: no "For Kids" wording, stay out of the Kids Category, imagery suitable for all ages |
| Play generative-AI flag and AI disclosure | **Stricter**: explicit consent naming Anthropic (P1.11) |
| Web push inside the TWA | **Replaced** by APNs (Phase 3A) |
| Service-worker offline mode and the 30 MB precache | **Replaced**: off inside the app; a bundled offline screen instead |
| Legal placeholders, support email, the `TERMS_LAST_UPDATED` trap | **Carries over** (P1.07–P1.08) |
| Custom SMTP and password reset | **Carries over**, now with a reset code (P0.10, P3.19) |
| Two demo accounts in one household | **Carries over**, plus a solo account (P4.10) |
| 18+ decision | **Carries over** (D7) |
| No crash reporting | **Carries over** (D8) |
| Economy hardening; bakery/donut odds | **Carries over** (P1.26) |
| IP risk from "Monsta" | **Carries over**, and still unfinished in the shop (P1.27) |
| Vercel Hobby and Supabase free-tier limits | **Carries over** (P6.03) |
| The `ERENHOME` seed household | **Carries over** (P1.06) |
| Items for a lawyer | **Carries over** |
| Apple-only additions | A cloud Mac build, APNs, the privacy manifest, the export-compliance flag, EU trader status, AI consent, the 4.2 native work, review notes, the USD 99/year fee |

---

## 5. Android later

- **What is preserved:** the `android-play-store` branch and the `android-snapshot-2026-09-23` tag both point at `af2bf3e`, the same commit as `master` today. They mark the Play-ready state; they are not a separate product. Keep developing on `master`.
- **Rules that keep one codebase:**
  - Native code runs only behind `Capacitor.isNativePlatform()`. Never switch on "does this browser have feature X".
  - `public/sw.js`, the VAPID web-push setup and `subscribeToPush` get no native-driven changes. Ordinary web changes like the WebP precache list (P1.38) still happen.
  - Push rows default to `kind = 'webpush'`.
  - The privacy policy is shown on every platform, so it must never name Android or Google Play where the iPhone app shows it ([2.3.10](https://developer.apple.com/app-store/review/guidelines/)). When Android ships, show platform-specific sections based on where it's running.
- **Two ways to ship Android later:**
  1. **The TWA as planned:** build from `master`. Web push keeps working in the TWA because we don't touch it. Google's 12-tester, 14-day closed test still applies to personal accounts created after 13 Nov 2023.
  2. **Capacitor Android (recommended once iOS is done):** run `npx cap add android` on Windows with Android Studio. It reuses `capacitor.config.ts`, the native helpers, the permission helper, the reset code and the push-token table. It needs an FCM sender (`kind = 'fcm'`), a `google-services.json`, and a hardware back-button handler. `assetlinks.json` is then only for App Links.
- **Push provider (D11):** if Android is coming soon, using Firebase/FCM for both platforms now saves writing a second sender later. The cost is a Firebase project and more privacy declarations.

---

## 6. Risk register

Likelihoods are my estimates. Apple's 2025 Transparency Report gives only base rates by section, not by guideline number: 9.1M submissions reviewed and 2.09M rejected. By section: Performance 1.35M (2.1 lives here), Legal 496k, Design 416k (4.2 lives here), Business 284k and Safety 151k ([Apple](https://www.apple.com/legal/app-store/transparency/2025/)).

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Rejected under **4.2** as a repackaged website, or under **4.7.2** (remote games and chatbot using native features without Apple's permission). Or, after approval, the live site changes features without review (2.3.1 / 2.5.2). | Medium | High: Plan B costs 1–2 weeks | The 3E native checklist; solo play visible; honest, specific review notes that present games and chat as core features; external TestFlight review as a dry run; Plan B pre-written (it removes the 4.7 question entirely); appeal or meeting once. After approval, ship features as new versions (P6.01). |
| 2 | Rejected under **2.1** for an incomplete app: placeholders, dead reset, crash bar, "Take Photo" crash, no demo access, backend down | High if Phase 1 is skipped, low after | Medium: 1–2 days per round | P1.01–P1.08, P2.06 camera text, P4.10 demo accounts, P5.06 keep the backend up |
| 3 | Rejected under **5.1.2(i)**: AI data shared without permission | High if not fixed | Medium | P1.11–P1.15 consent sheet with server enforcement, described in the review notes |
| 4 | **1.2** content rejection, or removal after launch | Medium | Medium to high | Filter, zero-tolerance terms, 24-hour promise with report alerts, visible report button (P1.10, P1.17–P1.19, P6.02) |
| 5 | **Apple enrollment** or ID checks from Serbia are slow or fail | Unknown (unconfirmed) | High for the timeline | Start on day one (P0.01); enroll on the web; contact Apple after 24 hours |
| 6 | **No Mac**: cloud signing or building fails | Medium | Medium | Codemagic's documented flow; GitHub Actions as backup; one Scaleway day if a real Mac screen is needed |
| 7 | **iPhone runtime** faults a reviewer sees: memory crash (white flash), dead audio after a call, frozen Purr Beat, keyboard covering chat, invisible status bar | Medium | Medium to high | P1.29–P1.34, P3.12–P3.14, P3.18; a device pass on an older iPhone (P5.01) |
| 8 | **Backend capacity and availability**: Supabase free-tier 503s during review; the free-tier **Disk IO budget**, already exhausted once with 2 users, whose cron half still waits on an external runner; the free-tier **Realtime cap of about 200 concurrent connections**, since every open app holds a socket; Vercel Hobby's 100 GB/month and non-commercial clause | Medium | Medium to high | Existing retry logic, WebP art and cache headers (P1.38, P1.41), usage monitoring (P6.03). **Decide the upgrade trigger (Supabase Pro, Vercel Pro) before review, not after.** |
| 9 | **Forced registration** (5.1.1(v)): the arcade could be seen as content that shouldn't need an account | Low to medium | Medium | Review notes explain why everything is account-bound (P4.11). If rejected: a Supabase anonymous "play as guest" sign-in, upgradable to email later. |
| 10 | **No iPhone to test on** for the length of the project | Unknown until D0 | High for the timeline | Settle D0 on day one; budget for a used iPhone if needed |
| 11 | **Can't see errors on the device** (no Mac, Inspect.dev may not attach to TestFlight builds) | Medium | Medium | In-app console and remote error log (P2.16); one Scaleway Mac day as the last resort |

---

## Appendix A: Plan B, the bundled build (only if Apple rejects the live-site build)

This ships the screens inside the app while `/api/*` stays on Vercel. It removes the "website in an app" and offline objections, and the question of games loaded remotely (Guideline 4.7). The costs: about 7–10 dev-days, and every UI change then needs a new build and review.

- [ ] **[CODE] L**: Change `next.config.mjs` for an iOS build: `output: 'export'`, `images.unoptimized`, and `pageExtensions: ['tsx']` so route handlers stay server-only ([Next.js](https://nextjs.org/docs/14/app/building-your-application/deploying/static-exports)).
- [ ] **[CODE] M**: Make the redirects client-side: `src/app/page.tsx`, `src/app/(app)/care/page.tsx:6`, `src/app/auth/register/page.tsx:6`.
- [ ] **[CODE] M**: In the app, the Supabase client stores the session with `@capacitor/preferences`, not cookies (`src/lib/supabase/client.ts:13-16`).
- [ ] **[CODE] M**: Add `src/lib/apiFetch.ts`: an absolute API address plus `Authorization: Bearer <token>`. Replace the ~12 relative `/api` calls: `MoodGate.tsx`, `TaskContext.tsx`, `useCatchupGate.ts`, `useCouple.ts`, `useDailyWish.ts`, `useErenChat.ts` (a stream), `useErenStats.ts`, `reminders.ts`. Server side, `src/lib/apiAuth.ts`, the chat route and catchup accept bearer tokens.
- [ ] **[CODE] S**: Allow cross-origin calls for `/api/*` from `capacitor://localhost`, including preflights, in `src/middleware.ts`. The root `middleware.ts` is ignored today.
- [ ] **[CODE] M**: Replace the ~15 hard page loads with in-app navigation: `profile/page.tsx`, `auth/login/page.tsx`, `auth/reset/page.tsx`, `error.tsx`, `global-error.tsx`, `CrashTrap.tsx`, `not-found.tsx`, `delete-account/page.tsx`, `TermsGate.tsx`.
- [ ] **[CODE] S**: Build the reset `redirectTo` from a fixed https address, not the page's origin (`src/app/auth/forgot/page.tsx:37`).
- [ ] **[CODE] M** (optional): A self-hosted `@capgo/capacitor-updater` (MPL-2.0, free) for bug-fix updates without review ([GitHub](https://github.com/Cap-go/capacitor-updater)). The P6.01 rule still applies. Don't use Ionic Appflow, which no longer takes new customers.