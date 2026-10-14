# Resend transactional email

The backend sends engineer invitations, project assignment notifications, password resets, invoices and enquiry alerts through the Resend HTTPS API. SMTP is not used. The official `resend` SDK version 5 is used because the production Docker image runs Node 20.

## Coolify runtime settings

Set these on the **backend application runtime**, and on a dedicated backend worker if one is deployed:

```env
RESEND_API_KEY=re_your_real_api_key
EMAIL_FROM=Somwave Solution <noreply@botandev.com>
APP_PUBLIC_URL=https://app.somwave.botandev.com
```

Verify `botandev.com` in Resend before sending. `EMAIL_NOTIFY_TO` and `EMAIL_SUPPORT` are optional backend-only addresses. Do not put the API key in `VITE_*`, the repository, image build arguments, or frontend environment. Restart/redeploy the backend after changing runtime settings. The frontend must call `https://api.somwave.botandev.com` and `CORS_ORIGINS` must allow `https://app.somwave.botandev.com`.

`GET /api/v1/engineering/accounts/email-readiness` is administrator-only. It reports whether the required setting names are present; it never returns the API key. A configured response is not proof that Resend has accepted a request or delivered it to a mailbox.

## Delivery and recovery

An engineer invitation is sent synchronously. A successful Resend response changes its delivery status to `ACCEPTED` and stores the provider message ID. The account stays inactive until the recipient verifies the one-use link and completes activation. A failed send is recorded as `FAILED`; an administrator can resend after the one-minute throttle. Each attempt uses a stable Resend idempotency key derived from the stored invitation token hash.

Project assignment emails are queued in `notification_deliveries` with a unique business-event key. A single background-job owner claims them with a lease and sends through Resend using a stable idempotency key. The queue stores the provider message ID and marks provider acceptance as `ACCEPTED`. Missing configuration parks work as `WAITING_CONFIG`; transient errors and rate limits retry with bounded exponential backoff; rejected credentials or sender configuration fail permanently for operator review. Redis is used elsewhere in the application, but this email queue is persisted in PostgreSQL.

## Production verification

No staging environment is required for this change. After an authorized Coolify deployment, use an approved test engineer mailbox and controlled project records. Register the engineer, check the Resend message ID and recipient inbox, open the activation link, verify and activate, then log in and accept a project invitation. Confirm the assigned project appears in Engineering Workspace, the administrator sees the active account, and retry/failure records are accurate. Remove only the test records created for this check. Provider acceptance alone is not mailbox-delivery evidence.

Before deployment, back up production data and review the additive `20261014010000_resend_delivery_tracking` migration. The backend entrypoint applies pending Prisma migrations at startup. Do not reset the database or modify the existing Super Admin account.
