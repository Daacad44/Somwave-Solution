# Somwave — What each user sees

Two origins. `somwave.com` is the public Astro site. `app.somwave.com` is one React dashboard. Navigation is permission-gated; the API re-checks every key.

## GUEST / not signed in

Public Site only. No dashboard.

## CLIENT

Portal group only: dashboard, my projects, milestones, tickets, invoices. Payments stay on invoice detail. Data is scoped to `user.clientId`. Another client’s row returns 404. Internal Operations is not shown.

## EDITOR

Website/CMS group only. No HR, finance, or other clients’ portal data.

## STAFF

Internal delivery (projects, tasks, milestones, timesheets, tickets) according to permissions.

## MANAGER / ADMIN

Internal modules they are granted, including invoices and tickets when those permissions exist, plus CMS if they hold `content.*`. ADMIN does not replace SUPER_ADMIN for role management unless `roles.manage` is granted.

## SUPER_ADMIN

Website/CMS and Internal (including users, roles, invoices, tickets). Portal project/milestone links appear only when the user also has a `clientId` — otherwise those APIs return 404.

Hiding a nav item is not authorization. App routes also require the matching permission; the API re-checks every key.
