# Auth + Payment Acceptance Checklist

## 1. Start the dashboard
1. Run:
   `npx next dev --webpack`
2. Open:
   `http://localhost:3000`

Expected:
- Dashboard loads successfully.
- Top bar shows `Checkout`.
- Avatar menu shows `登录` or `Sign in` before login.

## 2. Open checkout directly
1. Open:
   `http://localhost:3000/checkout`

Expected:
- Checkout page loads.
- Top-bar `中 / EN` switch controls checkout/login language and payment region behavior.
- `中` shows Chinese copy and domestic payment targets led by `微信支付 / 支付宝`.
- `EN` shows English copy and sandbox-first intl payment entry.
- Before login, primary action asks user to sign in first.
- Page shows current auth mode / provider hint.

## 3. Login flow
1. Click the top-right avatar menu -> `登录`, or click `登录后支付` from checkout.
2. Use one of these:
   - CN sandbox phone login: enter email + mainland phone number, click `发送验证码`, then use the returned sandbox code
   - CN fallback demo credentials: `demo-cn@mornscience.ai` / `123456`
   - INTL demo credentials: `demo-intl@mornscience.ai` / `123456`
   - INTL Google sandbox entry: click `Log in with Google`

Expected:
- Login succeeds.
- Browser redirects back to checkout.
- Avatar menu shows user name and email.
- Login language follows top-bar `中 / EN`, not a separate `CN / INTL` selector.
- Login page shows current runtime mode.
- Current target is `Google + email` for INTL and `phone verification + email` for CN.

## 4. Create a payment
1. On checkout, select region, plan, and payment method.
2. Click `立即支付` or `Pay Now`.

Expected:
- Client calls `POST /api/payment/create`.
- Browser immediately redirects to one of:
  - `/payment/hosted?paymentId=...`
  - real Stripe checkout URL
  - real Alipay payment URL
  - `/payment/wechat?paymentId=...&codeUrl=...`
- Payment page shows plan, amount, method, payment id, and for WeChat Pay a QR preview plus copyable code URL.
- If production credentials are missing, API returns `fallbackHosted: true`.
- Current domestic target is `WeChat Pay + Alipay`; current intl target stays sandbox-first until final secrets are approved.

## 5. Confirm payment
1. On hosted payment page, click `确认支付`.

Expected:
- Client calls `POST /api/payment/confirm`.
- Browser redirects to `/payment/success?paymentId=...`.
- Success page shows completed order message and payment id.

## 6. Cancel payment
1. Create another payment.
2. On hosted payment page, click `取消支付`.

Expected:
- Client calls `POST /api/payment/cancel`.
- Browser redirects to `/payment/cancel?paymentId=...`.
- Cancel page shows cancellation message.

## 7. Verify session and payment records
1. Open:
   `http://localhost:3000/api/auth/session`
2. Open:
   `http://localhost:3000/api/payment/status?paymentId=<paymentId>`

Expected:
- Session API returns authenticated user info after login.
- Payment status API returns current payment record and status.

## 8. Logout
1. Open avatar menu.
2. Click `Sign out` / `退出登录`.

Expected:
- Session is cleared.
- User is redirected to `/login`.
- Reopening checkout requires sign-in again before paying.

## 9. Migration source and staging

Source repo:
- `yuxuanzhouo3/mvp_25`

Migration note:
- `mvp_25` works as a reference repo, but it does not contain the production-ready provider code for `Supabase / Stripe / Alipay`.
- The current repo remains the real implementation base for phase 1.

Target split:
- Web current target:
  - INTL auth: `Google + email`
  - CN auth: `phone verification + email`
  - CN payment: `WeChat Pay + Alipay`
  - INTL payment: sandbox-first checkout
- Android phase 1: shell conversion, package rename, JKS signing, APK install path, Alipay payment with `0.1`
- Android phase 2: WeChat login + WeChat Pay after the credentials are approved
- Web acceptance: keep checkout, hosted payment, success/cancel, session APIs, and plan policy aligned with the same limits

## 10. Android phase 1 notes

- Reference shell repo/folder: `yuxuanzhouo3/mvp_24/multigptandroid`
- Keystore: `multigpt-key.jks`
- Package rule: `com.{englishname}.android.app`
- Example: `com.mornstack.android.app`
- Priority verification order:
  1. Gradle sync succeeds
  2. Debug build runs on emulator/device
  3. Release signing is configured
  4. APK installs successfully
  5. Alipay `0.1` payment flow is verified

## 11. Keys and manual prerequisites

- Current WeChat Pay merchant credentials are enough to continue order creation / query / callback decryption
- `WECHAT_PAY_PLATFORM_PUBLIC_KEY` and `WECHAT_PAY_PLATFORM_SERIAL_NO` are still recommended to complete callback signature verification
- Google OAuth client credentials and the final SMS provider credentials are still pending for the production switch
- Alipay / WeChat secrets should stay in local secure env or cloud deployment env, not in git
- Final device install, payment callback verification, and store submission still require local manual validation
