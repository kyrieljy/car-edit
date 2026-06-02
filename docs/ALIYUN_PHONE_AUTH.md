# Aliyun Phone Auth

Last updated: 2026-06-02 Asia/Shanghai

This app supports Aliyun PNVS for phone SMS code auth and H5 one-tap phone auth. Keep mock mode enabled for local non-paid verification. Do not run real provider calls until the operator has approved possible Aliyun charges.

## Aliyun Console Setup

1. Enable Aliyun Phone Number Verification Service or fusion auth.
2. Enable SMS verification and H5 phone auth.
3. Create an H5 auth scheme. For the current IP-only test server:
   - Page URL: `http://47.106.182.116:3000/`
   - Origin: `http://47.106.182.116:3000`
   - Save the `SceneCode`.
4. Select the gifted SMS verification sign and template. Save `SignName`, `TemplateCode`, and template variable names such as `code` and `min`.
5. Create a RAM AccessKey with least-privilege permissions for `dypns:SendSmsVerifyCode`, `dypns:GetAuthToken`, and `dypns:GetPhoneWithToken`.
6. Prepare real user agreement and privacy policy URLs for the H5 SDK auth page and the existing agreement checkbox.

## Environment

```powershell
SMS_PROVIDER=aliyun_pnvs
PHONE_ONE_TAP_PROVIDER=aliyun_h5

ALIYUN_ACCESS_KEY_ID=...
ALIYUN_ACCESS_KEY_SECRET=...
ALIYUN_PNVS_ENDPOINT=dypnsapi.aliyuncs.com
ALIYUN_PNVS_REGION=cn-hangzhou

ALIYUN_PNVS_SMS_SIGN_NAME=...
ALIYUN_PNVS_SMS_TEMPLATE_CODE=100001
ALIYUN_PNVS_SMS_TEMPLATE_CODE_LOGIN=100001
ALIYUN_PNVS_SMS_TEMPLATE_CODE_REGISTER=100001
ALIYUN_PNVS_SMS_TEMPLATE_CODE_CHANGE_PHONE=100002
ALIYUN_PNVS_SMS_TEMPLATE_CODE_RESET_PASSWORD=100003
ALIYUN_PNVS_SMS_TEMPLATE_CODE_WECHAT=100004
ALIYUN_PNVS_SMS_TEMPLATE_CODE_ADMIN=100005
ALIYUN_PNVS_SMS_TEMPLATE_PARAM_CODE=code
ALIYUN_PNVS_SMS_TEMPLATE_PARAM_MIN=min
ALIYUN_PNVS_SMS_VALID_SECONDS=600

ALIYUN_PNVS_H5_URL=http://47.106.182.116:3000/
ALIYUN_PNVS_H5_ORIGIN=http://47.106.182.116:3000
ALIYUN_PNVS_H5_SCENE_CODE=...
```

Template mapping for the default gifted templates:

- `login` / `register`: `100001` 登录/注册模板
- `change_phone`: `100002` 修改绑定手机号模板
- `reset_password`: `100003` 重置密码模板
- `wechat`: `100004` 绑定新手机号模板
- `admin`: `100005` 验证绑定手机号模板

`ALIYUN_PNVS_SMS_TEMPLATE_CODE` remains the fallback template if a purpose-specific variable is missing.

Use mock mode for dry runs:

```powershell
SMS_PROVIDER=aliyun_pnvs
PHONE_ONE_TAP_PROVIDER=aliyun_h5
ALIYUN_PNVS_MOCK=1
PHONE_ONE_TAP_MOCK_PHONE=+8613912345698
```

Production must use an HTTPS domain in the Aliyun H5 auth scheme. Do not set `ALIYUN_PNVS_MOCK=1` or `SMS_DEV_RETURN_CODE=1` in production.

## Verification

Non-paid checks:

```powershell
git diff --check
npm.cmd run build
npx.cmd tsc --noEmit
node scripts\auth-flow-dry-run-tests.mjs
node scripts\aliyun-pnvs-mock-tests.mjs
```

Real acceptance requires explicit approval because SMS sending and H5 phone exchange may incur charges.
