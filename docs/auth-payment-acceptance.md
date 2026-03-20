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
- `中` shows Chinese copy and `支付宝 / 微信支付`.
- `EN` shows English copy and `Stripe / PayPal`.
- Before login, primary action asks user to sign in first.
- Page shows current auth mode / provider hint.

## 3. Login flow
1. Click the top-right avatar menu -> `登录`, or click `登录后支付` from checkout.
2. Use demo credentials:
   - CN: `demo-cn@mornscience.ai` / `123456`
   - INTL: `demo-intl@mornscience.ai` / `123456`

Expected:
- Login succeeds.
- Browser redirects back to checkout.
- Avatar menu shows user name and email.
- Login language follows top-bar `中 / EN`, not a separate `CN / INTL` selector.
- Login page shows current runtime mode (`demo` / `Supabase` / `WeChat`).

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
- Payment page shows plan, amount, method, and payment id, or a provider-hosted payment page opens.
- If production credentials are missing, API returns `fallbackHosted: true`.

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
