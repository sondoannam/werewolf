import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
// import * as Sentry from '@sentry/tanstackstart-react'
import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

    context: getContext(),

    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  // if (!router.isServer) {
  //   const sentryDsn =
  //     import.meta.env?.VITE_SENTRY_DSN ?? process.env.VITE_SENTRY_DSN

  //   Sentry.init({
  //     dsn: sentryDsn,

  //     // Adds request headers and IP for users, for more info visit:
  //     // https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#sendDefaultPii
  //     sendDefaultPii: true,
  //   })
  // }

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
