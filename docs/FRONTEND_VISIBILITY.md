# Somwave — What each user sees

Two origins. `somwave.com` is the public Astro site. `app.somwave.com` is one React dashboard. Navigation is permission-gated; the API re-checks every key.

## GUEST / not signed in

Public Site only. No dashboard.

## CLIENT

Portal group only: dashboard, my projects, tickets, invoices. Data is scoped to `user.clientId`. Another client’s row returns 404.

## EDITOR

Website/CMS group only. No HR, finance, or other clients’ portal data.

## STAFF

Internal delivery (projects, tasks, milestones, timesheets) according to permissions.

## MANAGER / ADMIN

Internal modules they are granted, plus CMS if they hold `content.*`. ADMIN does not replace SUPER_ADMIN for role management unless `roles.manage` is granted.

## SUPER_ADMIN

All three groups: Website/CMS, Internal, Portal.

Hiding a nav item is not authorization.
